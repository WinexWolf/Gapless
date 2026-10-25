# Gapless — Admin Unlock + End-to-End Guided Walkthrough + Demo/Real Mode → **Real Multi‑Party System** (Updated)

## 1) Objectives

### Completed (current state)
- ✅ **Always-unlocked owner/admin mode** so the team never gets blocked by Stripe during demos.
  - Implemented via `PAYWALL_ENABLED=false`.
  - `/api/billing/status` returns `active=true, status="unlocked"`.
  - Mutations work without subscription/cookies.
- ✅ **Guided auto-play walkthrough** that runs **both** agent flows end-to-end:
  - Payroll-gap agent (cover Friday payroll) → Buying agent (source → pay → deliver → receipt match).
  - Delivered as a first-class UI at `/walkthrough`.
- ✅ **Demo vs Real mode switch** (Demo = autoplay/simulated replies; Real = manual/no auto-replies).
  - Stored in backend settings and exposed in UI (header Mode pill + Settings).
- ✅ **Hide/soften “simulated/demo/synthetic” wording** during the demo.
- ✅ Preserve core rule: **all money/date/math stays deterministic in Python**; the LLM is only for text.

### New major direction (next objectives)
Turn **Real mode** into a real multi-party product where:
- 🎯 **Google sign-in for everyone** using Emergent-managed auth (Clerk) with `sign_in=["google"]`.
- 🎯 **Roles + portals**:
  - **Owner (admin)** uses the full Gapless app.
  - **Clients** have a portal to view/respond to payroll-related offers (commitments, partial payments, timing).
  - **Suppliers** have a portal to view/respond to buying-related quote requests and shipment updates.
- 🎯 **Real in-app inbox + messaging**:
  - People can message the agents; replies immediately affect the deterministic engine state.
- 🎯 **Real outbound email notifications** (Resend) to notify counterparties of new messages/requests.
  - Reply action occurs in the portal (email contains a secure deep link).
- 🎯 **Inbound email (two-way) later**:
  - Build webhook endpoint and ingestion pipeline.
  - Requires user-provided domain + DNS/MX setup and inbound email provider configuration.
- 🎯 **Seed the existing cast with real logins/portals** (Lee Bathroom, Johnson Kitchen, Pacific Lumber, Bayside, etc.).
- 🎯 **Agent autonomy toggle**:
  - “Act within my guardrails” (automatic when safe) vs “Always draft and wait for my approval.”
  - Map to deterministic guardrails (existing `require_approval` + thresholds); never let LLM decide money.

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation → fix until works) ✅
**Goal:** Prove an end-to-end “autoplay” controller can reliably advance both flows via deterministic backend plumbing.

User stories:
1. ✅ As an owner, I can press one button to run the next scripted step and see a clear status update.
2. ✅ As an owner, I can run payroll steps until payroll is covered.
3. ✅ As an owner, I can run buy steps until delivery is done.
4. ✅ As an owner, I can reset the system back to the beginning of the walkthrough.
5. ✅ As an owner, I can stop autoplay at any time and resume later.

Implementation:
- Backend (FastAPI)
  - ✅ Implemented `POST /api/demo/walkthrough/next` to execute one deterministic step across both agents.
  - ✅ Implemented `GET /api/demo/walkthrough/status`.
  - ✅ Uses existing deterministic simulators (`simulate_payroll`, `buy_next`).
- Frontend (React)
  - ✅ Implemented `/walkthrough` page with autoplay controls + narration.
- Testing
  - ✅ Verified via curl loop and UI screenshots.

### Phase 2 — V1 App Development (integrate into product UI) ✅
**Goal:** Turn the POC into a polished guided demo experience matching the teal glassmorphic system.

User stories:
1. ✅ Toggle **Demo vs Real** globally.
2. ✅ Run end-to-end guided walkthrough in Demo mode.
3. ✅ Real mode disables autoplay/simulate.
4. ✅ Demo copy is clean (no “simulated/synthetic” labels).
5. ✅ Share the “Payroll covered” image.

Implementation:
- ✅ Mode system (backend + frontend)
- ✅ Walkthrough UI + dashboard CTA
- ✅ Copy cleanup
- ✅ Always-unlocked admin mode (for now)

### Phase 3 — Stabilization + Test Coverage ✅
User stories:
1. ✅ Walkthrough never gets stuck.
2. ✅ Reset is reliable.
3. ✅ Mode switch is safe.
4. ✅ Paywall doesn’t block.
5. ✅ Core flows still work.

Implementation:
- ✅ Added `tests/test_walkthrough.py`.
- ✅ Paywall tests are skipped when paywall is disabled.
- ✅ One testing-agent fix applied to `DemoControls.jsx` (React Hooks order).

---

### Phase 4 — Auth foundation (Real multi-party) 🔜
**Goal:** Add real identity, roles, and route gating so multiple real users can participate.

User stories:
1. As an owner, I can sign in with Google.
2. As a client/supplier, I can sign in with Google and see only my portal.
3. As an owner/admin, I can map/link a signed-in Google user to a seeded counterparty.
4. As an owner/admin, I can manage role assignment (owner/client/supplier) and counterparty linkage.

