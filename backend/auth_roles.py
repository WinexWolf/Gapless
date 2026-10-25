"""Role model + counterparty linking for Gapless real multi-party mode.

Roles:
  - owner_admin : the business owner (full Gapless app). Bootstrapped via ADMIN_EMAIL.
  - client      : a customer who owes invoices (portal to respond to payroll-gap offers).
  - supplier    : a materials supplier (portal to respond to the buying agent).
  - pending     : signed in but not yet linked to a counterparty (must claim).

Identity is owned by Clerk; everything else lives in the app DB keyed by Clerk user_id.
No money/date math happens here.
"""
import os
import re
from datetime import datetime, timezone

import requests
from fastapi import HTTPException

import engine as E

ROLES = ("owner_admin", "client", "supplier", "pending")
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"


def clerk_enabled() -> bool:
    return bool(os.environ.get("CLERK_SECRET_KEY", ""))


def _admin_emails() -> set:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}


def slugify(name: str) -> str:
    return "cust_" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def fetch_clerk_identity(user_id: str) -> dict:
    """One Clerk lookup (used only at first sign-in) -> primary email, name, verified."""
    sk = os.environ.get("CLERK_SECRET_KEY", "")
    r = requests.get(
        f"https://api.clerk.com/v1/users/{user_id}",
        timeout=10,
        headers={"Authorization": f"Bearer {sk}", "User-Agent": "gapless-app"},
    )
    r.raise_for_status()
    data = r.json()
    emails = data.get("email_addresses", [])
    primary_id = data.get("primary_email_address_id")
    primary = next((e for e in emails if e["id"] == primary_id), emails[0] if emails else None)
    email = (primary or {}).get("email_address", "")
    verified = ((primary or {}).get("verification") or {}).get("status") == "verified"
    name = " ".join(x for x in [data.get("first_name"), data.get("last_name")] if x).strip()
    return {"email": email, "name": name or email, "verified": verified}


async def get_or_create_member(db, user: dict) -> dict:
    """Return the app profile for a signed-in user, creating it on first sign-in.
    Owner-admin is granted when the verified email is in ADMIN_EMAIL; everyone else
    starts as 'pending' until they claim a counterparty."""
    uid = user["user_id"]
    prof = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    if prof:
        if prof.get("env") != ENV:
            await db.user_profiles.update_one({"user_id": uid}, {"$set": {"env": ENV}})
            prof["env"] = ENV
        return prof
    ident = fetch_clerk_identity(uid)
    email = ident["email"].lower()
    role = "owner_admin" if (ident["verified"] and email in _admin_emails()) else "pending"
    prof = {
        "user_id": uid,
        "email": ident["email"],
        "name": ident["name"],
        "role": role,
        "linked_kind": None,
        "linked_id": None,
        "linked_name": None,
        "env": ENV,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_profiles.update_one({"user_id": uid}, {"$setOnInsert": prof}, upsert=True)
    return await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})


async def claimable_counterparties(db):
    """The seeded cast available to claim: unique customers (clients) and suppliers,
    minus any already linked to another account."""
    taken = set()
    async for p in db.user_profiles.find({"linked_id": {"$ne": None}}, {"_id": 0, "linked_id": 1}):
        taken.add(p["linked_id"])

    clients, seen = [], set()
    for r in await _all(db, "receivables"):
        name = r.get("customer")
        if not name:
            continue
        sid = slugify(name)
        if sid in seen:
            continue
        seen.add(sid)
        clients.append({"kind": "client", "id": sid, "name": name, "taken": sid in taken})

    suppliers = [{"kind": "supplier", "id": s["id"], "name": s["name"], "taken": s["id"] in taken}
                 for s in E.SUPPLIERS]
    return {"clients": clients, "suppliers": suppliers}


async def claim_counterparty(db, user: dict, kind: str, cid: str) -> dict:
    if kind not in ("client", "supplier"):
        raise HTTPException(400, "kind must be client or supplier")
    options = await claimable_counterparties(db)
    pool = options["clients"] if kind == "client" else options["suppliers"]
    match = next((c for c in pool if c["id"] == cid), None)
    if not match:
        raise HTTPException(404, "Unknown counterparty")
    if match["taken"]:
        # allow re-claim only if it's already this user's
        prof = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if not (prof and prof.get("linked_id") == cid):
            raise HTTPException(409, "That account is already linked to someone else")
    upd = {"role": kind, "linked_kind": kind, "linked_id": cid, "linked_name": match["name"]}
    await db.user_profiles.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})


async def _all(db, coll):
    return await db[coll].find({}, {"_id": 0}).to_list(2000)
