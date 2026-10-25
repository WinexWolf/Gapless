# Gapless — Updated Implementation Plan (FINAL HANDOFF: Feature Complete → Stripe Hosted Checkout Manual Verification Pending)

## 0) Decision Log (explicit user decisions)
- **Stripe paywall**: **Monthly demo access** via **Stripe TEST subscription** checkout.
- **Demo constraints remain**: synthetic data only, single demo user, **no auth**, no live charges, no deployment requested.
- **Hard rule reaffirmed**: deterministic engine in Python for all math/forecasts/rankings/money decisions; LLM only for text generation/parsing/explanations.
- **Pricing**: **$19 USD / month** as an **editable SAMPLE** price.
- **Tax mode**: default to **Stripe-managed** ("full") when eligible; fall back to **calc-only** when ineligible.

---

## 1) Current State & Progress

### 1.1 What exists and is working (baseline)
- End-to-end full-stack prototype (React + FastAPI + MongoDB) implementing:
  - Distinct **Landing** page
  - **Dashboard**, **Cash Digest**, **Plan** flow
  - **Buy** flow (LLM parsing for requests) + **Delivery Map**
  - **Threads** with interactive messages
  - Public **Offer** page + Stripe test checkout for **one-time invoice payments**
- Deterministic backend engine (`engine.py`) handling all numerical logic.
- Theme system uses `data-theme` + CSS variables.

### 1.2 Completed items from the prior session (verified)
- High-contrast “Covered ✓” pill readability fix (`GapBar.jsx`, `App.css`).
- Standalone Landing page with hero gradient, live-demo badge, CTA (`Landing.jsx`).
- Global UI polish including shadows and button hover states (`App.css`).
- Dark Mode toggle with persistence.
- Confetti burst animation on first transition to “Covered”.
- Landing testimonial quote card.
- Mobile home link (bottom nav/More) to Landing.

### 1.3 NEW work implemented in this iteration (feature complete)
- **Payday Share Image (downloadable PNG)**
  - Backend: deterministic PNG generator (`/api/summary/image.png?theme=light|dark`) using Pillow (`payday_image.py`).
  - Frontend: “Payday image” button + preview dialog + **download** (`PaydayImage.jsx`).
  - Verified: **1080×1350**, correct filename **`gapless-payroll-covered.png`**, and **actual browser download** succeeds.
- **Theme-aware favicon**
  - Added `favicon-light.svg` and `favicon-dark.svg`.
  - Implemented live swapping via `ThemeSync` (`lib/theme.js`) updating `<link id="gapless-favicon">`.
  - Verified: dark mode shows brighter favicon.
- **First-time Dashboard Tour (3 steps)**
  - Spotlight overlay + tooltip with localStorage persistence (`DashboardTour.jsx`).
  - Dashboard “replay tour” control.
  - Accessibility: background inert while open; focus restored on close; **Escape close fixed**.
- **Spanish Landing Page**
  - Full EN/ES landing copy in `landingCopy.js`.
  - Language toggle on landing header with localStorage persistence (`gapless-lang`).
  - Verified: `documentElement.lang` updates (e.g., `es`).
- **Stripe Monthly Demo Access paywall**
  - Backend `billing.py`:
    - Cookie-bound browser identity (HttpOnly cookie `gapless_demo_access`), status endpoint, hosted Checkout subscription session creation, cancel-at-period-end.
    - Server-side gating of paywalled mutation routes (FastAPI dependency) → 402.
    - Webhook dispatch extended to sync subscription state.
  - Frontend:
    - `BillingProvider` + global 402 interceptor opens paywall (`PaywallSheet`).
    - Glass + spring sheets (`PaywallSheet.jsx`, `GlassDialog.jsx`, Motion tokens), return page (`BillingReturn.jsx`).
- **Glassmorphic UI + Apple-inspired motion pass**
  - Added glass material tokens + `.g-glass` + chrome translucency in `App.css`.
  - Introduced spring-driven components (`MotionButton`, `GlassDialog`) and `MotionConfig reducedMotion="user"`.
  - Verified: reduced-motion results in computed `transform: none` and `animation: none` for the sheet.
  - Fixed **light theme primary button hover** color contrast; verified computed color `rgb(255, 255, 255)`.

### 1.4 Testing status (authoritative)
- **Backend regression (paid gating + deterministic rules)**
  - ✅ **PASS**: `pytest -q -n 0 tests/test_gapless.py tests/test_billing_backend.py` → **55 passed** in **55.03s**.
  - Log: `/app/test_reports/paid-regression.log`.
  - Note: parallel xdist is **not valid** for these tests due to shared synthetic DB resets; **serial is authoritative**.
  - Test harness uses **real Stripe TEST subscriptions** via `pm_card_visa`, bound to the hashed cookie owner in Mongo, and cancels fixture subscriptions at teardown.
