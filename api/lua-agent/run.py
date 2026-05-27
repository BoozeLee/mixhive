"""MixHive Lua agent runtime.

Executes a user-authored Lua script in a sandboxed Lupa runtime in
response to a MixHive event. Runs as a Vercel Python serverless function
on Fluid Compute.

Request body:
    {
      "agent_id": "<uuid>",
      "triggered_by": "event:on_follow" | "manual" | "schedule",
      "event": { ... }
    }

The function:
  1. Authenticates the caller via RUNTIME_SHARED_SECRET in Authorization.
  2. Loads the agent row from Supabase.
  3. Builds a restricted Lua runtime exposing only the MixHive stdlib.
  4. Calls the entry-point matching the trigger (e.g. on_follow(event)).
  5. Writes the result back via record_lua_agent_run().

MixHive stdlib (mh.*):
  -- Identity
  mh.agent_id, mh.owner_id, mh.trigger

  -- Logging
  mh.print(...)

  -- Read helpers
  mh.get_mix(mix_id)
  mh.get_profile(user_id)
  mh.get_mixes_by_user(user_id, limit?)   -- up to 50
  mh.get_followers(user_id, limit?)        -- up to 100
  mh.get_following(user_id, limit?)        -- up to 100
  mh.fetch_recent_mixes(limit?)            -- platform-wide, up to 50

  -- Social write actions
  mh.comment(mix_id, body)                -- max 1 comment per run, 1000 chars
  mh.delete_comment(comment_id)           -- only your own comments on your own mixes
  mh.post_buzz(text)                       -- max 1 buzz per run, 500 chars
  mh.notify(message)                       -- in-app notification to yourself, 500 chars
  mh.follow(user_id)                       -- idempotent
  mh.unfollow(user_id)
  mh.like(mix_id)                          -- idempotent
  mh.unlike(mix_id)
  mh.repost(mix_id)
  mh.unrepost(mix_id)

  -- Persistent key-value store (per-agent)
  mh.kv_get(key)                           -- returns string or nil
  mh.kv_set(key, value, ttl_seconds?)      -- ttl omitted = no expiry
  mh.kv_del(key)
  mh.kv_list()                             -- returns array of {key, value, expires_at}

  -- Utilities
  mh.json_encode(table)                    -- Lua table → JSON string
  mh.json_decode(str)                      -- JSON string → Lua table

The runtime is deliberately small and strict. The point is not to be a
general-purpose Lua interpreter; the point is to give creators a safe
way to script social-media reactions.
"""
from __future__ import annotations

import json
import os
import signal
import time
import traceback
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import urljoin

import httpx
from lupa import LuaError, LuaRuntime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RUNTIME_SHARED_SECRET = os.environ.get("LUA_RUNTIME_SHARED_SECRET", SERVICE_ROLE_KEY)


# --------------------------------------------------------------------- #
# Supabase REST helpers
# --------------------------------------------------------------------- #


def _rest(path: str) -> str:
    return urljoin(SUPABASE_URL + "/", path.lstrip("/"))


def _service_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _client(actor_user_id: str | None = None) -> httpx.Client:
    """A client whose writes respect RLS for the given actor.

    We achieve this by signing requests with the service key but adding a
    `x-mixhive-actor` header that the Lua-callable RPCs check. The full
    pattern would be to mint a JWT for the actor; for the v1 we trust
    the agent runtime and let our RPC layer enforce ownership.
    """
    headers = _service_headers()
    if actor_user_id:
        headers["x-mixhive-actor"] = actor_user_id
    return httpx.Client(base_url=SUPABASE_URL, headers=headers, timeout=5.0)


