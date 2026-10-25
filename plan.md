# Gapless — Admin Unlock + End-to-End Guided Walkthrough + Demo/Real Mode (Updated)

## 1) Objectives
- ✅ **Always-unlocked owner/admin mode** so the team never gets blocked by Stripe during demos.
  - Implemented via `PAYWALL_ENABLED=false`.
  - `/api/billing/status` returns `active=true, status="unlocked"`.
  - Mutations work without subscription/cookies.
- ✅ **Guided auto-play walkthrough** that runs **both** agent flows end-to-end:
  - Payroll-gap agent (cover Friday payroll) → Buying agent (source → pay → deliver → receipt match).
  - Delivered as a first-class UI at `/walkthrough`.
- ✅ **Demo vs Real mode switch** (Demo = autoplay/simulated replies; Real = manual/no auto-replies).
  - Stored in backend settings and exposed in UI.
- ✅ **Hide/soften “simulated/demo/synthetic” wording during the demo** while keeping all computations deterministic.
  - UI and key copy updated across app.
- ✅ Preserve core rule: **all money/date/math stays deterministic in Python**; LLM is only for text.

## 2) Implementation Steps

### Phase 1 — Core POC (isolation → fix until works)
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
    - Payroll sequencing includes “approve plan” (server-side `approve_all`) when actions are proposed.
    - Then uses existing deterministic simulators (`simulate_payroll`, `buy_next`).
  - ✅ Implemented `GET /api/demo/walkthrough/status` with compact progress state:
    - Payroll: `covered`, `resolved/selected`, `secured`, `gap`, `friday_label`
    - Buy: `stage`
  - Note: reset continues to use the existing `POST /api/demo/reset`.
- Frontend (React)
  - ✅ Implemented `/walkthrough` page with:
    - Play / Pause / Step once / Restart controls
    - Phase trail, progress bar, narration timeline
    - Done banner + CTAs (Dashboard / Threads / Buy / Payday image)
- Web research
  - Completed implicitly via implementation best practices (cancel-safe loop, hook order compliance).
- Testing (POC)
  - ✅ Verified via curl loop: walkthrough completes in ~18 steps to `done=true`.
  - ✅ Verified in UI with screenshots and autoplay.

### Phase 2 — V1 App Development (integrate into product UI)
**Goal:** Turn the POC into a polished guided demo experience matching the existing teal glassmorphic system.

User stories:
1. ✅ As an owner, I can toggle **Demo vs Real** mode globally and immediately see the UI adapt.
2. ✅ As an owner, in Demo mode I can run a guided end-to-end “Show me how it works” walkthrough.
3. ✅ As an owner, in Real mode I can operate the app manually (no autoplay) using existing screens.
4. ✅ As an owner, I don’t see “simulated/demo/synthetic” labels during a demo.
5. ✅ As an owner, I can share the “Payroll covered” image after the walkthrough completes.

Implementation:
- Mode system
  - ✅ Backend: added `mode: demo|real` to settings (`engine.DEFAULT_SETTINGS`, `/api/settings` write).
  - ✅ Frontend: added `ModeProvider` + header `ModePill` and a Settings “Mode” section.
  - ✅ Real mode behavior:
    - Blocks walkthrough endpoint with HTTP 400.
    - Makes `POST /api/demo/simulate-next` inert (returns `ok=false` + message).
    - Hides the floating `DemoControls` in Real mode.
- Guided walkthrough UI
  - ✅ Implemented `/walkthrough` as the primary guided demo surface.
  - ✅ Dashboard CTA added: “See it work” → `/walkthrough`.
  - ✅ Progress and narration UI added (glass-friendly, mobile-first).
- Hide/soften simulated wording
  - ✅ Footer changed to neutral “Gapless”.
  - ✅ Dashboard eyebrow softened (removed “SYNTHETIC DEMO”).
  - ✅ Outbox relabeled to “Outbox” + removed “Simulated” chip.
  - ✅ Plan / Threads / Buy strings removed “(demo)” / “(simulated)” suffixes.
  - ✅ Offer footer softened.
  - ✅ Landing copy softened (“synthetic data” removed, “simulated” phrasing revised).
  - ✅ Payday summary footer softened (“Gapless”).
- Always-unlocked admin mode (for now)
  - ✅ Backend: `billing.gate()` no-ops when `PAYWALL_ENABLED=false`.
  - ✅ Backend: `/api/billing/status` returns an unlocked active status when paywall disabled.
  - ✅ Frontend paywall UI is effectively non-blocking.
- Styling
  - ✅ Added walkthrough CSS to `App.css` aligned with existing tokens and dark theme handling.

Conclude Phase 2:
- ✅ Completed 1 round of end-to-end testing agent run + manual UI verification.

### Phase 3 — Stabilization + Test Coverage
User stories:
1. ✅ As an owner, walkthrough never gets stuck; errors show a clear recovery action.
2. ✅ As an owner, resetting always returns the walkthrough to the exact start.
3. ✅ As an owner, switching Demo/Real never corrupts data.
4. ✅ As an owner, paywall does not block in always-unlocked mode.
5. ✅ As an owner, existing flows (Plan/Buy/Threads/Offers) still work normally.

Implementation:
- Backend tests
  - ✅ Added `tests/test_walkthrough.py`:
    - verifies unlocked billing status
    - verifies mutation without billing cookie
    - verifies walkthrough end-to-end completion (payroll covered + buy done)
    - verifies Real mode blocks walkthrough and makes simulate-next inert
  - ✅ Updated paywall-gating tests to be skipped when `PAYWALL_ENABLED=false`.
    - Current test status: **54 passed / 7 skipped** (skips are intentional paywall tests).
- Frontend smoke validation
  - ✅ Testing agent: backend 100%, frontend 95%.
  - ✅ One blocked item was *not a bug* (tour overlay interfered with one automated click path).
  - ✅ Testing agent applied a correct React Hooks ordering fix in `DemoControls.jsx`.
- Audit
  - ✅ Major “simulated/demo/synthetic” strings softened as requested.

## 3) Next Actions
1. (Optional) Decide when to re-enable paywall enforcement for non-owner demos by setting `PAYWALL_ENABLED=true`.
   - If re-enabled, the previously skipped billing tests automatically resume.
2. (Optional polish) Add a “Guided Walkthrough” CTA to Landing (in addition to Dashboard/More).
3. (Optional polish) If desired, add a subtle “no real emails/charges” disclaimer in Real mode only, so demo mode stays clean.
4. (Optional) Add lightweight frontend automated tests for `/walkthrough` (Play/Restart) that avoid the Dashboard tour overlay.

## 4) Success Criteria
- ✅ Owners can use the app indefinitely without Stripe paywall blocking (always-unlocked mode).
- ✅ One guided walkthrough completes from fresh reset to:
  - ✅ Payroll covered state reached (Payday share image available)
  - ✅ Buy flow reaches done (delivery + receipt match)
- ✅ Demo vs Real switch persists and changes behavior:
  - Demo enables walkthrough/autoplay
  - Real disables walkthrough and auto-replies
- ✅ Demo experience does not show “simulated/demo/synthetic” wording in primary UI surfaces.
- ✅ All calculations remain deterministic in Python; no regression in core workflows/tests.