- **Frontend/UI verification**
  - ✅ PNG preview + **actual download**, dark/light theme, 1920×800 and 390×844 viewports.
  - ✅ No horizontal overflow observed.
  - ✅ Spanish landing copy and language toggle.
  - ✅ Theme-aware favicon swapping.
  - ✅ Tour behavior and paywall Escape key.
- **Stripe hosted checkout completion (manual verification pending)**
  - ⚠️ **UNVERIFIED**: completing hosted Checkout with card and returning to `/billing/return`.
  - Automation:
    - Confirmed card fields are accessible after selecting **Card** (not iframe-blocked).
    - Observed **hCaptcha / Stripe anti-bot JS eval errors** in automated runs; after Subscribe, no redirect occurred.
  - No bypass attempted. This remains a **manual sign-off** item.

---

## 2) Updated Objectives (new requests)

### 2.1 Feature requests (this iteration)
1. Payday Share Image (PNG export)
2. Theme-aware favicon
3. First-time 3-step Dashboard tour
4. Spanish Landing (EN/ES toggle)
5. Stripe monthly demo access subscription paywall
6. Glassmorphic + Apple-inspired spring motion polish

### 2.2 Objective status
- ✅ Implemented: (1)–(6)
- ⚠️ Remaining: **Hosted Stripe Checkout completion + success return manual verification** in a normal browser session (non-automated).

### 2.3 Non-goals / constraints (unchanged)
- No production deployment.
- No real customer data.
- No LLM-based numeric decision-making.
- No gesture-heavy new paradigms.

---

## 3) Discovery & Inputs Needed

### 3.1 Codebase exploration
- ✅ Completed.

### 3.2 Reference exploration
- ✅ Completed; design/motion deliverables created and updated:
  - `/app/design_guidelines.md`
  - `/app/interaction_spec.md` (**human-readable A–F spec**) and served as `/interaction-spec.md`.

### 3.3 Inputs still needed
- **User verification required**:
  - Manually complete a Stripe hosted **TEST** subscription checkout (Card) in a normal browser and confirm:
    - redirect to `/billing/return` occurs
    - `/api/billing/status` becomes `active: true`
    - gated actions succeed

---

## 4) Implementation Plan (phased)

### Phase A — Stripe TEST subscription paywall (Monthly demo access)
**Goal**: subscription checkout unlocks premium demo access **without auth**, enforced server-side.

#### A.1 Define paywall scope (locked vs free)
- ✅ Implemented
  - **Free reads**: Landing, dashboard reads, public offers, `/api/summary`, `/api/summary/image.png`.
  - **Paywalled mutations**: actions approvals, demo simulation, buy mutations, plan explanation, settings/invoices/reminders as implemented.

#### A.2 Backend: Stripe subscription integration
- ✅ Implemented in `billing.py`
  - Idempotent catalog provisioning via `lookup_key`.
  - Endpoints:
    - `GET /api/billing/status`
    - `POST /api/billing/checkout`
    - `POST /api/billing/cancel`
  - Cookie-bound identity via HttpOnly cookie (`gapless_demo_access`).
  - Mongo collections: `billing_access`, `billing_transactions`.

#### A.3 Backend: gating dependency
- ✅ Implemented
  - FastAPI dependency checks entitlement via Stripe refresh and returns 402 for locked mutations.

#### A.4 Frontend: paywall UX (glass + springs)
- ✅ Implemented
  - Global 402 interceptor opens `PaywallSheet`.
  - `BillingReturn` page polls status.
  - Mobile/desktop sheet behaviors via Framer Motion springs.

#### A.5 Testing
- ✅ Backend: 55/55 passing serial regression tests with real Stripe TEST subscription fixtures.
- ⚠️ Hosted UI completion: **manual verification pending**.

#### A.6 Risk mitigation / next step
- Automation can be blocked by Stripe anti-bot mechanisms; do **not** bypass.
- Next steps:
  1. **Manual test** (required for final sign-off): complete hosted checkout using test card `4242 4242 4242 4242`.
  2. If manual succeeds: document as verified; accept automation limitations.
  3. Optional: if the team wants to reduce Link interruptions for human users, consider Stripe Checkout `wallet_options` config changes (not required for correctness). Only do this if requested.

Deliverable status: paywall is implemented and backend-verified; **hosted completion awaits manual sign-off**.

---

### Phase B — Payday Share Image (downloadable PNG)
**Goal**: deterministic downloadable image of “Payroll covered” summary.

- ✅ Backend implemented: `GET /api/summary/image.png?theme=light|dark`
  - 1080×1350 PNG, DEMO labels, theme-aware palette.
  - Returns 409 if not covered.
- ✅ Frontend implemented:
  - `PaydayImage` dialog: preview + download + optional native share when supported.
- ✅ Verified: correct dimensions and **actual browser download** success.

---

### Phase C — Theme-aware favicon
**Goal**: swap favicon when theme changes.

- ✅ Added assets: `frontend/public/favicon-light.svg`, `favicon-dark.svg`.
- ✅ Implemented switching via `ThemeSync` in `lib/theme.js`.
- ✅ Verified: theme change updates favicon and theme-color.