def _load_agent(agent_id: str) -> dict[str, Any] | None:
    with httpx.Client(headers=_service_headers(), timeout=5.0) as c:
        r = c.get(
            _rest("/rest/v1/lua_agents"),
            params={"id": f"eq.{agent_id}", "select": "*", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


def _record_run(
    agent_id: str,
    triggered_by: str,
    event: dict[str, Any] | None,
    status: str,
    duration_ms: int,
    stdout: str,
    error_message: str | None,
) -> None:
    with httpx.Client(headers=_service_headers(), timeout=5.0) as c:
        c.post(
            _rest("/rest/v1/rpc/record_lua_agent_run"),
            json={
                "p_agent_id": agent_id,
                "p_triggered_by": triggered_by,
                "p_event_payload": event,
                "p_status": status,
                "p_duration_ms": duration_ms,
                "p_stdout": stdout[:8000] if stdout else None,
                "p_error_message": error_message[:2000] if error_message else None,
            },
        )


# --------------------------------------------------------------------- #
# Lua sandbox
# --------------------------------------------------------------------- #


# Pure Lua functions and modules that are SAFE to expose. Everything not
# in this allow-list is yanked out of the runtime before user code runs.
# Reflection primitives (getmetatable, setmetatable, rawget, rawset,
# rawequal, debug.*) are deliberately omitted — they're the classic
# sandbox-escape vectors.
_LUA_ALLOWED_GLOBALS = {
    "assert", "error", "ipairs", "next", "pairs", "pcall", "select",
    "tonumber", "tostring", "type", "unpack", "xpcall",
}
_LUA_ALLOWED_MODULES = {
    "math", "string", "table",
}


class AgentDeniedError(Exception):
    """Raised by the stdlib when the agent tries to do something it owns no permission for."""


class TimeoutHit(Exception):
    pass


@contextmanager
def _wall_clock_limit(ms: int):
    """SIGALRM-based hard timeout. Lupa cannot be cooperatively cancelled
    from Python in a way that's both portable and DoS-resistant; SIGALRM
    is the simplest hammer that works on Vercel's Linux runtime.
    """
    if ms <= 0:
        yield
        return

    def _alarm_handler(signum, frame):  # noqa: ARG001
        raise TimeoutHit(f"Lua exceeded {ms}ms wall clock")

    prev = signal.signal(signal.SIGALRM, _alarm_handler)
    signal.setitimer(signal.ITIMER_REAL, ms / 1000.0)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, prev)


def _deny_attribute(_obj: Any, _name: str, _setting: bool = False) -> Any:
    """Hard-stop any attribute access from Lua onto Python objects.

    Lupa's default behaviour lets Lua do `obj.__class__` / `obj.__globals__`
    and walk back into the interpreter. CVE-2026-34444 was incomplete
    enforcement of this filter; we keep the filter on AND keep Lupa
    pinned at >= 2.8. The MixHive stdlib only exposes plain callables;
    no surface needs attribute access from inside Lua.
    """
    raise AgentDeniedError(f"attribute access denied: {_name!r}")


def _lua_table_to_python(lua_runtime: LuaRuntime, obj: Any) -> Any:
    """Recursively convert a Lupa Lua table to plain Python dicts/lists."""
    if obj is None:
        return None
    try:
        items = list(obj.items())
    except AttributeError:
        return obj

    # Distinguish arrays (integer 1-based keys) from maps.
    if items and all(isinstance(k, int) for k, _ in items):
        sorted_items = sorted(items, key=lambda kv: kv[0])
        return [_lua_table_to_python(lua_runtime, v) for _, v in sorted_items]
    return {str(k): _lua_table_to_python(lua_runtime, v) for k, v in items}


def _python_to_lua_table(lua_runtime: LuaRuntime, obj: Any) -> Any:
    """Convert a plain Python dict/list to a Lua table."""
    if isinstance(obj, list):
        return lua_runtime.table_from({i + 1: _python_to_lua_table(lua_runtime, v) for i, v in enumerate(obj)})
    if isinstance(obj, dict):
        return lua_runtime.table_from({k: _python_to_lua_table(lua_runtime, v) for k, v in obj.items()})
    return obj


def _build_runtime(agent: dict[str, Any], stdout: list[str]) -> LuaRuntime:
    """Construct a fresh Lupa runtime with the MixHive stdlib installed."""
    # register_eval=False         — blocks load() / loadstring()
    # register_builtins=False     — keeps Python builtins out of Lua
    # attribute_filter=_deny      — blocks Lua → Python attribute fishing
    lua = LuaRuntime(
        unpack_returned_tuples=True,
        register_eval=False,
        register_builtins=False,
        attribute_filter=_deny_attribute,
    )

    # Strip dangerous globals before any user code runs.
    lua.execute(
        """
        for k in pairs(_G) do
          if not ({0})[k] and not ({1})[k] then
            _G[k] = nil
          end
        end
        """.format(
            "{" + ",".join(f'["{n}"]=true' for n in _LUA_ALLOWED_GLOBALS) + "}",
            "{" + ",".join(f'["{n}"]=true' for n in _LUA_ALLOWED_MODULES) + "}",
        )
    )

    owner_id: str = agent["owner_id"]
    agent_id: str = agent["id"]
    client_owner = _client(actor_user_id=owner_id)
    client_svc = _client()  # service-role only (for KV writes, buzz posting)

    # Per-run action counters — enforce hard single-run limits.
    _comment_count = [0]
    _buzz_count = [0]

    # -----------------------------------------------------------------
    # Logging
    # -----------------------------------------------------------------

    def lua_print(*args: Any) -> None:
        line = "\t".join(str(a) for a in args)
        stdout.append(line)
        if sum(len(line) for line in stdout) > 8000:
            raise AgentDeniedError("stdout cap exceeded (8000 chars)")

    # -----------------------------------------------------------------
    # Read helpers
    # -----------------------------------------------------------------

    def get_mix(mix_id: str) -> Any:
        r = client_owner.get(
            _rest("/rest/v1/mixes"),
            params={"id": f"eq.{mix_id}", "select": "*", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return None
        return _python_to_lua_table(lua, rows[0])

    def get_profile(user_id: str) -> Any:
        r = client_owner.get(
            _rest("/rest/v1/profiles"),
            params={"id": f"eq.{user_id}", "select": "*", "limit": 1},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return None
        return _python_to_lua_table(lua, rows[0])

    def get_mixes_by_user(user_id: str, limit: int = 10) -> Any:
        n = max(1, min(int(limit), 50))
        r = client_owner.get(
            _rest("/rest/v1/mixes"),
            params={
                "dj_id": f"eq.{user_id}",
                "published": "eq.true",
                "select": "id,title,dj_id,created_at,play_count,like_count",
                "order": "created_at.desc",
                "limit": str(n),
            },
        )
        r.raise_for_status()
        rows = r.json()
        return _python_to_lua_table(lua, rows)

    def get_followers(user_id: str, limit: int = 50) -> Any:
        n = max(1, min(int(limit), 100))
        r = client_owner.get(
            _rest("/rest/v1/follows"),
            params={
                "following_id": f"eq.{user_id}",
                "select": "follower_id,created_at",
                "order": "created_at.desc",
                "limit": str(n),
            },
        )
        r.raise_for_status()
        return _python_to_lua_table(lua, r.json())

    def get_following(user_id: str, limit: int = 50) -> Any:
        n = max(1, min(int(limit), 100))
        r = client_owner.get(
            _rest("/rest/v1/follows"),
            params={
                "follower_id": f"eq.{user_id}",
                "select": "following_id,created_at",
                "order": "created_at.desc",
                "limit": str(n),
            },
        )
        r.raise_for_status()
        return _python_to_lua_table(lua, r.json())

    def fetch_recent_mixes(limit: int = 10) -> Any:
        n = max(1, min(int(limit), 50))
        r = client_owner.get(
            _rest("/rest/v1/mixes"),
            params={
                "select": "id,title,dj_id,created_at,play_count,like_count",
                "order": "created_at.desc",
                "published": "eq.true",
                "limit": str(n),
            },
        )
        r.raise_for_status()
        return _python_to_lua_table(lua, r.json())

    # -----------------------------------------------------------------
    # Social write actions
    # -----------------------------------------------------------------

    def comment(mix_id: str, body: str) -> Any:
        body_str = str(body).strip()
        if not body_str:
            raise AgentDeniedError("comment body must be non-empty")
        if len(body_str) > 1000:
            raise AgentDeniedError("agent comments capped at 1000 chars")
        if _comment_count[0] >= 1:
            raise AgentDeniedError("agents may post at most 1 comment per run")
        _comment_count[0] += 1
        r = client_svc.post(
            _rest("/rest/v1/comments"),
            json={"mix_id": mix_id, "user_id": owner_id, "body": body_str},
            headers={**_service_headers(), "Prefer": "return=representation"},
        )
        r.raise_for_status()
        result = r.json()
        return _python_to_lua_table(lua, result[0] if result else {})

    def delete_comment(comment_id: str) -> None:
        # Only permitted if the agent owner wrote the comment AND it's on
        # a mix the owner owns. We check both server-side.
        r = client_svc.get(
            _rest("/rest/v1/comments"),
            params={
                "id": f"eq.{comment_id}",
                "user_id": f"eq.{owner_id}",
                "select": "id,mix_id",
                "limit": 1,
            },
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            raise AgentDeniedError(f"comment {comment_id} not found or not yours")

        mix_id = rows[0]["mix_id"]
        # Verify owner owns the mix (prevents deleting comments on other people's mixes).
        mix_r = client_owner.get(
            _rest("/rest/v1/mixes"),
            params={"id": f"eq.{mix_id}", "dj_id": f"eq.{owner_id}", "limit": 1, "select": "id"},
        )
        mix_r.raise_for_status()
        if not mix_r.json():
            raise AgentDeniedError("can only delete comments on your own mixes")

        client_svc.delete(
            _rest("/rest/v1/comments"),
            params={"id": f"eq.{comment_id}"},
        )

    def post_buzz(text: str) -> Any:
        text_str = str(text).strip()
        if not text_str:
            raise AgentDeniedError("buzz text must be non-empty")
        if len(text_str) > 500:
            raise AgentDeniedError("agent buzzes capped at 500 chars")
        if _buzz_count[0] >= 1:
            raise AgentDeniedError("agents may post at most 1 buzz per run")
        _buzz_count[0] += 1
        r = client_svc.post(
            _rest("/rest/v1/buzzes"),
            json={"author_id": owner_id, "text": text_str},
            headers={**_service_headers(), "Prefer": "return=representation"},
        )
        r.raise_for_status()
        result = r.json()
        return _python_to_lua_table(lua, result[0] if result else {})

    def notify(message: str) -> None:
        msg = str(message)[:500]
        client_svc.post(
            _rest("/rest/v1/notifications"),
            json={
                "user_id": owner_id,
                "actor_id": owner_id,
                "type": "mention",
                "data": {"source": "lua_agent", "agent_id": agent_id, "message": msg},
            },
        )

    def follow(target_user_id: str) -> None:
        if str(target_user_id) == owner_id:
            raise AgentDeniedError("cannot follow yourself")
        client_svc.post(
            _rest("/rest/v1/follows"),
            json={"follower_id": owner_id, "following_id": target_user_id},
        )

    def unfollow(target_user_id: str) -> None:
        client_svc.delete(
            _rest("/rest/v1/follows"),
            params={"follower_id": f"eq.{owner_id}", "following_id": f"eq.{target_user_id}"},
        )

    def like(mix_id: str) -> None:
        client_svc.post(
            _rest("/rest/v1/likes"),
            json={"user_id": owner_id, "mix_id": mix_id},
        )

    def unlike(mix_id: str) -> None:
        client_svc.delete(
            _rest("/rest/v1/likes"),
            params={"user_id": f"eq.{owner_id}", "mix_id": f"eq.{mix_id}"},
        )

    def repost(mix_id: str) -> None:
        mix_data = get_mix(mix_id)
        if not mix_data:
            raise AgentDeniedError(f"mix {mix_id} not found")
        # Lua table → dict for indexing
        try:
            mix_dj_id = mix_data["dj_id"]
        except (TypeError, KeyError):
            raise AgentDeniedError("could not read dj_id from mix")
        client_svc.post(
            _rest("/rest/v1/feed_events"),
            json={
                "actor_id": owner_id,
                "type": "repost",
                "mix_id": mix_id,
                "target_id": mix_dj_id,
            },
        )

    def unrepost(mix_id: str) -> None:
        client_svc.post(
            _rest("/rest/v1/rpc/unrepost"),
            json={"p_mix_id": mix_id},
        )

    # -----------------------------------------------------------------
    # Persistent key-value store
    # -----------------------------------------------------------------

    def kv_get(key: str) -> str | None:
        r = client_svc.post(
            _rest("/rest/v1/rpc/agent_kv_get"),
            json={"p_agent_id": agent_id, "p_key": str(key)[:128]},
        )
        r.raise_for_status()
        return r.json()  # returns null (None) or string

    def kv_set(key: str, value: str, ttl_seconds: int | None = None) -> None:
        payload: dict[str, Any] = {
            "p_agent_id": agent_id,
            "p_key": str(key)[:128],
            "p_value": str(value)[:4096],
        }
        if ttl_seconds is not None:
            payload["p_ttl_seconds"] = int(ttl_seconds)
        r = client_svc.post(_rest("/rest/v1/rpc/agent_kv_set"), json=payload)
        r.raise_for_status()

    def kv_del(key: str) -> None:
        r = client_svc.post(
            _rest("/rest/v1/rpc/agent_kv_del"),
            json={"p_agent_id": agent_id, "p_key": str(key)[:128]},
        )
        r.raise_for_status()

    def kv_list() -> Any:
        r = client_svc.post(
            _rest("/rest/v1/rpc/agent_kv_list"),
            json={"p_agent_id": agent_id},
        )
        r.raise_for_status()
        return _python_to_lua_table(lua, r.json() or [])

    # -----------------------------------------------------------------
    # JSON utilities
    # -----------------------------------------------------------------

    def json_encode(obj: Any) -> str:
        try:
            py_obj = _lua_table_to_python(lua, obj)
            return json.dumps(py_obj, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            raise AgentDeniedError(f"json_encode failed: {e}") from e

    def json_decode(s: str) -> Any:
        try:
            parsed = json.loads(str(s))
        except (ValueError, TypeError) as e:
            raise AgentDeniedError(f"json_decode failed: {e}") from e
        return _python_to_lua_table(lua, parsed)

    # -----------------------------------------------------------------
    # Compose the mh.* table
    # -----------------------------------------------------------------
    mh = lua.table_from({
        # Identity
        "agent_id":           agent_id,
        "owner_id":           owner_id,
        "trigger":            agent.get("trigger_type"),
        # Logging
        "print":              lua_print,
        # Read helpers
        "get_mix":            get_mix,
        "get_profile":        get_profile,
        "get_mixes_by_user":  get_mixes_by_user,
        "get_followers":      get_followers,
        "get_following":      get_following,
        "fetch_recent_mixes": fetch_recent_mixes,
        # Social write actions
        "comment":            comment,
        "delete_comment":     delete_comment,
        "post_buzz":          post_buzz,
        "notify":             notify,
        "follow":             follow,
        "unfollow":           unfollow,
        "like":               like,
        "unlike":             unlike,
        "repost":             repost,
        "unrepost":           unrepost,
        # Persistent KV store
        "kv_get":             kv_get,
        "kv_set":             kv_set,
        "kv_del":             kv_del,
        "kv_list":            kv_list,
        # JSON utilities
        "json_encode":        json_encode,
        "json_decode":        json_decode,
    })
    lua.globals().mh = mh
    lua.globals().print = lua_print
    return lua


# --------------------------------------------------------------------- #
# Request handler
# --------------------------------------------------------------------- #


def _execute(payload: dict[str, Any]) -> dict[str, Any]:
    agent_id = payload.get("agent_id")
    triggered_by = payload.get("triggered_by", "manual")
    event = payload.get("event") or {}

    if not agent_id or not isinstance(agent_id, str):
        return {"status": 400, "body": {"error": "agent_id required"}}

    agent = _load_agent(agent_id)
    if not agent:
        return {"status": 404, "body": {"error": "agent not found"}}
    if not agent.get("enabled"):
        return {"status": 200, "body": {"skipped": True, "reason": "agent disabled"}}

    stdout: list[str] = []
    started = time.monotonic()
    status = "ok"
    err: str | None = None

    try:
        lua = _build_runtime(agent, stdout)
        with _wall_clock_limit(int(agent.get("timeout_ms", 2000))):
            lua.execute(agent["lua_code"])
            entry = triggered_by.split(":", 1)[1] if triggered_by.startswith("event:") else None
            if entry:
                fn = lua.globals()[entry]
                if fn is not None:
                    fn(lua.table_from(event))
    except TimeoutHit as e:
        status, err = "timeout", str(e)
    except AgentDeniedError as e:
        status, err = "denied", str(e)
    except LuaError as e:
        status, err = "error", f"Lua error: {e}"
    except Exception as e:  # noqa: BLE001
        status, err = "error", f"{type(e).__name__}: {e}\n{traceback.format_exc()[:1000]}"

    duration_ms = int((time.monotonic() - started) * 1000)
    try:
        _record_run(agent_id, triggered_by, event, status, duration_ms, "\n".join(stdout), err)
    except Exception:  # noqa: BLE001
        pass

    return {
        "status": 200,
        "body": {
            "agent_id": agent_id,
            "status": status,
            "duration_ms": duration_ms,
            "stdout": stdout,
            "error": err,
        },
    }


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel convention
    def do_POST(self) -> None:  # noqa: N802
        auth = self.headers.get("Authorization", "")
        if not RUNTIME_SHARED_SECRET or auth != f"Bearer {RUNTIME_SHARED_SECRET}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":"unauthorized"}')
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"invalid json"}')
            return

        result = _execute(payload)
        self.send_response(result["status"])
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result["body"]).encode("utf-8"))

    def do_GET(self) -> None:  # noqa: N802
        # Health check.
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"runtime":"mixhive-lua-agent","stdlib_version":"2"}')
