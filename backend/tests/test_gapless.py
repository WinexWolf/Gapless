"""Gapless acceptance tests (section 11). Run: cd /app/backend && pytest -q tests/test_gapless.py"""
import os
import sys
import time
from datetime import date, timedelta

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import engine as E  # noqa: E402

B = os.environ.get("GAPLESS_API", "http://localhost:8001/api")
ORIGIN = "https://example.test"


def post(path, json=None, ok=True):
    r = requests.post(B + path, json=json or {}, timeout=30)
    if ok:
        assert r.status_code == 200, (path, r.status_code, r.text)
    return r


def get(path, **params):
    r = requests.get(B + path, params=params, timeout=30)
    assert r.status_code == 200, (path, r.text)
    return r.json()


@pytest.fixture(autouse=True)
def fresh():
    post("/demo/reset")
    yield
    requests.put(B + "/settings", json={"llm_force_fail": False, "supplier_has_ai": True}, timeout=10)


# 1 ------------------------------------------------------------------
@pytest.mark.parametrize("offset", range(14))
def test_friday_is_minus_9800_for_any_today(offset):
    T = date(2026, 1, 1) + timedelta(days=offset)
    data = E.seed_docs(T)
    fc = E.forecast(data, T)
    assert E.friday_for(T).weekday() == 4 and E.friday_for(T) > T
    assert fc["friday_balance"] == -9800.00
    assert [w["balance"] for w in fc["weeks"]] == [-9800.0, -10300.0, -6700.0, -12200.0]


def test_api_friday_and_ranking():
    d = get("/forecast")
    assert d["forecast"]["friday_balance"] == -9800.0
    assert d["status"]["gap"] == 9800.0
    p = get("/plan")
    assert p["target"] == 11270.0 and p["expected_total"] == 11541.0
    assert [a["id"] for a in p["actions"]] == ["act_lee", "act_johnson", "act_pacific", "act_patel"]
    assert all(a["selected"] for a in p["actions"])
    assert {x["id"] for x in p["alternatives"]} == {"alt_patel", "alt_johnson"}


# 2 ------------------------------------------------------------------
def test_plan_under_2s():
    t = time.time()
    get("/plan")
    assert time.time() - t < 2.0


# 3 ------------------------------------------------------------------
def test_approve_creates_outbox_and_link():
    r = post("/actions/act_lee/approve", {"origin_url": ORIGIN}).json()
    assert r["link"].startswith(ORIGIN + "/o/") and len(r["token"]) >= 20
    out = get("/outbox")["items"]
    assert len(out) == 1 and r["link"] in out[0]["body"] and "STOP" in out[0]["body"]
    assert "billing assistant" in out[0]["body"]
    o = get(f"/offers/{r['token']}")
    assert o["counterparty"] == "Lee Bathroom" and o["status"] == "open"
    assert "contact" not in o and "probability" not in str(o)
    assert requests.get(B + "/offers/not-a-real-token", timeout=10).status_code == 404


# 4 ------------------------------------------------------------------
def test_public_accept_counter_decline_update_thread():
    post("/actions/approve-all", {"origin_url": ORIGIN})
    plan = {a["id"]: a for a in get("/plan")["actions"]}
    post(f"/offers/{plan['act_johnson']['offer_token']}/accept")
    post(f"/offers/{plan['act_lee']['offer_token']}/decline")
    post(f"/offers/{plan['act_patel']['offer_token']}/counter", {"percent": 1.75})
    th = {t["action_id"]: t for t in get("/threads")["threads"]}
    assert th["act_johnson"]["status"] == "accepted"
    assert th["act_lee"]["status"] == "declined"
    assert th["act_patel"]["status"] == "countered" and th["act_patel"]["pending_counter"]["percent"] == 1.75
    kinds = [m["kind"] for m in th["act_patel"]["messages"]]
    assert "counter" in kinds and "guardrail" in kinds
    post("/actions/act_patel/counter-decision", {"accept": True})
    a = {x["id"]: x for x in get("/plan")["actions"]}["act_patel"]
    assert a["status"] == "accepted" and a["cash_by_deadline"] == 4716.0


