"""Test-only subscriptions. Browser capability cookies, never client-side entitlements."""
import asyncio
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import stripe
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict

COOKIE = "gapless_demo_access"
LOOKUP = "gapless_demo_monthly_v1"
# Owner / admin: when the paywall is disabled every browser is unlocked (no Stripe needed).
PAYWALL_ENABLED = os.environ.get("PAYWALL_ENABLED", "false").lower() == "true"
# Editable sample catalog. Amounts and entitlement dates are owned by Python.
MONTHLY_CENTS = 1900
CURRENCY = "usd"
SMP_COUNTRIES = set("AU AT BE BG CA HR CY CZ DK EE FI FR DE GI GR HK HU IE IT JP LV LI LT LU MT NL NO PL PT RO SG SK SI ES SE CH GB US".split())
_catalog_lock = asyncio.Lock()
_checkout_locks = {}


class CheckoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lookup_key: str = LOOKUP
    origin_url: str


class CheckoutOutput(BaseModel):
    url: str
    session_id: str


class BillingStatus(BaseModel):
    active: bool = False
    status: str = "locked"
    cancel_at_period_end: bool = False
    period_end: str | None = None
    price_label: str = "$19 USD"
    interval: str = "month"
    sample_price: bool = True
    test_mode: bool = True
    lookup_key: str = LOOKUP
    checkout_ready: bool = False
    tax_mode: str = "full"
    payment_status: str | None = None


def now():
    return datetime.now(timezone.utc)


def test_key():
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key.startswith("sk_test_") or key == "sk_test_emergent":
        raise HTTPException(503, "A valid Stripe test sandbox is required. Live charges are disabled.")
    return key


def owner(request):
    token = request.cookies.get(COOKIE, "")
    return hashlib.sha256(token.encode()).hexdigest() if len(token) >= 32 else None


def require_same_origin(request):
    origin = request.headers.get("origin")
    if origin and urlparse(origin).netloc != request.headers.get("host"):
        allowed = os.environ.get("BILLING_ALLOWED_ORIGINS", os.environ.get("CORS_ORIGINS", "")).split(",")
        if origin not in allowed:
            raise HTTPException(403, "This request must come from Gapless.")


def bind_origin(request, origin):
    parsed = urlparse(origin)
    if parsed.scheme not in ("https", "http") or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise HTTPException(400, "Invalid return address.")
    require_same_origin(request)
    if request.headers.get("origin") != origin.rstrip("/"):
        raise HTTPException(400, "Return address must match this browser's origin.")
    return origin.rstrip("/")


async def catalog():
    key = test_key()
    async with _catalog_lock:
        prices = await asyncio.to_thread(stripe.Price.list, lookup_keys=[LOOKUP], active=True, limit=1, api_key=key)
        if prices.data:
            return prices.data[0]
        products = await asyncio.to_thread(stripe.Product.list, active=True, limit=100, api_key=key)
        product = next((p for p in products.data if p.metadata.get("emergent_product_id") == "gapless_demo_access"), None)
        if product is None:
            product = await asyncio.to_thread(stripe.Product.create, name="Gapless Monthly Demo Access (TEST)",
                tax_code="txcd_10103001", metadata={"emergent_product_id": "gapless_demo_access", "managed_by": "emergent"},
                idempotency_key="gapless-demo-product-v1", api_key=key)
        return await asyncio.to_thread(stripe.Price.create, product=product.id, unit_amount=MONTHLY_CENTS,
            currency=CURRENCY, recurring={"interval": "month"}, lookup_key=LOOKUP,
            idempotency_key="gapless-demo-monthly-v1", api_key=key)


async def sync_subscription(db, bid, sid):
    sub = await asyncio.to_thread(stripe.Subscription.retrieve, sid, api_key=test_key())
    if sub.get("livemode"):
        raise HTTPException(403, "Live subscriptions are not accepted by this demo.")
    periods = [x.get("current_period_end", 0) for x in sub.get("items", {}).get("data", [])]
    end = sub.get("current_period_end") or (min(periods) if periods else 0)
    fields = {"subscription_id": sub.id, "customer_id": sub.customer, "status": sub.status,
              "period_end_ts": end, "cancel_at_period_end": bool(sub.cancel_at_period_end), "updated_at": now()}
    await db.billing_access.update_one({"id": bid}, {"$set": fields}, upsert=True)
    return fields


