# Flow Key — Fiat Addendum (The Tin and the Count-Up)

**Date:** 2026-07-30
**Extends:** `2026-07-30-flow-key-design.md`
**Roadmap subject:** P7.5-F — Flow Key, fiat tap (payout execution gated to **P14**)
**Migration:** 120

---

## 1. Orthogonality (read this first)

The crypto tap answers **"who was in the room."** The fiat tap answers **"who gets
paid."** They are two taps on the same key and neither requires the other:

- A spore can be sealed, split, and paid in euros with **zero chain involvement**.
- A spore can be sealed, hashed, countersigned, and anchored with **zero money**.
- The shared spine is `flow_spore_contributors.weight`. The spore already knows
  who contributed and how much. Fiat only resolves those weights into euros.

FK-3 (notary) and FK-4 (fiat) can ship in either order, or one may never ship.

## 2. The cultural model: door money, not a store

The underground's fiat ritual is old, respected, and completely native: **a tin at
the door, and a count-up at the end of the night, divided by who actually played.**
Tape and vinyl sales, Bandcamp, the jar on the decks. Nobody rolls their eyes at
that; people roll their eyes at *checkout*.

So this is deliberately **not** a store. It is a tin.

| Native (build this) | Tourist (never build this) |
|---|---|
| A tin you can drop money in | A paywall on the ritual |
| Pay what you want, including nothing | A price, a tier prompt, an "unlock" |
| Count-up after, split by who played | Instant per-stream micropayments |
| The split is visible to the people in it | A public tip leaderboard |
| Silence about who gave what | "12 people are watching", urgency, scarcity timers |

Hard guardrails, non-negotiable:

- **Zero is a valid amount and is never shamed.** No nag, no "are you sure",
  no reduced experience, no dimmed UI. The room is identical for someone who
  gave nothing.
- **No price is displayed inside the ritual room**, per the base spec. The tin is
  present as a vessel; amount selection happens on a separate surface reached by
  tapping it, so the room never becomes a shop.
- **No leaderboard of who paid most, ever.** This is the single grimmest pattern
  in creator monetization and it would poison the room.
- **No paywall on germination-by-contributors.** People who made the thing never
  pay to re-open it.
- **The ritual is never interrupted by commerce.** Count-up happens after the
  session ends, on its own surface.

## 3. Existing rails this sits on

Already shipped and proven (7/7 unit tests on the gear path):

- `084_stripe_connect_accounts.sql` — `profiles.stripe_account_id`,
  `payouts_enabled`, `charges_enabled`, `connect_onboarding_state`
  (service-role-write-only). Express accounts, one per profile.
- `085_marketplace_ledger.sql` — `platform_fee_ledger` with
  **unique `(source_type, source_id)`** as the idempotency guard, and a
  `'held'` status for payees who have not onboarded.
- `src/lib/stripe-connect.ts` — **separate charges & transfers**: the platform is
  merchant of record, captures to the platform balance, holds, then transfers net
  to the connected account. `getStripe()`, `splitCents()`, `payoutToSeller()`,
  `onboardingStateFromAccount()`. Stripe v22, API `2026-05-27.dahlia`, EUR default.
- `src/app/api/stripe/connect/onboard` + `/status` — onboarding already works.
- Subscription tiers `free | supporter | insider | patron` and
  `mixes.required_tier` (116/117).

### 3.1 The one real incompatibility

`payoutToSeller()` assumes **exactly one payee per source**: it short-circuits on a
single `(source_type, source_id)` ledger row and uses the idempotency key
`${sourceType}-transfer-${sourceId}`.

A door split is **N payees per source**. Reusing that function would either
collapse the split to one row or fight the unique index.

**Resolution** (keeps both idempotency guarantees intact, edits nothing):

- New table `flow_split_shares`, with its own unique
  `(split_id, payee_profile_id)` guard — the same proven pattern, one level down.
  Stripe idempotency key becomes `flow-share-${share_id}`.
- The platform's own fee is **one row per spore**, which fits the existing
  `platform_fee_ledger` unique index perfectly. So extend that check constraint
  with `'flow_split'` and write a single summary row there. The platform ledger
  stays the single source of truth for platform revenue; per-artist shares live in
  the new table.

## 4. Data model — migration 120

### 4.1 `flow_tins` — the vessel

```
session_id      uuid primary key references collab_sessions(id) on delete cascade
opened_by       uuid not null references profiles(id)
currency        char(3) not null default 'EUR'
state           text not null default 'open'
                  check (state in ('open','closed','counted','settled','void'))
gross_cents     bigint not null default 0      -- captured, pre-fee
refunded_cents  bigint not null default 0
suggested_cents int[]                          -- optional, shown only on the tin surface
closed_at       timestamptz
created_at      timestamptz not null default now()
```