Implementation:
- Backend
  - Add Emergent-managed **Clerk** integration (Google only) and protect routes with `require_user`.
  - Add `/api/me` returning auth + role + linked counterparty identity.
  - Add roles model: `owner_admin`, `client`, `supplier`.
  - Add **ADMIN_EMAIL** list to bootstrap first owner-admin(s).
  - Add DB mapping table/collection:
    - `user_profiles`: `{ user_id, role, env, linked_counterparty_id? }`
    - `counterparties`: seeded entities for the existing cast.
  - Gate existing endpoints:
    - Owner app endpoints require role `owner_admin`.
    - Client portal endpoints require role `client` and a linked counterparty.
    - Supplier portal endpoints require role `supplier` and a linked counterparty.
- Frontend
  - Add Clerk provider + `/sign-in/*` route and header user button.
  - Add role-based routing:
    - Owner → existing app shell.
    - Client portal → `/portal/client`.
    - Supplier portal → `/portal/supplier`.
  - Add owner-only screen: “People” (admin) to link Google accounts to counterparties.

Testing:
- Backend tests for:
  - 401 when not signed-in
  - role gating (403)
  - user isolation (client can’t see other client data)

---

### Phase 5 — Portals + in-app inbox + real replies 🔜
**Goal:** Replace simulation in Real mode with real counterparty interactions through portals.

User stories:
1. As a client, I can view offers/messages about early pay / split pay and respond (accept/decline/counter).
2. As a supplier, I can view quote requests and respond with quotes / counters / availability.
3. As the owner, I see replies in Threads/Buy immediately and the deterministic engine updates state.
4. As the owner, I can choose: auto-act within guardrails or require approvals.

Implementation:
- Backend
  - Add message/inbox model:
    - `messages`: `{ id, thread_id, from_user_id, from_role, to_counterparty_id, scope(payroll|buy), body, ts, status }`
  - Add portal endpoints:
    - Client actions: accept offer, counter, commit to pay date/amount.
    - Supplier actions: submit quote, counter, confirm shipment timing.
  - Wire portal replies to deterministic engine transitions:
    - Reuse existing action resolution logic used by `simulate_payroll()` but triggered by a real reply.
    - Reuse existing buy thread update logic used by `buy_next()` but triggered by supplier responses.
  - Add autonomy toggle semantics:
    - When “act within guardrails”: auto-advance safe steps (still deterministic).
    - When “draft and wait”: generate drafts and require owner approval before outbound messages.
- Frontend
  - Build Client portal UI: inbox, offer cards, response actions.
  - Build Supplier portal UI: quote request cards, negotiation timeline, submit quote.
  - Owner UI updates:
    - Threads and Buy screens show **real** counterparties + reply statuses.

Testing:
- End-to-end tests:
  - owner sends request → client/supplier sees it → responds → owner sees updated state.

---

### Phase 6 — Real outbound email notifications (Resend) 🔜
**Goal:** Send real emails when new portal messages/requests are created.

User stories:
1. As a client/supplier, I get an email when the agent needs me.
2. Email contains a secure deep-link to the portal thread.

Implementation:
- Backend
  - Integrate Resend (Emergent-managed email) for outbound.
  - Add email templates (deterministic data; LLM only for optional text polish).
  - Add rate limiting + idempotency to avoid double sends.
- Frontend
  - Ensure deep links land signed-in users on the right portal thread.

Testing:
- Provider sandbox tests + local “dry run” logs.

---

### Phase 7 — Inbound email (two-way) webhook 🔜
**Goal:** Allow counterparties to reply via email; system ingests reply and updates the deterministic engine.

User stories:
1. As a client/supplier, I can reply to an email and it appears in the in-app inbox.
2. Agents react (auto within guardrails or draft for owner approval).

Implementation:
- Backend
  - Add `/api/email/inbound/webhook` endpoint for inbound provider callbacks.
  - Parse inbound email → map to thread/counterparty using reply tokens.
  - Store inbound message and trigger deterministic engine updates.
- Ops / configuration (user-required)
  - Provide step-by-step checklist for domain + DNS/MX + inbound provider configuration.

Testing:
- Webhook replay fixtures.

---

## 3) Next Actions
1. Implement **Phase 4 (Auth foundation)** with Clerk (Google-only) + roles + admin linking UI.
2. Implement **Phase 5 (Portals + in-app inbox)**: client/supplier portals and real reply wiring.
3. Add **Phase 6 (Resend outbound email notifications)**.
4. Add **Phase 7 (Inbound email webhook)** and provide DNS/domain setup instructions.
5. Revisit paywall strategy:
   - Keep `PAYWALL_ENABLED=false` during build.
   - Decide how/when to re-enable Stripe gating for non-admin access later.

---

## 4) Success Criteria

### Demo system (already achieved)
- ✅ Owners can demo indefinitely without Stripe blocking.
- ✅ Guided walkthrough completes: payroll covered + buying done.
- ✅ Demo wording is clean.

### Real multi-party system (new)
- ✅ Google sign-in works for owner, clients, suppliers.
- ✅ Role-based access is enforced on backend and frontend.
- ✅ Seeded cast can log in and respond from their portals.
- ✅ Real replies drive deterministic engine updates (no LLM money decisions).
- ✅ Owner can choose autonomy mode: auto-act within guardrails vs draft-and-approve.
- ✅ Real outbound email notifications are delivered (Resend).
- ✅ Inbound email replies can be ingested via webhook once domain/DNS is configured.