---

### Phase D — First-time 3-step Dashboard tour
**Goal**: accessible guided overlay on first dashboard visit.

- ✅ Implemented with persistence + replay.
- ✅ Verified in mobile + desktop.
- ✅ Escape-to-close and inert cleanup verified.

---

### Phase E — Spanish Landing page toggle
**Goal**: Spanish-speaking owners can view the pitch in Spanish.

- ✅ Implemented full bilingual landing copy + segmented toggle.
- ✅ Persisted in `localStorage` as `gapless-lang`.
- ✅ Verified: Spanish copy renders; `documentElement.lang` updates.

---

### Phase F — Glassmorphic UI + Apple-inspired spring interactions
**Goal**: apply glass materials + spring motion per binding docs.

- ✅ Materials tokens and glass surfaces added to `App.css`.
- ✅ Spring motion via Framer Motion (no keyframes for sheet/tour movement).
- ✅ Reduced motion honored (`MotionConfig reducedMotion="user"` + CSS fallback).
- ✅ Verified: no overflow; improved hover contrast for light primary CTA.
- Spec: `/app/interaction_spec.md` and `/app/frontend/public/interaction-spec.md`.

---

## 5) Data Model / State Updates
- ✅ Billing collections persist across demo reset:
  - `billing_access` (browser id, subscription state)
  - `billing_transactions` (checkout session tracking)
- ✅ Local flags:
  - `gapless-tour-seen`
  - `gapless-lang`
- No deterministic engine changes required.

---

## 6) API & Routing Additions
- ✅ Billing
  - `GET /api/billing/status`
  - `POST /api/billing/checkout`
  - `POST /api/billing/cancel`
  - existing `POST /api/stripe/webhook` now syncs subscription state
- ✅ Share image
  - `GET /api/summary/image.png?theme=light|dark`
- ✅ Frontend routes
  - `/billing/return`
- ✅ Spec served
  - `/interaction-spec.md`

---

## 7) UI/UX Acceptance Criteria
- **Paywall**
  - ✅ Backend rejects gated mutations with 402 when locked.
  - ✅ Paid access/cancel-at-period-end verified in backend tests.
  - ⚠️ Hosted Checkout completion + return to app: **manual verification pending**.
- **Share PNG**
  - ✅ Download produces 1080×1350 image with DEMO label; readable in both themes; correct filename.
- **Favicon**
  - ✅ Favicon switches immediately on theme toggle and persists.
- **Tour**
  - ✅ Runs once; skip/back/next; replay; accessible; reduced motion compatible.
- **Spanish landing**
  - ✅ Full landing copy toggles EN/ES and persists.
- **Glass/motion**
  - ✅ Glass applied selectively; spring motion interruptible; reduced motion honored; hover contrast fixed.

---

## 8) Risk & Mitigation
- **Stripe hosted Checkout automation limitations**:
  - Automated browsers may trigger anti-bot (hCaptcha) and block completion.
  - **Mitigation**: manual sandbox verification; keep backend Stripe fixture tests for regression.
- **No-auth entitlement security**:
  - ✅ Cookie-bound HttpOnly identity; server-side Stripe refresh prevents spoofing.
- **PNG font stability**:
  - ✅ Bundled font fallback + system fallback.
- **Parallel backend tests**:
  - xdist introduces shared-state flakiness; keep critical suite serial.

---

## 9) Execution Order (final)
1. ✅ Implement glass tokens/classes + MotionConfig scaffolding.
2. ✅ Implement Stripe subscription paywall backend + frontend sheet/return + server gating.
3. ✅ Implement Dashboard tour.
4. ✅ Implement deterministic PNG share image.
5. ✅ Implement theme-aware favicon.
6. ✅ Implement Spanish landing toggle + translations.
7. ✅ Fix accessibility issue: Escape closes paywall.
8. ✅ Fix light primary hover contrast.
9. ✅ Run mandatory backend tests (serial) and record pass log.
10. ✅ Confirm actual PNG download, reduced motion, and responsive overflow.
11. **Remaining**: Manual Stripe hosted checkout verification (Card) + document result.

---

## 10) Deliverables
- ✅ Stripe TEST subscription paywall (“Monthly demo access”) with server-enforced gating and cookie-bound entitlements.
- ✅ Downloadable “Payroll covered” PNG (1080×1350) generated deterministically in Python.
- ✅ Theme-aware favicon swap on dark mode.
- ✅ First-time 3-step Dashboard tour with spotlight overlay and accessibility.
- ✅ EN/ES Landing toggle with full translated pitch.
- ✅ Glassmorphic material system + Apple-inspired spring/interruptible motion improvements.
- ✅ Backend regression pass log: `/app/test_reports/paid-regression.log` (55 passed).
- ✅ Authoritative summary: `/app/test_reports/final_verification.json`.
- ⚠️ **Manual verification pending**: hosted Stripe Checkout completion + redirect to `/billing/return` in a normal browser (automation shows Stripe anti-bot JS issues; no bypass attempted).