# 5 + 6 --------------------------------------------------------------
def test_payment_marks_paid_and_covers():
    post("/actions/approve-all", {"origin_url": ORIGIN})
    post("/actions/act_lee/mark-paid")
    st = get("/forecast")["status"]
    assert st["secured"] == 3600.0 and st["remaining"] == 6200.0 and not st["covered"]
    post("/actions/act_patel/mark-paid")
    post("/actions/act_johnson/mark-paid")
    d = get("/forecast")
    st = d["status"]
    assert st["secured"] == 11428.0 and st["remaining"] == 0 and st["covered"] and st["spare"] == 1628.0
    assert d["forecast"]["friday_balance"] == 1628.0
    assert [w["balance"] for w in d["forecast"]["weeks"]] == [1628.0, 1128.0, 7828.0, 2328.0]
    post("/demo/simulate-next")  # Pacific AI agent lane
    d = get("/forecast")
    assert [w["balance"] for w in d["forecast"]["weeks"]] == [5728.0, 1097.25, 7797.25, 2297.25]


def test_stripe_checkout_session_created():
    tok = post("/actions/act_lee/approve", {"origin_url": ORIGIN}).json()["token"]
    post(f"/offers/{tok}/accept")
    r = post("/payments/checkout", {"token": tok, "origin_url": ORIGIN}, ok=False)
    assert r.status_code in (200, 502)
    if r.status_code == 200:
        assert "checkout.stripe.com" in r.json()["url"]
        s = get("/payments/status", session_id=r.json()["session_id"])
        assert s["payment_status"] in ("pending", "unpaid")


def test_simulator_next_x4_covers():
    post("/actions/approve-all", {"origin_url": ORIGIN})
    msgs = [post("/demo/simulate-next").json()["message"] for _ in range(4)]
    assert "Lee" in msgs[0] and "Patel" in msgs[1] and "Johnson" in msgs[2] and "Pacific" in msgs[3]
    st = get("/forecast")["status"]
    assert st["covered"] and st["secured"] == 15528.0
    th = {t["action_id"]: t for t in get("/threads")["threads"]}
    assert th["act_pacific"]["badge"] == "Agent <-> Agent"


# 7 ------------------------------------------------------------------
def test_reset_restores_exactly():
    before = get("/plan")
    post("/actions/approve-all", {"origin_url": ORIGIN})
    post("/demo/simulate-next")
    post("/demo/reset")
    after = get("/plan")
    strip = lambda p: [(a["id"], a["status"], a["cash_by_deadline"], a["rank"]) for a in p["actions"]]
    assert strip(before) == strip(after)
    assert get("/outbox")["items"] == [] and get("/threads")["threads"] == []
    assert get("/forecast")["forecast"]["friday_balance"] == -9800.0
    assert get("/buy/current")["request"]["stage"] == "request"


# 9 ------------------------------------------------------------------
def test_llm_failure_fallbacks():
    requests.put(B + "/settings", json={"llm_force_fail": True}, timeout=10)
    d = post("/actions/act_lee/draft", {"regenerate": True, "tone": "firm", "language": "es"}).json()
    assert d["source"].startswith("template") and "STOP" in d["body"]
    assert post("/plan/explain").json()["source"] == "template"
    inv = post("/invoices/parse", {"text": "Invoice INV-2001 from Garcia Patio, $1,850 due 2026-11-12"}).json()
    assert inv["source"] == "fallback" and inv["fields"]["amount"] == 1850.0
    req = post("/buy/requests", {"text": "please get some wood, keep under $3,600"}).json()
    assert req["parse_source"].startswith("fallback") and len(req["items"]) == 3


# 10 -----------------------------------------------------------------
def test_counter_above_guardrail_rejected_by_code():
    post("/actions/approve-all", {"origin_url": ORIGIN})
    plan = {a["id"]: a for a in get("/plan")["actions"]}
    r = post(f"/offers/{plan['act_patel']['offer_token']}/counter", {"percent": 3}).json()
    assert r["guardrail"]["blocked"] and r["status"] == "open"
    r2 = post(f"/offers/{plan['act_pacific']['offer_token']}/counter", {"percent": 1.5}).json()
    assert r2["guardrail"]["blocked"]
    th = {t["action_id"]: t for t in get("/threads")["threads"]}
    texts = " ".join(m["text"] for m in th["act_patel"]["messages"] if m["kind"] == "guardrail")
    assert "above Maria's 2.0% early-pay limit" in texts
    assert th["act_patel"]["status"] == "approved"