async def verify_checkout(db, bid, session_id):
    tx = await db.billing_transactions.find_one({"session_id": session_id, "owner": bid})
    if not tx:
        raise HTTPException(404, "Checkout not found for this browser. Return using the browser that started checkout.")
    session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id, api_key=test_key())
    if session.get("livemode") or session.mode != "subscription" or session.metadata.get("owner") != bid:
        raise HTTPException(403, "This checkout cannot unlock demo access.")
    if session.status == "complete" and session.payment_status == "paid" and session.subscription:
        await sync_subscription(db, bid, session.subscription)
    await db.billing_transactions.update_one({"session_id": session_id}, {"$set": {
        "status": session.status, "payment_status": session.payment_status, "updated_at": now()}})
    return session.payment_status


async def state(db, bid, refresh=False):
    rec = await db.billing_access.find_one({"id": bid}) if bid else None
    if rec and rec.get("subscription_id") and refresh:
        rec = {**rec, **(await sync_subscription(db, bid, rec["subscription_id"]))}
    end = (rec or {}).get("period_end_ts", 0)
    active = bool(rec and rec.get("status") == "active" and end > now().timestamp())
    return BillingStatus(active=active, status=(rec or {}).get("status", "locked"),
        cancel_at_period_end=(rec or {}).get("cancel_at_period_end", False),
        period_end=datetime.fromtimestamp(end, timezone.utc).strftime("%b %d, %Y") if end else None,
        checkout_ready=os.environ.get("STRIPE_SECRET_KEY", "").startswith("sk_test_"),
        tax_mode=(rec or {}).get("tax_mode", "full"))


async def gate(db, request):
    if not PAYWALL_ENABLED:
        return
    path = request.url.path
    protected = request.method not in ("GET", "HEAD", "OPTIONS") and (
        path.startswith(("/api/actions/", "/api/buy/", "/api/invoices", "/api/reminders/"))
        or path in ("/api/demo/simulate-next", "/api/settings", "/api/plan/explain"))
    if not protected:
        return
    require_same_origin(request)
    # Refresh Stripe before granting a mutation: canceled/unpaid access never trusts a client flag.
    try:
        st = await state(db, owner(request), refresh=True)
    except stripe.StripeError:
        raise HTTPException(503, "Couldn't verify your test subscription. Please retry.")
    if not st.active:
        raise HTTPException(402, "Monthly demo access is needed for this action. Previewing and sharing remain free.")


async def webhook(db, event):
    if event.get("livemode"):
        return
    obj, kind = event["data"]["object"], event["type"]
    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"):
        tx = await db.billing_transactions.find_one({"session_id": obj["id"]})
        if tx:
            await verify_checkout(db, tx["owner"], obj["id"])
    elif kind.startswith("customer.subscription."):
        rec = await db.billing_access.find_one({"subscription_id": obj["id"]})
        if rec:
            # Retrieve current Stripe state instead of applying potentially out-of-order events.
            await sync_subscription(db, rec["id"], obj["id"])