One tin per session. The tin belongs to the **room**, not to a spore — because
money arrives on the room's timeline, not on the harvest's.

### 4.2 `flow_tin_drops` — what went in

```
id                uuid primary key default gen_random_uuid()
session_id        uuid not null references flow_tins(session_id) on delete cascade
payer_profile_id  uuid references profiles(id)      -- null = anonymous drop
amount_cents      bigint not null check (amount_cents > 0)
currency          char(3) not null default 'EUR'
payment_intent_id text unique
status            text not null default 'pending'
                    check (status in ('pending','captured','refunded','failed'))
message           text check (char_length(message) <= 280)
anonymous         boolean not null default true
created_at        timestamptz not null default now()
```

`anonymous` defaults **true**. Attribution is opt-in, and even when opted in it is
visible only to contributors — never ranked, never public.

### 4.3 `flow_splits` — the count-up

```
id               uuid primary key default gen_random_uuid()
session_id       uuid not null references collab_sessions(id) on delete cascade
proposed_by      uuid not null references profiles(id)
state            text not null default 'proposed'
                   check (state in ('proposed','disputed','committed','settled','void'))
gross_cents      bigint not null
platform_fee_pct numeric(5,2) not null
platform_fee_cents bigint not null
stripe_fee_cents bigint not null default 0     -- shown honestly, never hidden
distributable_cents bigint not null
silica_policy    text not null default 'redistribute'
                   check (silica_policy in ('redistribute','scene_fund','agent_author'))
basis            jsonb not null default '{}'    -- the weight snapshot it was computed from
proposed_at      timestamptz not null default now()
dispute_window_ends_at timestamptz not null
committed_at     timestamptz
created_at       timestamptz not null default now()
unique (session_id)                             -- one count-up per night
```

### 4.4 `flow_split_shares` — per-payee, per-share idempotency

```
id                 uuid primary key default gen_random_uuid()
split_id           uuid not null references flow_splits(id) on delete cascade
payee_profile_id   uuid not null references profiles(id)
weight             numeric not null
share_cents        bigint not null
remainder_cents    int not null default 0        -- largest-remainder allocation
status             text not null default 'pending'
                     check (status in ('pending','transferred','held','reversed'))
stripe_transfer_id text unique
held_reason        text                          -- 'no_connect_account' | 'payouts_disabled'
settled_at         timestamptz
created_at         timestamptz not null default now()
unique (split_id, payee_profile_id)
```

### 4.5 `flow_scene_fund` — where unclaimed and machine shares go

```
id            uuid primary key default gen_random_uuid()
source_split  uuid references flow_splits(id)
reason        text not null check (reason in ('silica','unclaimed','rounding'))
amount_cents  bigint not null
currency      char(3) not null default 'EUR'
created_at    timestamptz not null default now()
```

A communal pot, with a public running total and a stated purpose. If it exists it
must be **spendable by the scene and accounted for in public**, otherwise it is
just platform revenue wearing a nicer word — say so plainly or don't build it.

### 4.6 Extend the existing ledger

```sql
alter table public.platform_fee_ledger
  drop constraint if exists platform_fee_ledger_source_type_check;
alter table public.platform_fee_ledger
  add constraint platform_fee_ledger_source_type_check
  check (source_type in ('gear','agent','flow_split'));
```

One summary row per `flow_split` — the platform fee. Per-artist money lives in
`flow_split_shares`.

## 5. How weights are derived

Weights come from the union of `flow_spore_contributors` rows across **all sealed
spores for that session**, so turning the Flow Key more often makes your
contribution *more legible* — but never gates payment. If no spore was ever
drained, weights fall back to `collab_session_participants` with equal shares.

Default weighting (all tunable constants in one module, not scattered):

| Contribution | Weight |
|---|---|
| Host / creator role | base share |
| Capped asset contributed | per distinct asset that drained |
| Pinned mark or accepted direction vote | small share, capped per person |
| Audience presence alone | zero — presence is not labour |

The host may adjust weights **before commit**, and every contributor sees the
proposed split with the reasoning. Unanimity is not required — a forty-person room
would deadlock — but the dispute window is real and enforced (§6).

### 5.1 The silica question

If the Session Spirit or an AI agent contributed, does the machine get paid?

**Default: `redistribute`.** The silica share dissolves pro-rata into the carbon
contributors. The humans in the room get it.

