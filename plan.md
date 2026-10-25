# Gapless — Delivery Updates + Negotiation Settings + Invites + Approvals Badge (Updated Plan)

## 1) Objectives
- ✅ Deliver the 4 requested features on top of the existing Clerk-auth multi-party Gapless app while keeping **all money/date/decision math deterministic in Python**.
- ✅ Make Real-mode multi-party workflows more complete:
  - Winning supplier can update delivery status from their portal
  - Owner can tune negotiation behavior (hardness + max rounds)
  - Owner can invite real clients/suppliers into their portal via email and/or copyable link
  - Owner sees a live approvals count badge in the main navigation
- 🔎 Current status: **All features implemented and verified** (user verification pending).

## 2) Implementation Steps

### Phase 1 — Core POC (isolation → fix until it works) ✅ COMPLETE
**Core proven:** Invite-link lifecycle + role-safe claiming + (optional) email send + deep link open.

Delivered user stories:
1. ✅ Owner can create an invite for a specific client or supplier and get a tokenized link.
2. ✅ Owner can (optionally) send the invite by email and also copy the link.
3. ✅ Signed-in user can open an invite link and see what it will link them to.
4. ✅ Signed-in user can accept the invite and immediately become the correct role (client/supplier).
5. ✅ System prevents re-claiming an already-linked counterparty unless it’s the same user.

Implementation delivered:
- Backend
  - ✅ Added `invites` collection; included in demo reset collections.
  - ✅ Endpoints:
    - `POST /api/invites` (owner): create token, optionally email via `email_util`, return `{token, url, emailed, linked_name}`.
    - `GET /api/invites` (owner): list recent invites.
    - `GET /api/invite/{token}` (any signed-in): show invite metadata.
    - `POST /api/invite/{token}/accept` (any signed-in): claim via `auth_roles.claim_counterparty`; returns **409** if already accepted by a different user.
  - ✅ Updated `access_guard` to allow `/api/invite/*` for any signed-in user.
- Frontend
  - ✅ Added `/invite/:token` accept flow (`InviteAccept.jsx`) and routed it in `App.js`.
  - ✅ Signed-out users are redirected to sign-in; signed-in users can accept.

### Phase 2 — V1 App Development (build features end-to-end) ✅ COMPLETE

#### A) Supplier Delivery Updates (4 stages) ✅ COMPLETE
User stories delivered:
1. ✅ Supplier can mark **Accepted → Shipped → Out for delivery → Delivered** after winning.
2. ✅ Supplier cannot update delivery for an order they didn’t win (403).
3. ✅ Owner can see delivery status in the Buy flow.
4. ✅ Owner receives an email when the supplier advances the delivery stage.
5. ✅ Each stage change is logged.

Implementation delivered:
- Backend
  - ✅ Added deterministic delivery stages in `engine.py`:
    - `DELIVERY_STAGES`, `DELIVERY_KEYS`, `delivery_label()`, `next_delivery_stage()`.
  - ✅ Auto-initialize `delivery_stage='accepted'` when awarding a supplier (`award_winner` and manual approve path).
  - ✅ New endpoint `POST /api/portal/supplier/delivery`:
    - Enforces winner-only access
    - Advances exactly one stage per call
    - 400 if already delivered
    - Updates `purchase_requests.delivery_stage` + `delivery_history`
    - Triggers `log_activity` + `email_owner`
  - ✅ Exposed delivery info in:
    - `GET /api/portal/supplier/summary` (returns `won` + `delivery` object)
    - `GET /api/buy/current` (returns `delivery_stages`, `delivery_label`)
- Frontend
  - ✅ Supplier portal shows delivery tracker card and “Mark next stage” CTA.
  - ✅ Owner Buy page shows supplier-driven delivery status card when `delivery_stage` exists.

#### B) Negotiation Settings ✅ COMPLETE
User stories delivered:
1. ✅ Owner can choose a bargaining preset (Gentle/Balanced/Aggressive).
2. ✅ Owner can override exact parameters (open % and max rounds).
3. ✅ Buying negotiation uses saved settings deterministically.
4. ✅ Invalid values rejected clearly (400).
5. ✅ Supplier sees consistent deterministic counters across rounds.

