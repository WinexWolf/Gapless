"""Tests for owner always-unlocked mode, the Demo/Real mode switch and the
guided end-to-end walkthrough. All money/date math stays in the Python engine;
these only verify sequencing and access behavior."""
import os
import requests

B = os.environ.get("GAPLESS_API", "http://localhost:8001/api")
ORIGIN = "https://bay-remodel-cash.preview.emergentagent.com"


def _reset():
    requests.post(f"{B}/demo/reset", json={}, timeout=15)


def _set_mode(mode):
    r = requests.put(f"{B}/settings", json={"mode": mode}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_always_unlocked_billing_status():
    r = requests.get(f"{B}/billing/status", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["active"] is True
    assert data["status"] == "unlocked"


def test_mutation_allowed_without_billing_cookie():
    # A fresh session with no billing cookie can still mutate (paywall off).
    _reset()
    s = requests.Session()
    r = s.post(f"{B}/actions/approve-all", json={"origin_url": ORIGIN}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["approved"] >= 1


def test_mode_defaults_to_demo_after_reset():
    _reset()
    r = requests.get(f"{B}/settings", timeout=15)
    assert r.json().get("mode") == "demo"


def test_walkthrough_runs_both_agents_end_to_end():
    _set_mode("demo")
    _reset()
    done = False
    covered = None
    phases = set()
    for _ in range(40):
        r = requests.post(f"{B}/demo/walkthrough/next", json={"origin_url": ORIGIN}, timeout=20)
        assert r.status_code == 200, r.text
        step = r.json()
        phases.add(step["phase"])
        if step.get("done"):
            done = True
            covered = step.get("covered")
            break
    assert done, "Walkthrough never reached the done state"
    assert covered is True, "Payroll should be covered at the end of the walkthrough"
    # Both agents must have run.
    assert "payroll" in phases and "buy" in phases
    # Backend state agrees.
    st = requests.get(f"{B}/demo/walkthrough/status", timeout=15).json()
    assert st["payroll"]["covered"] is True
    assert st["buy"]["stage"] == "done"


def test_walkthrough_blocked_in_real_mode():
    try:
        _set_mode("real")
        r = requests.post(f"{B}/demo/walkthrough/next", json={"origin_url": ORIGIN}, timeout=20)
        assert r.status_code == 400
        assert "Demo mode" in r.text
    finally:
        _set_mode("demo")


def test_simulate_next_is_inert_in_real_mode():
    try:
        _set_mode("real")
        r = requests.post(f"{B}/demo/simulate-next", json={}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is False
        assert "Real mode" in body["message"]
    finally:
        _set_mode("demo")
        _reset()