Two alternatives, both legitimate, both opt-in per session:

- **`scene_fund`** — the machine's share funds the next ritual rather than any
  individual. Honest, communal, and easy to explain at the bar.
- **`agent_author`** — agents are followable artists with owners
  (migration 104, `ai_agents`), and somebody wrote them. Defensible, but it
  routes room money to a person who was not in the room; the culture will read
  that as rent. Never the default.

Whichever is chosen, the silica fraction is **disclosed in the split UI** with the
same directness as the AI Band badge. A hidden machine cut is the exact thing that
would break trust.

## 6. Flow of funds

1. **Tin opens** with the session (or the host opens it later). No amounts shown
   in the room.
2. **Drops** — Stripe PaymentIntent per drop, platform as merchant of record,
   captured to the platform balance. Card, plus **iDEAL and Bancontact** since
   this is Belgium/Benelux first — those are the payment methods people actually
   use, and omitting Bancontact would be a tell.
3. **Session ends.** Tin closes. No further drops.
4. **Count-up** — `propose_flow_split()` computes gross, subtracts the stated
   platform fee and the real Stripe processing fee, applies the silica policy,
   allocates by weight using **largest-remainder** so the cents always sum
   exactly to `distributable_cents`, and writes `flow_splits` + N
   `flow_split_shares` in `pending`.
5. **Dispute window** — default 72h, configurable, minimum 24h. Every contributor
   is notified (the notification infrastructure from 095/114/118 already
   delivers this) and can raise a dispute, which moves the split to `disputed`
   and blocks all transfers until the host re-proposes or a moderator resolves it.
6. **Commit** — after the window with no dispute, or on unanimous early
   agreement. `committed_at` set. Weights become immutable from here.
7. **Settle** — a cron transfers each share to its connected account via a new
   `payoutSplitShare()` (per-share idempotency key `flow-share-${share_id}`).
   Shares for payees without `payouts_enabled` are written `held` with a reason
   and swept on each run once onboarding completes — reusing the existing
   `'held'` semantics rather than inventing new ones.
8. **Unclaimed** — a share held longer than 180 days notifies the payee three
   times, then moves to `flow_scene_fund` with `reason = 'unclaimed'`. The
   threshold and the destination are stated up front, in the UI, before anyone
   drops a cent.

### 6.1 Refunds

Refundable in full while the tin is `open` or `closed`, self-service, no reason
required. **After `committed`, refunds are absorbed by the platform and never
clawed back from artists** — a paid artist stays paid. That is a real cost the
platform eats on purpose, and it is the correct trade: chargeback risk belongs to
the party that can carry it.

## 7. The platform fee

The culturally correct number here is **low and stated in plain language on the
tin surface itself**, next to the unavoidable Stripe processing fee, with no
rounding in the platform's favour.

Recommendation: **0% during closed beta** (P15), low single digits after, and the
Stripe fee always shown separately so nobody thinks MixHive is taking it. A fee
that needs a help-centre article to explain is already too complicated.

Both numbers live in one constants module with the weighting table, so the whole
economic policy of the feature is readable in a single file.

## 8. Subscriptions — the symmetric right

Existing tiers (`supporter | insider | patron`) interact with exactly one thing:
**germination rights for non-contributors.**

- Crypto tap: the right to germinate is an attenuable **capability grant**.
- Fiat tap: the right to germinate can be a **tier entitlement**.

Same right, two currencies, one enforcement point in `germinate_flow_spore()`.

Spores themselves are **not** tier-gated by default. Gating a spore contradicts
germination-as-culture — the whole point is that it grows again.

## 9. API surface

Under `src/app/api/mythic/sessions/[id]/tin/`:

- `POST open` — host opens the tin
- `GET` — tin state; amounts only on the tin surface, never in the room payload
- `POST drop` — create PaymentIntent `{ amount_cents, anonymous, message? }`
- `POST close` — host closes, or automatic on session end

Under `src/app/api/flow-splits/`:

- `POST propose` — `{ session_id, silica_policy?, weight_overrides? }`
- `GET [id]` — the split, visible to contributors only
- `POST [id]/dispute` — `{ reason }` → state `disputed`
- `POST [id]/commit` — host, after window or on unanimous agreement
- `POST [id]/settle` — service-role/cron only

Webhook: extend the existing marketplace Stripe webhook rather than adding a
second endpoint — `payment_intent.succeeded` marks a drop `captured`,
`charge.refunded` marks it `refunded` and decrements `flow_tins.refunded_cents`.

## 10. UI / UX