Implementation delivered:
- Backend
  - ✅ Added settings fields in `engine.DEFAULT_SETTINGS`:
    - `nego_style`, `nego_open_pct`, `nego_max_rounds`
  - ✅ Implemented deterministic helpers in `engine.py`:
    - `nego_params(settings)`
    - `nego_target(cap, rnd, settings)`
  - ✅ Replaced prior server-local negotiation constants with engine helpers.
  - ✅ Extended `PUT /api/settings` validation:
    - `nego_open_pct` 0..40
    - `nego_max_rounds` 1..8
    - `nego_style` in {gentle, balanced, aggressive, custom}
- Frontend
  - ✅ Settings page includes “Negotiation” card:
    - Preset segmented control
    - Numeric inputs
    - Editing numbers flips to `custom` mode indicator

#### C) Invite Links (owner UX) ✅ COMPLETE
User stories delivered:
1. ✅ Owner can generate an invite for a chosen client/supplier from People.
2. ✅ Owner can email the invite link.
3. ✅ Owner can copy the invite link.
4. ✅ Owner can see a list of recent invites and their status.
5. ✅ Tokens are one-time-use (accept → status accepted; reuse blocked for other users).

Implementation delivered:
- Frontend
  - ✅ `People.jsx` includes an Invite section with:
    - role toggle (client/supplier)
    - counterparty dropdown
    - optional email
    - create button
    - result box + copy button
    - recent invites list
- Backend
  - ✅ Invite email CTA points to `/invite/{token}`.

#### D) Approvals Badge ✅ COMPLETE
User stories delivered:
1. ✅ Owner sees pending approvals count next to “Approvals” in main nav.
2. ✅ Badge updates automatically via polling.
3. ✅ Approvals list remains source of truth.
4. ✅ Badge visible on mobile bottom nav.
5. ✅ Lightweight, resilient polling.

Implementation delivered:
- Backend
  - ✅ `GET /api/approvals/count` returns `{pending:int}`.
- Frontend
  - ✅ Added “Approvals” to NAV (desktop + mobile bottom nav).
  - ✅ Polls `/approvals/count` every 20s and displays badge when `pending>0`.
  - ✅ Mobile bottom nav adjusted to 7 items.

### Phase 3 — Testing & Validation ✅ COMPLETE (with noted pre-existing flakiness)
Completed checks:
- Backend
  - ✅ Smoke-tested new endpoints:
    - `/approvals/count`
    - negotiation settings validation (including expected 400s)
    - invite create/get/list/accept/404/409
    - `/buy/current` delivery fields
  - ✅ `tests/test_gapless.py` passed in isolation.
  - ⚠️ Full-suite pytest failures are **pre-existing / flaky** due to cross-test shared DB contamination:
    - reproduced even with session changes stashed (baseline)
- Frontend
  - ✅ Authenticated screenshots verified:
    - Negotiation card renders
    - Desktop top nav with 7 items looks OK
    - Mobile bottom nav with 7 items has **no overflow**
    - Approvals badge renders correctly when a pending approval exists
- Cleanup
  - ✅ Temporary pending approval and test Clerk users removed.

## 3) Next Actions
1. **User verification**: confirm delivery tracker, negotiation controls, invites, and approvals badge behave as expected in your workflow.
2. (Optional hardening) Stabilize the **full pytest suite** by isolating DB state per test module (known pre-existing issue).
3. (Optional enhancement) Add tighter E2E automation around Clerk invite acceptance and supplier delivery updates.

## 4) Success Criteria
- ✅ Supplier can update delivery only when they are the winner; owner sees status in Buy page and receives email alerts.
- ✅ Negotiation settings (preset + overrides) deterministically control counter targets and max rounds.
- ✅ Owner can generate invite links, email them, and invited users can accept to become linked roles.
- ✅ Approvals badge shows accurate pending count in main menu (desktop + mobile) and updates automatically.
- ✅ No regressions attributable to this change set; new functionality verified via smoke testing + authenticated UI screenshots.