def router(db):
    api = APIRouter(prefix="/api/billing", tags=["test billing"])

    @api.get("/status", response_model=BillingStatus)
    async def status(request: Request, response: Response, session_id: str | None = None):
        response.headers["Cache-Control"] = "no-store"
        if not PAYWALL_ENABLED:
            return BillingStatus(active=True, status="unlocked", price_label="Included",
                                 checkout_ready=False)
        bid = owner(request)
        if not bid:
            token = secrets.token_urlsafe(32)
            bid = hashlib.sha256(token.encode()).hexdigest()
            secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
            response.set_cookie(COOKIE, token, httponly=True, secure=secure, samesite="lax", max_age=34560000, path="/api")
            await db.billing_access.update_one({"id": bid}, {"$setOnInsert": {"created_at": now(), "status": "locked"}}, upsert=True)
        try:
            payment_status = await verify_checkout(db, bid, session_id) if session_id else None
            result = await state(db, bid, refresh=True)
            result.payment_status = payment_status
            return result
        except stripe.StripeError:
            raise HTTPException(502, "Stripe test status is temporarily unavailable. Please retry.")

    @api.post("/checkout", response_model=CheckoutOutput)
    async def checkout(payload: CheckoutInput, request: Request):
        origin = bind_origin(request, payload.origin_url)
        bid = owner(request)
        if not bid:
            raise HTTPException(400, "Refresh the access panel before checkout.")
        if payload.lookup_key != LOOKUP:
            raise HTTPException(400, "Unknown plan.")
        lock = _checkout_locks.setdefault(bid, asyncio.Lock())
        async with lock:
            try:
                if (await state(db, bid, refresh=True)).active:
                    raise HTTPException(409, "Monthly demo access is already active.")
                old = await db.billing_transactions.find_one({"owner": bid, "status": "open"})
                if old:
                    s = await asyncio.to_thread(stripe.checkout.Session.retrieve, old["session_id"], api_key=test_key())
                    if s.status == "open":
                        return CheckoutOutput(url=s.url, session_id=s.id)
                    await verify_checkout(db, bid, s.id)
                    if (await state(db, bid)).active:
                        raise HTTPException(409, "Your test checkout is paid. Refresh access to continue.")
                price = await catalog()
                account = await asyncio.to_thread(stripe.Account.retrieve, api_key=test_key())
                tax_mode = "full" if account.country in SMP_COUNTRIES else "calc_only"
                kwargs = dict(mode="subscription", line_items=[{"price": price.id, "quantity": 1}],
                    success_url=f"{origin}/billing/return?session_id={{CHECKOUT_SESSION_ID}}",
                    cancel_url=f"{origin}/billing/return?cancelled=1",
                    metadata={"owner": bid, "lookup_key": LOOKUP}, subscription_data={"metadata": {"owner": bid}},
                    api_key=test_key())
                if tax_mode == "full":
                    try:
                        s = await asyncio.to_thread(stripe.checkout.Session.create, **kwargs, managed_payments={"enabled": True})
                    except stripe.InvalidRequestError as e:
                        if "managed payments" not in str(e).lower() and "ineligible" not in str(e).lower():
                            raise
                        tax_mode = "calc_only"
                        s = await asyncio.to_thread(stripe.checkout.Session.create, **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")
                else:
                    s = await asyncio.to_thread(stripe.checkout.Session.create, **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")
                await db.billing_transactions.insert_one({"id": str(uuid.uuid4()), "owner": bid, "session_id": s.id,
                    "status": "open", "payment_status": "unpaid", "amount": price.unit_amount / 100,
                    "currency": price.currency, "tax_mode": tax_mode, "created_at": now()})
                await db.billing_access.update_one({"id": bid}, {"$set": {"tax_mode": tax_mode}})
                return CheckoutOutput(url=s.url, session_id=s.id)
            except stripe.StripeError:
                raise HTTPException(502, "Stripe test checkout is unavailable right now. Nothing was charged; please retry.")

    @api.post("/cancel", response_model=BillingStatus)
    async def cancel(request: Request):
        require_same_origin(request)
        bid = owner(request)
        rec = await db.billing_access.find_one({"id": bid}) if bid else None
        if not rec or not rec.get("subscription_id"):
            raise HTTPException(404, "No test subscription for this browser.")
        try:
            await asyncio.to_thread(stripe.Subscription.modify, rec["subscription_id"], cancel_at_period_end=True, api_key=test_key())
            return await state(db, bid, refresh=True)
        except stripe.StripeError:
            raise HTTPException(502, "Cancellation wasn't confirmed. Retry to stop the test renewal.")

    return api