# 11-14 buy ----------------------------------------------------------
def run_sourcing():
    rid = get("/buy/current")["request"]["id"]
    post(f"/buy/{rid}/start")
    for _ in range(3):
        post(f"/buy/{rid}/advance")
    return rid


def test_buy_counter_above_mandate_rejected():
    rid = get("/buy/current")["request"]["id"]
    post(f"/buy/{rid}/start")
    r = post(f"/buy/{rid}/counter", {"supplier_id": "pacific", "price": 3700}, ok=False)
    assert r.status_code == 400 and "above your $3,600 limit" in r.json()["detail"]
    assert post(f"/buy/{rid}/counter", {"supplier_id": "pacific", "price": 3450}).status_code == 200


def test_pay_early_blocked_then_allowed():
    rid = run_sourcing()
    cur = get("/buy/current")
    q = {x["supplier_id"]: x for x in cur["quotes"]}
    assert q["pacific"]["total"] == 3390.0 and q["bayside"]["total"] == 3370.0 and q["pacific"]["recommended"]
    assert cur["compare"] == "Pacific costs $20 more, but net+10 keeps $3,370 out of Friday's gap."
    post(f"/buy/{rid}/approve-quote", {"supplier_id": "pacific"})
    po = get("/buy/current")["pay_options"]
    assert po["early"]["amount"] == 3322.2 and not po["early"]["allowed"]
    r = post(f"/buy/{rid}/pay-decision", {"choice": "early"}, ok=False)
    assert r.status_code == 400 and r.json()["detail"].startswith("Not yet: paying early would leave Friday at -$")
    post("/actions/approve-all", {"origin_url": ORIGIN})
    for _ in range(3):
        post("/demo/simulate-next")
    po = get("/buy/current")["pay_options"]
    assert not po["early"]["allowed"]  # F = +1,628 -> still blocked
    post("/demo/simulate-next")  # Pacific extension accepted -> F = +5,728
    po = get("/buy/current")["pay_options"]
    assert po["early"]["allowed"] and po["early"]["friday_after"] == 2405.8
    post(f"/buy/{rid}/pay-decision", {"choice": "early"})
    cur = post(f"/buy/{rid}/spend-request/approve", {"approve": True}).json()
    assert cur["request"]["spend_request"]["status"] == "paid"
    assert cur["friday_balance"] == 2405.8
    assert get("/forecast")["status"]["secured"] == 15528.0  # buy never counts as secured


def test_supplier_threads_are_sealed():
    rid = run_sourcing()
    th = {t["supplier_id"]: t for t in get("/buy/current")["threads"]}
    blob = lambda t: " ".join((m["text"] or "") + str(m.get("structured") or "") for m in t["messages"])
    pac, bay = blob(th["pacific"]), blob(th["bayside"])
    for limit in ("3,600", "3600"):
        assert limit not in pac and limit not in bay and limit not in blob(th["eastbay"])
    for p in ("3,310", "3310", "3,370", "3370"):
        assert p not in pac
    for p in ("3,520", "3520", "3,400", "3400", "3,390", "3390"):
        assert p not in bay


def test_delay_raises_alert_and_receipt_matches():
    rid = run_sourcing()
    post(f"/buy/{rid}/approve-quote", {"supplier_id": "pacific"})
    post(f"/buy/{rid}/pay-decision", {"choice": "due"})
    post(f"/buy/{rid}/spend-request/approve", {"approve": True})
    cur = post(f"/buy/{rid}/shipment/delay").json()
    assert cur["shipment"]["alert"]["text"] == "Truck will miss your 7:00 AM deadline" and cur["shipment"]["eta"] == "7:30 AM"
    for _ in range(4):
        post(f"/buy/{rid}/shipment/advance")
    cur = post(f"/buy/{rid}/receipt/match").json()
    assert cur["shipment"]["matched"]["ok"] and cur["request"]["stage"] == "done"
