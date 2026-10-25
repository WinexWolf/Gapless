# Gapless PRD (status: Phase A + Phase B complete)
Demo app for Maria Alvarez / Bay Remodel Co. (synthetic data, single user, no auth).
## Built
- Deterministic engine (/app/backend/engine.py): seed, 28-day forecast (committed cash only), Friday gap -9,800 for any T, ranking (cost per expected $, friction, 115% target), guardrails, templates EN/ES friendly/firm, buy-side mandate checks, pay-early rule.
- API (/app/backend/server.py): demo load/reset/simulate-next, forecast, plan, drafts (LLM regenerate w/ 6s timeout + template fallback), approve(-all) -> simulated outbox + public offer token, offers accept/counter/decline, Stripe TEST checkout (claimable sandbox keys in backend/.env) + status polling + webhook, mark-paid fallback, counter decisions, threads, activity, settings, invoice parse/add, full Buy flow (request parse, sourcing rounds, sealed rfq threads, quotes, approve, pay decision, Link-style spend request charged with Stripe test PaymentIntent pm_card_visa, demo-mode fallback, shipment advance/delay/backup, receipt match).
- Frontend: Dashboard (gap bar 14 planks, weekly bars), Plan, Threads, Buy (Leaflet map), Public offer /o/:token (EN/ES, Pay now), Settings, Activity, Outbox, More (Add invoice). Floating Demo controls (Next/Reset/AI toggle).
- Week buckets: Payday = Fri F; Week k ends F+7(k-1)+3 (so the net+10 Pacific move at F+10 lands in Week 2 per spec numbers).
## Tests
- /app/backend/tests/test_gapless.py: 28 passing (run with -n 0).
## Backlog
- Optional: email/SMS real sending (out of scope), multi-user auth (out of scope).
