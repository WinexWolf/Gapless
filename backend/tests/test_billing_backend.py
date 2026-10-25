"""Backend billing tests - subscription fixtures, security, and PNG generation.

Tests the actual attachment of Stripe test subscriptions to browser cookies and
verifies protected action gating works correctly.
"""
import hashlib
import os
import secrets
import time

import pytest
import requests
from PIL import Image
from io import BytesIO

B = os.environ.get("GAPLESS_API", "http://localhost:8001/api")
ORIGIN = "https://bay-remodel-cash.preview.emergentagent.com"
WRONG_ORIGIN = "https://evil.com"


def test_stripe_key_is_test_mode():
    """Verify we're using test Stripe keys."""
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    assert key.startswith("sk_test_"), "Must use Stripe test key, not live"


def test_unpaid_browser_gets_cookie_and_locked_status():
    """Test that unpaid browser gets HTTPOnly cookie and locked status."""
    session = requests.Session()
    session.headers.update({"Origin": ORIGIN})
    
    # First call to /billing/status should set cookie
    r = session.get(f"{B}/billing/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    
    # Should have cookie set
    assert COOKIE_NAME in session.cookies
    cookie = session.cookies.get(COOKIE_NAME)
    assert len(cookie) >= 32
    
    # Status should be locked
    assert data["active"] is False
    assert data["status"] == "locked"
    assert data["checkout_ready"] is True
    assert data["test_mode"] is True
    print(f"✓ Unpaid browser: cookie set, status locked")


def test_paid_subscription_shows_active(paid_session, stripe_test_subscription):
    """Test that browser with paid subscription shows active status."""
    r = paid_session.get(f"{B}/billing/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    
    assert data["active"] is True, f"Expected active=True, got {data}"
    assert data["status"] == "active"
    assert data["period_end"] is not None
    print(f"✓ Paid subscription: active=True, status=active, period_end={data['period_end']}")


def test_protected_actions_blocked_without_billing(unpaid_session):
    """Test that protected actions return 402 without billing."""
    # Reset demo first
    r = unpaid_session.post(f"{B}/demo/reset", json={}, timeout=10)
    assert r.status_code == 200
    
    # Try to approve action without billing
    r = unpaid_session.post(
        f"{B}/actions/act_lee/approve",
        json={"origin_url": ORIGIN},
        timeout=10
    )
    assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text}"
    assert "Monthly demo access is needed" in r.text
    print(f"✓ Protected action blocked: 402 Payment Required")


def test_protected_actions_allowed_with_billing(paid_session):
    """Test that protected actions work with paid subscription."""
    # Reset demo first
    r = paid_session.post(f"{B}/demo/reset", json={}, timeout=10)
    assert r.status_code == 200
    
    # Approve action with billing
    r = paid_session.post(
        f"{B}/actions/act_lee/approve",
        json={"origin_url": ORIGIN},
        timeout=10
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert "token" in data
    assert "link" in data
    print(f"✓ Protected action allowed: 200 OK, token={data['token'][:20]}...")


def test_checkout_returns_409_when_already_active(paid_session):
    """Test that /billing/checkout returns 409 when subscription already active."""
    r = paid_session.post(
        f"{B}/billing/checkout",
        json={"lookup_key": "gapless_demo_monthly_v1", "origin_url": ORIGIN},
        timeout=10
    )
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    assert "already active" in r.text.lower()
    print(f"✓ Checkout blocked when active: 409 Conflict")


def test_cancel_subscription_sets_cancel_at_period_end(paid_session, stripe_test_subscription):
    """Test that /billing/cancel sets cancel_at_period_end=true but keeps active."""
    # Cancel subscription
    r = paid_session.post(f"{B}/billing/cancel", json={}, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    
    assert data["cancel_at_period_end"] is True
    assert data["active"] is True  # Still active until period end
    assert data["status"] == "active"
    print(f"✓ Cancel subscription: cancel_at_period_end=True, still active")


def test_cancel_immediately_via_sdk_makes_inactive(paid_session, stripe_test_subscription):
    """Test that canceling subscription immediately via SDK makes it inactive."""
    import stripe
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    
    # Cancel immediately (not at period end)
    stripe.Subscription.delete(stripe_test_subscription["subscription_id"])
    
    # Wait a moment for sync
    time.sleep(1)
    
    # Check status with refresh=True
    r = paid_session.get(f"{B}/billing/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    
    assert data["active"] is False, f"Expected active=False after immediate cancel, got {data}"
    assert data["status"] == "canceled"
    print(f"✓ Immediate cancel via SDK: active=False, status=canceled")


def test_protected_actions_return_402_after_cancel(paid_session, stripe_test_subscription):
    """Test that protected actions return 402 after subscription canceled."""
    import stripe
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    
    # Cancel immediately
    stripe.Subscription.delete(stripe_test_subscription["subscription_id"])
    time.sleep(1)
    
    # Try protected action
    r = paid_session.post(
        f"{B}/actions/act_lee/approve",
        json={"origin_url": ORIGIN},
        timeout=10
    )
    assert r.status_code == 402, f"Expected 402 after cancel, got {r.status_code}: {r.text}"
    print(f"✓ Protected action after cancel: 402 Payment Required")


def test_second_browser_cannot_verify_first_session():
    """Test that second browser cannot verify first browser's session ID."""
    # Create first browser session
    session1 = requests.Session()
    session1.headers.update({"Origin": ORIGIN})
    r1 = session1.get(f"{B}/billing/status", timeout=10)
    assert r1.status_code == 200
    
    checkout = session1.post(f"{B}/billing/checkout", json={"origin_url": ORIGIN}, timeout=30)
    assert checkout.status_code == 200, checkout.text
    fake_session_id = checkout.json()["session_id"]
    
    # Try to verify with second browser (no cookie from first)
    session2 = requests.Session()
    session2.headers.update({"Origin": ORIGIN})
    r2 = session2.get(f"{B}/billing/status", params={"session_id": fake_session_id}, timeout=10)
    
    # Should return 404 because session not found for this browser
    # OR return 200 with locked status if session_id is invalid
    # The key is that it doesn't grant access
    assert r2.status_code == 404
    print("Second browser cannot verify another browser's checkout")


def test_invalid_webhook_signature_returns_400():
    """Test that invalid webhook signature returns 400."""
    r = requests.post(
        f"{B}/stripe/webhook",
        json={"type": "checkout.session.completed", "data": {"object": {"id": "cs_test_123"}}},
        headers={"stripe-signature": "invalid_signature"},
        timeout=10
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    assert "Invalid signature" in r.text
    print(f"✓ Invalid webhook signature: 400 Bad Request")


def test_checkout_with_wrong_origin_returns_403(unpaid_session):
    """Test that checkout with wrong origin returns 403."""
    session = requests.Session()
    session.headers.update({"Origin": WRONG_ORIGIN})
    
    # Get cookie first
    r = session.get(f"{B}/billing/status", timeout=10)
    assert r.status_code == 200
    
    # Try checkout with wrong origin
    r = session.post(
        f"{B}/billing/checkout",
        json={"lookup_key": "gapless_demo_monthly_v1", "origin_url": WRONG_ORIGIN},
        timeout=10
    )
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "must come from Gapless" in r.text or "must match" in r.text
    print(f"✓ Wrong origin: 403 Forbidden")


def test_checkout_with_unknown_lookup_returns_400(paid_session):
    """Test that checkout with unknown lookup key returns 400."""
    # First cancel existing subscription
    import stripe
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    
    # Get current subscription from session fixture
    r = paid_session.get(f"{B}/billing/status", timeout=10)
    data = r.json()
    
    # We need to test with unpaid session for this
    session = requests.Session()
    session.headers.update({"Origin": ORIGIN})
    r = session.get(f"{B}/billing/status", timeout=10)
    
    r = session.post(
        f"{B}/billing/checkout",
        json={"lookup_key": "unknown_plan_key", "origin_url": ORIGIN},
        timeout=10
    )
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    assert "Unknown plan" in r.text
    print(f"✓ Unknown lookup key: 400 Bad Request")


def test_checkout_extra_fields_rejected_422():
    """Test that checkout with extra fields is rejected with 422."""
    session = requests.Session()
    session.headers.update({"Origin": ORIGIN})
    r = session.get(f"{B}/billing/status", timeout=10)
    
    r = session.post(
        f"{B}/billing/checkout",
        json={
            "lookup_key": "gapless_demo_monthly_v1",
            "origin_url": ORIGIN,
            "extra_field": "should_be_rejected"
        },
        timeout=10
    )
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
    print(f"✓ Extra fields in payload: 422 Unprocessable Entity")


def test_png_export_blocked_when_not_covered(paid_session):
    """Test that PNG export returns 409 when payroll not covered."""
    # Reset demo to uncovered state
    r = paid_session.post(f"{B}/demo/reset", json={}, timeout=10)
    assert r.status_code == 200
    
    # Try to get PNG
    r = paid_session.get(f"{B}/summary/image.png", params={"theme": "light"}, timeout=10)
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    assert "isn't covered yet" in r.text.lower()
    print(f"✓ PNG export blocked when not covered: 409 Conflict")


def test_png_export_light_theme_dimensions(paid_session):
    """Test PNG export with light theme returns correct dimensions."""
    # Reset and cover payroll
    paid_session.post(f"{B}/demo/reset", json={}, timeout=10)
    paid_session.post(f"{B}/actions/approve-all", json={"origin_url": ORIGIN}, timeout=10)
    
    # Simulate payments to cover
    for _ in range(4):
        paid_session.post(f"{B}/demo/simulate-next", json={}, timeout=10)
    
    # Check if covered
    r = paid_session.get(f"{B}/summary", timeout=10)
    data = r.json()
    assert data.get("covered"), "Paid fixture actions must cover payroll before PNG test"
    
    # Get PNG with light theme
    r = paid_session.get(f"{B}/summary/image.png", params={"theme": "light"}, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.headers["Content-Type"] == "image/png"
    
    # Verify dimensions
    img = Image.open(BytesIO(r.content))
    assert img.size == (1080, 1350), f"Expected 1080x1350, got {img.size}"
    print(f"✓ PNG light theme: 200 OK, dimensions {img.size}")


def test_png_export_dark_theme_dimensions(paid_session):
    """Test PNG export with dark theme returns correct dimensions."""
    # Reset and cover payroll
    paid_session.post(f"{B}/demo/reset", json={}, timeout=10)
    paid_session.post(f"{B}/actions/approve-all", json={"origin_url": ORIGIN}, timeout=10)
    
    # Simulate payments to cover
    for _ in range(4):
        paid_session.post(f"{B}/demo/simulate-next", json={}, timeout=10)
    
    # Check if covered
    r = paid_session.get(f"{B}/summary", timeout=10)
    data = r.json()
    assert data.get("covered"), "Paid fixture actions must cover payroll before PNG test"
    
    # Get PNG with dark theme
    r = paid_session.get(f"{B}/summary/image.png", params={"theme": "dark"}, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.headers["Content-Type"] == "image/png"
    
    # Verify dimensions
    img = Image.open(BytesIO(r.content))
    assert img.size == (1080, 1350), f"Expected 1080x1350, got {img.size}"
    print(f"✓ PNG dark theme: 200 OK, dimensions {img.size}")


def test_png_export_invalid_theme_returns_422(paid_session):
    """Test PNG export with invalid theme returns 422."""
    r = paid_session.get(f"{B}/summary/image.png", params={"theme": "invalid"}, timeout=10)
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
    print(f"✓ Invalid theme: 422 Unprocessable Entity")


# Cookie name constant
COOKIE_NAME = "gapless_demo_access"
