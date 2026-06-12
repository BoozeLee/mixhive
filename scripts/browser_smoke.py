#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


ROUTES = [
    "/",
    "/feed",
    "/discover",
    "/search",
    "/dashboard",
    "/setup",
    "/upload",
    "/settings",
    "/opportunities",
    "/agents/inbox",
    "/epk",
    "/agents/gallery",
    "/mix/00000000-0000-4000-8000-000000000001",
    "/buzz/00000000-0000-4000-8000-000000000001",
    "/u/test-user",
]
VIEWPORTS = [(1440, 900), (768, 900), (390, 844), (320, 740)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test MixHive route loads in a real browser.")
    parser.add_argument("base_url", help="Base URL, for example http://127.0.0.1:3000")
    parser.add_argument(
        "--mock-supabase",
        action="store_true",
        help="Fulfill Supabase browser requests with empty JSON responses for local UI-only smoke runs.",
    )
    args = parser.parse_args()

    executable_path = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=executable_path,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        for width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            if args.mock_supabase:
                context.add_init_script("window.__MIXHIVE_DISABLE_SUPABASE__ = true")
            page = context.new_page()
            if args.mock_supabase:
                page.route(
                    "**/*.supabase.co/**",
                    lambda route: route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps([]),
                    ),
                )
            console_errors: list[str] = []
            bad_responses: list[str] = []

            page.on(
                "console",
                lambda message: console_errors.append(message.text) if message.type == "error" else None,
            )
            page.on(
                "pageerror",
                lambda error: console_errors.append(str(error)),
            )
            page.on(
                "response",
                lambda response: bad_responses.append(f"{response.status} {response.url}")
                if response.status >= 400 and "favicon" not in response.url
                else None,
            )

            for route in ROUTES:
                url = urljoin(args.base_url.rstrip("/") + "/", route.lstrip("/"))
                try:
                    response = page.goto(url, wait_until="load", timeout=30_000)
                    if response is None or response.status >= 400:
                        failures.append(f"{width}x{height} {route}: navigation status {getattr(response, 'status', None)}")
                    page.wait_for_selector("#main-content", state="attached", timeout=8_000)
                    overflow = page.evaluate(
                        "() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1"
                    )
                    if overflow:
                        failures.append(f"{width}x{height} {route}: horizontal overflow")
                except Exception as exc:
                    failures.append(f"{width}x{height} {route}: {exc}")
                finally:
                    time.sleep(0.8)

            failures.extend(f"{width}x{height}: console error: {entry}" for entry in console_errors)
            failures.extend(f"{width}x{height}: failed response: {entry}" for entry in bad_responses)
            context.close()

        browser.close()

    if failures:
        print("Smoke failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("Smoke passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
