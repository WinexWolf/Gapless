# Gapless PRD (status: Phase A + Phase B complete)
Demo app for Maria Alvarez / Bay Remodel Co. (synthetic data, single user, no auth).
## Built
- Deterministic engine (/app/backend/engine.py): seed, 28-day forecast (committed cash only), Friday gap -9,800 for any T, ranking (cost per expected $, friction, 115% target), guardrails, templates EN/ES friendly/firm, buy-side mandate checks, pay-early rule.
- API (/app/backend/server.py): demo load/reset/simulate-next, forecast, plan, drafts (LLM regenerate w/ 6s timeout + template fallback), approve(-all) -> simulated outbox + public offer token, offers accept/counter/decline, Stripe TEST checkout (claimable sandbox keys in backend/.env) + status polling + webhook, mark-paid fallback, counter decisions, threads, activity, settings, invoice parse/add, full Buy flow (request parse, sourcing rounds, sealed rfq threads, quotes, approve, pay decision, Link-style spend request charged with Stripe test PaymentIntent pm_card_visa, demo-mode fallback, shipment advance/delay/backup, receipt match).
- Frontend: Dashboard (gap bar 14 planks, weekly bars), Plan, Threads, Buy (Leaflet map), Public offer /o/:token (EN/ES, Pay now), Settings, Activity, Outbox, More (Add invoice). Floating Demo controls (Next/Reset/AI toggle).
- Week buckets: Payday = Fri F; Week k ends F+7(k-1)+3 (so the net+10 Pacific move at F+10 lands in Week 2 per spec numbers).
## Tests
- /app/backend/tests/test_gapless.py: 28 passing (run with -n 0).
## v2 (done)
- Per-customer language toggle on Plan cards; Spanish drafts get /o/<token>?lang=es links; Outbox shows Español chip + "Open Spanish offer page".
- Split second-payment reminder (reminders collection), drafted 3 days before due on first payment; Maria approves, then "Send now (demo)" to outbox.
- Payday summary card on Dashboard when covered (GET /api/summary): items, cost $102.75, Share/Copy.
- Supplier scorecard (supplier_history collection, GET /api/suppliers/scorecard): on-time %, reply rate, negotiated savings, recent orders; quotes use it + reliability adjustment; each finished order appends history.
- Tests: 32 passing.
## Backlog
- Optional: email/SMS real sending (out of scope), multi-user auth (out of scope).


## v5 — Current requested additions
- Crew-safe payroll PNG: GET /api/summary/image.png?theme=light|dark, Python Pillow, bundled licensed Figtree, 1080x1350; blocked409 when uncovered; preview/download and native file share where supported.
- ThemeSync keeps data-theme, saved/system preference and favicon-light.svg/favicon-dark.svg aligned. EN/ES entire Landing with persisted language and document lang.
- First-time 3step spotlight tour, replay, keyboard/focus/inert handling; spring paywall and image sheets; translucent chrome but opaque financial figures. Specs: /app/interaction_spec.md (also public /interaction-spec.md).
- Stripe monthly demo TEST-only subscription at editable SAMPLE $19 USD/month. billing.py; anonymous HttpOnly cookie hash ownership; separate billing collections survive demo reset; active subscription gates actions/buy/settings/invoices/plan explanation/demo simulation. Reads, landing, public offers and PNG free. Test sandbox provisioned, full managed tax.
- Actual paid Stripe TEST fixtures, paid gating, cross-browser ownership, cancel-at-period-end, immediate cancel, PNG, all prior deterministic flows: 55 passed via `pytest -n 0 tests/test_gapless.py tests/test_billing_backend.py` (paid-regression.log). Never run shared-state suite with xdist.
- Hosted-card checkout completion/success return UNVERIFIED: automation fills actual main-frame card fields but stays on Stripe after Subscribe. Console shows Stripe hCaptcha hsw.js EvalError. No CAPTCHA bypass attempted. Do not repeat incorrect tester claims about inaccessible card iframes. Manual normal-browser test still required.
- Prior test helper containing hardcoded test secret was deleted. Test fixtures load env only and cancel fixture subscriptions on teardown.
- No live charges, no real messages; data/outbox/negotiations/delivery intentionally MOCKED. No new AI numerical decisions.
