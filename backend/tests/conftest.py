"""Real Stripe TEST API fixtures, distinct from hosted checkout completion.
No production gate override; every protected HTTP request is verified by Stripe.
"""
import hashlib
import os
import secrets
from datetime import datetime, timezone

import pytest
import requests
import stripe
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
STRIPE_KEY = os.environ['STRIPE_SECRET_KEY']
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
COOKIE_NAME = 'gapless_demo_access'
B = os.environ.get('GAPLESS_API', 'http://localhost:8001/api')
ORIGIN = os.environ['BILLING_ALLOWED_ORIGINS'].split(',')[0]
LOOKUP = 'gapless_demo_monthly_v1'


def now():
    return datetime.now(timezone.utc)


@pytest.fixture(scope='module')
def stripe_test_subscription():
    assert STRIPE_KEY.startswith('sk_test_'), 'TEST keys only'
    stripe.api_key = STRIPE_KEY
    token = secrets.token_urlsafe(32)
    bid = hashlib.sha256(token.encode()).hexdigest()
    customer = stripe.Customer.create(description='Gapless regression TEST fixture', metadata={'test_fixture': 'true'})
    pm = stripe.PaymentMethod.attach('pm_card_visa', customer=customer.id)
    prices = stripe.Price.list(lookup_keys=[LOOKUP], active=True, limit=1)
    assert prices.data, 'Create test catalog through /billing/checkout first'
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    subscriptions = []
    fixture = {'cookie_token': token, 'browser_id': bid, 'customer_id': customer.id}

    def renew():
        sub = stripe.Subscription.create(customer=customer.id, items=[{'price': prices.data[0].id}],
            default_payment_method=pm.id, metadata={'test_fixture': 'true', 'owner': bid})
        assert sub.status == 'active' and not sub.livemode
        subscriptions.append(sub.id)
        fixture['subscription_id'] = sub.id
        db.billing_access.update_one({'id': bid}, {'$set': {'subscription_id': sub.id,
            'status': 'active', 'customer_id': customer.id, 'test_fixture': True, 'created_at': now()}}, upsert=True)
    fixture['renew'] = renew
    renew()
    yield fixture
    for sid in subscriptions:
        if stripe.Subscription.retrieve(sid).status != 'canceled':
            stripe.Subscription.delete(sid)
    stripe.Customer.delete(customer.id)
    db.billing_access.delete_one({'id': bid})
    client.close()


@pytest.fixture
def paid_session(stripe_test_subscription):
    fixture = stripe_test_subscription
    if stripe.Subscription.retrieve(fixture['subscription_id']).status != 'active':
        fixture['renew']()
    session = requests.Session()
    session.cookies.set(COOKIE_NAME, fixture['cookie_token'], path='/api')
    session.headers.update({'Origin': ORIGIN})
    yield session
    session.close()


@pytest.fixture
def unpaid_session():
    session = requests.Session()
    session.headers.update({'Origin': ORIGIN})
    yield session
    session.close()


# ---------------------------------------------------------------- owner auth bootstrap
# When Clerk auth is enabled, attach an owner Bearer token to every local-API request so
# the pre-auth regression suite keeps working. No-op when Clerk is not configured.
import json as _json
import urllib.error as _uerr
import urllib.request as _ureq

_SK = os.environ.get("CLERK_SECRET_KEY", "")
_OWNER_EMAIL = "testowner+clerk_test@example.com"


def _clerk(path, method="GET", body=None):
    data = _json.dumps(body).encode() if body is not None else None
    req = _ureq.Request("https://api.clerk.com/v1" + path, data=data, method=method,
                        headers={"Authorization": "Bearer " + _SK, "Content-Type": "application/json",
                                 "User-Agent": "gapless-pytest"})
    return _json.load(_ureq.urlopen(req))


def _find_owner():
    try:
        users = _clerk(f"/users?email_address={_OWNER_EMAIL}")
        return users[0]["id"] if users else None
    except Exception:
        return None


def _mint_owner_token():
    if not _SK:
        return ""
    uid = _find_owner()
    if not uid:
        try:
            uid = _clerk("/users", "POST", {"email_address": [_OWNER_EMAIL],
                                            "password": "Test-pass-12345!", "skip_password_checks": True})["id"]
        except _uerr.HTTPError:
            uid = _find_owner()
    if not uid:
        return ""
    MongoClient(MONGO_URL)[DB_NAME].user_profiles.update_one(
        {"user_id": uid},
        {"$set": {"user_id": uid, "email": _OWNER_EMAIL, "name": "Test Owner", "role": "owner_admin",
                  "env": "preview", "linked_kind": None, "linked_id": None, "linked_name": None}}, upsert=True)
    sid = _clerk("/sessions", "POST", {"user_id": uid})["id"]
    return _clerk(f"/sessions/{sid}/tokens", "POST", {"expires_in_seconds": 3600})["jwt"]


_OWNER_TOKEN = _mint_owner_token()

if _OWNER_TOKEN:
    _orig_request = requests.sessions.Session.request

    def _auth_request(self, method, url, **kwargs):
        if "localhost:8001" in url or "127.0.0.1:8001" in url:
            headers = kwargs.get("headers") or {}
            headers.setdefault("Authorization", f"Bearer {_OWNER_TOKEN}")
            kwargs["headers"] = headers
        return _orig_request(self, method, url, **kwargs)

    requests.sessions.Session.request = _auth_request