- **`TinGlyph`** in `MythicSessionRoom` — a small honeycomb vessel beside the
  `FlowKeyGlyph`. **No amount, no total, no count** in the room. Tapping it opens
  a separate sheet. Real `<button>`, tokenized colours, stable at 320px.
- **`TinSheet`** — pay-what-you-want with optional suggested chips, an explicit
  "just here to listen" affirmative that closes the sheet with no friction and no
  follow-up, anonymity **on** by default, optional 280-char message.
- **`CountUpSheet`** — the split, shown as a honeycomb where each cell is a payee
  sized by share. Gross, platform fee, Stripe fee, silica policy, and every
  weight with its reason, all on one screen. A `Dispute` button with equal visual
  weight to `Agree` — if disputing is harder to find than agreeing, the window is
  decoration.
- **`ShareStatusChip`** — `pending` / `transferred` / **`waiting in the comb`**
  (held), with a direct link to Connect onboarding.
- Contributors see the tin total only **after** the session ends. Live totals
  during a ritual would turn the room into a fundraiser.

## 11. Error handling

| Condition | Behaviour |
|---|---|
| Drop while tin `closed`/`counted` | 409 `tin_closed` |
| Drop below Stripe minimum (~€0.50 EUR) | 422 with the real minimum stated |
| Propose split twice | 409 (unique `session_id`) |
| Commit before the window with a dispute open | 409 `dispute_open` |
| Commit without unanimity before window end | 409 with time remaining |
| Settle a non-`committed` split | 409 |
| Payee has no Connect account | share `held`, `held_reason`, notify, sweep later — never an error to the room |
| Transfer fails at Stripe | share stays `pending`, retried with the same idempotency key; three failures raise an ops alert |
| Refund arrives after commit | platform absorbs; artist shares untouched |
| Rounding leftover after largest-remainder | to `flow_scene_fund` with `reason = 'rounding'`, never to the platform |

## 12. Testing

**Unit**
- Largest-remainder allocation: shares always sum **exactly** to
  `distributable_cents`; property-tested across random weights and totals,
  including 1-cent totals and 40-payee rooms.
- Weight derivation from spore contributors, including the no-spore fallback.
- All three silica policies, including that `redistribute` conserves every cent.
- Fee arithmetic against `splitCents()` semantics; assert no rounding favours the
  platform.

**Integration (Stripe TEST mode only)**
- drop → webhook → `captured`; refund → webhook → `refunded` and tin decremented.
- propose → dispute → blocked settle → re-propose → commit → settle.
- Settlement idempotency: run the cron three times, assert exactly one transfer
  per share (the guarantee `payoutToSeller` gives gear, now at share level).
- A payee with no Connect account: `held`, then onboards, then swept to
  `transferred` with no double-pay.

**Live**
Per the project verification standard, then hard-delete. Three throwaway users,
Stripe **test** cards, iDEAL and Bancontact test flows included.

## 13. Gates and policy

- **Payout execution is gated to P14**, matching the existing monetization
  policy: Stripe is wired and verified in **test mode**, never with live keys
  mid-build, `STRIPE_SECRET_KEY` read from Vercel env.
- FK-4 may be **built and unit/integration-tested before P14** exactly as the
  gear escrow path was (built + 7/7 tests, live verification deferred). What is
  gated is real money, not the code.
- No new paid third-party dependency. Stripe is already present.

## 14. Open question for a human, not an agent

**VAT and the merchant-of-record position.** With the platform as merchant of
record on pay-what-you-want drops, MixHive plausibly owes VAT on the **gross**
across EU jurisdictions, and "is a tip for a live performance a donation or a
supply of services" has different answers in different member states. Structuring
MixHive as a **disclosed agent** for the artists changes both the VAT position and
the Connect account type required.

This is a Belgian accountant's call and a real launch blocker for the fiat tap. It
should be resolved before P14, not designed around here. Flagging it rather than
guessing.

## 15. Authenticity check

1. *Human agency?* Increased. Zero is a first-class amount, anonymity is the
   default, weights are visible with reasons, and any contributor can stop a
   settlement.
2. *Veteran nod or eyeroll?* Nod. This is the door tin and the count-up, which is
   how the scene has always handled money. The eyeroll patterns — paywall, tip
   leaderboard, urgency, hidden machine cut — are named and forbidden in §2.
3. *Native or tourist?* Native, including Bancontact and iDEAL rather than
   card-only, which is the small detail that tells you whether something was
   built in Belgium or ported to it.
4. *Does it protect the edge?* Yes. No live totals during the ritual, no price in
   the room, no commerce interrupting the session, and refunds never claw back
   from an artist who was already paid.
