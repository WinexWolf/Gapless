import os
import re
import uuid
import secrets
import asyncio
import logging
from pathlib import Path
from datetime import date, datetime, timezone, timedelta

import stripe
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Body, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

import engine as E
from llm import llm_text, extract_json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

app = FastAPI(title="Gapless")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("gapless")

DEMO_COLLECTIONS = ["business", "receivables", "payables", "cashflow_events", "actions", "threads", "messages",
                    "offers", "payments", "settings", "activity_log", "purchase_requests", "rfq_threads", "quotes",
                    "shipments", "outbox", "payment_transactions", "reminders", "supplier_history"]
NO_ID = {"_id": 0}
BUY_SIGN = "Maria's assistant (on behalf of Maria Alvarez, Bay Remodel Co.)"
_lock = asyncio.Lock()


def today():
    return date.today()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def uid(p):
    return f"{p}_{uuid.uuid4().hex[:10]}"


async def all_docs(coll, q=None, sort=None):
    cur = db[coll].find(q or {}, NO_ID)
    if sort:
        cur = cur.sort(sort[0], sort[1])
    return await cur.to_list(2000)


async def log_activity(text, kind="info", amount=None, scope="payroll"):
    await db.activity_log.insert_one({"id": uid("log"), "ts": now_iso(), "text": text, "kind": kind,
                                      "amount": amount, "scope": scope})


async def get_settings():
    s = await db.settings.find_one({"id": "settings"}, NO_ID)
    if not s:
        s = dict(E.DEFAULT_SETTINGS)
        await db.settings.insert_one(dict(s))
        s.pop("_id", None)
    return {**E.DEFAULT_SETTINGS, **s}


# ------------------------------------------------------------------ seed / reset

async def reset_demo():
    T = today()
    for c in DEMO_COLLECTIONS:
        await db[c].delete_many({})
    docs = E.seed_docs(T)
    for c, rows in docs.items():
        if rows:
            await db[c].insert_many([dict(r) for r in rows])
    await db.settings.insert_one(dict(E.DEFAULT_SETTINGS))
    data = await load_data()
    st = E.payroll_status(data, [], T)
    acts, _ = E.build_candidates(data, T)
    ordered, target, total = E.rank_actions(acts, st["gap"])
    for a in ordered:
        a["status"] = "proposed"
        a["secured_amount"] = 0.0
        a["draft"] = E.draft_message(a, "friendly", "en", T)
        await db.actions.insert_one(dict(a))
    await db.business.update_one({"id": "biz"}, {"$set": {
        "explanation": E.plan_explanation(ordered, st["gap"], target, total, E.friday_for(T)),
        "explanation_source": "template"}})
    await create_seed_request()
    await db.supplier_history.insert_many([dict(h) for h in E.supplier_history_seed(T)])
    await log_activity("Demo loaded: synthetic data for Bay Remodel Co.", "system")


async def ensure_seed():
    async with _lock:
        biz = await db.business.find_one({"id": "biz"}, NO_ID)
        if not biz or biz.get("seed_date") != E.iso(today()):
            await reset_demo()


async def load_data():
    return {"business": await all_docs("business"), "receivables": await all_docs("receivables"),
            "payables": await all_docs("payables"), "payments": await all_docs("payments"),
            "cashflow_events": await all_docs("cashflow_events")}


async def status_bundle():
    T = today()
    data = await load_data()
    actions = await all_docs("actions")
    fc = E.forecast(data, T)
    st = E.payroll_status(data, actions, T)
    return data, actions, fc, st


# ------------------------------------------------------------------ demo

@api.get("/")
async def root():
    return {"app": "Gapless", "ok": True}


@api.post("/demo/load")
async def demo_load():
    await reset_demo()
    return {"ok": True}


@api.post("/demo/reset")
async def demo_reset():
    await reset_demo()
    return {"ok": True}


# ------------------------------------------------------------------ forecast & plan

@api.get("/forecast")
async def get_forecast():
    await ensure_seed()
    data, actions, fc, st = await status_bundle()
    biz = data["business"][0]
    return {"business": biz, "forecast": fc, "status": st,
            "explanation": biz.get("explanation"), "explanation_source": biz.get("explanation_source")}


def public_action(a, settings):
    a = dict(a)
    a["type_label"] = E.TYPE_LABEL[a["type"]]
    a["checks"] = E.rule_checks(a, settings)
    return a


@api.get("/plan")
async def get_plan():
    await ensure_seed()
    T = today()
    data, actions, fc, st = await status_bundle()
    settings = await get_settings()
    cands, alts = E.build_candidates(data, T)
    actions.sort(key=lambda a: a["rank"])
    target = E.r2(E.COVER_FACTOR * st["gap"])
    total = E.r2(sum(a["expected"] for a in actions if a.get("selected")))
    why = [f"#{a['rank']} {E.TYPE_LABEL[a['type']]} · {a['counterparty']}: costs {E.fmt_money(a['cost'])} for "
           f"{E.fmt_money(a['expected'])} expected ({E.fmt_money(a['cash_by_deadline'])} × {int(a['probability']*100)}%) "
           f"= {round(a['cost_per_expected']*100, 2)}¢ per expected dollar, friction {a['friction']}" for a in actions]
    for alt in alts:
        main = next(a for a in actions if a["id"] == alt["instead_of"])
        alt["why_not"] = (f"One ask per customer. The {E.TYPE_LABEL[main['type']].lower()} offer has a higher chance of "
                          f"cash by Friday ({int(main['probability']*100)}% vs {int(alt['probability']*100)}%).")
    biz = data["business"][0]
    return {"actions": [public_action(a, settings) for a in actions], "alternatives": alts, "target": target,
            "expected_total": total, "gap": st["gap"], "status": st, "why_order": why,
            "rule": "Sorted by lowest cost per expected dollar, then lowest friction. Actions are added until expected cash reaches 115% of the gap.",
            "explanation": biz.get("explanation"), "explanation_source": biz.get("explanation_source"),
            "friday": fc["friday"], "friday_label": fc["friday_label"]}


@api.post("/plan/explain")
async def regenerate_explanation():
    await ensure_seed()
    settings = await get_settings()
    plan = await get_plan()
    biz = await db.business.find_one({"id": "biz"}, NO_ID)
    facts = "; ".join(plan["why_order"])
    out = await llm_text(
        "You explain cash plans to a small-business owner. Write exactly 2 short sentences, plain English, no new numbers.",
        f"Gap: {E.fmt_money(plan['gap'])} on {plan['friday_label']}. Target {E.fmt_money(plan['target'])}. "
        f"Expected {E.fmt_money(plan['expected_total'])}. Ranked actions: {facts}. Template: {biz.get('explanation')}",
        settings.get("llm_force_fail"))
    if out and re.sub(r"[$,]", "", E.fmt_money(plan["gap"])) in re.sub(r"[$,]", "", out) and out.count(".") <= 4:
        expl, src = out, "ai"
    else:
        expl, src = biz.get("explanation"), "template"
    await db.business.update_one({"id": "biz"}, {"$set": {"explanation": expl, "explanation_source": src}})
    return {"explanation": expl, "source": src}


# ------------------------------------------------------------------ actions

async def get_action(aid):
    a = await db.actions.find_one({"id": aid}, NO_ID)
    if not a:
        raise HTTPException(404, "Action not found")
    return a


@api.post("/actions/{aid}/draft")
async def draft_action(aid: str, payload: dict = Body(default={})):
    a = await get_action(aid)
    settings = await get_settings()
    tone = payload.get("tone") or settings["tone"]
    lang = payload.get("language") or settings["language"]
    base = E.draft_message(a, tone, lang, today())
    draft = base
    if payload.get("regenerate"):
        out = await llm_text(
            "You rewrite B2B billing messages. Polite, never threatening. Keep every number, date and the exact "
            "placeholder [secure offer link]. Return JSON {\"subject\":..., \"body\":...}. Keep the signature and opt-out line.",
            f"Tone: {tone}. Language: {'Spanish' if lang == 'es' else 'English'}.\nSubject: {base['subject']}\nBody:\n{base['body']}",
            settings.get("llm_force_fail"))
        j = extract_json(out)
        must = [E.fmt_money(a["invoice_amount"]), E.LINK_PH]
        if j and j.get("body") and all(m in j["body"] for m in must):
            draft = {"subject": j.get("subject") or base["subject"], "body": E.ensure_safety(j["body"], lang),
                     "tone": tone, "language": lang, "source": "ai"}
        else:
            draft = dict(base, source="template (AI unavailable)")
    await db.actions.update_one({"id": aid}, {"$set": {"draft": draft}})
    return draft


@api.put("/actions/{aid}")
async def edit_action(aid: str, payload: dict = Body(...)):
    a = await get_action(aid)
    d = dict(a["draft"])
    for k in ("subject", "body"):
        if payload.get(k):
            d[k] = payload[k]
    d["source"] = "edited"
    await db.actions.update_one({"id": aid}, {"$set": {"draft": d}})
    return d


async def add_msg(thread_id, actor, side, kind, text, structured=None):
    await db.messages.insert_one({"id": uid("msg"), "thread_id": thread_id, "ts": now_iso(), "actor": actor,
                                  "side": side, "kind": kind, "text": text, "structured": structured})


async def approve_one(aid, payload):
    a = await get_action(aid)
    if a["status"] != "proposed":
        raise HTTPException(400, f"Already {a['status']}")
    settings = await get_settings()
    checks = E.rule_checks(a, settings)
    if not all(c["ok"] for c in checks):
        raise HTTPException(400, "Blocked by a guardrail: " + "; ".join(c["text"] for c in checks if not c["ok"]))
    origin = (payload.get("origin_url") or "").rstrip("/")
    token = secrets.token_urlsafe(18)
    d = a["draft"]
    lang = d.get("language", "en")
    link = f"{origin}/o/{token}" + ("?lang=es" if lang == "es" else "")
    subject = payload.get("subject") or d["subject"]
    body = (payload.get("body") or d["body"]).replace(E.LINK_PH, link)
    if link not in body:
        body += f"\n\nOffer link: {link}"
    body = E.ensure_safety(body, d.get("language", "en"))
    await db.offers.insert_one({"token": token, "action_id": aid, "status": "open", "language": d.get("language", "en"),
                                "created_at": now_iso(), "pending_counter": None})
    await db.outbox.insert_one({"id": uid("out"), "ts": now_iso(), "to": a["contact"], "counterparty": a["counterparty"],
                                "subject": subject, "body": body, "link": link, "channel": "email", "scope": "payroll",
                                "action_id": aid, "simulated": True, "language": lang})
    badge = "Agent <-> Agent" if (a["type"] == "extension" and settings.get("supplier_has_ai")) else "Agent <-> Human"
    await db.threads.update_one({"id": aid}, {"$set": {"id": aid, "action_id": aid, "counterparty": a["counterparty"],
                                                       "type": a["type"], "badge": badge}}, upsert=True)
    await add_msg(aid, "Maria", "maria", "approved", "Maria approved this message. Rule checks passed.")
    await add_msg(aid, "Maria's billing assistant", "us", "offer", f"{subject}\n\n{body}")
    await db.actions.update_one({"id": aid}, {"$set": {"status": "approved", "offer_token": token,
                                                       "approved_at": now_iso(), "sent": {"subject": subject, "body": body}}})
    await log_activity(f"Approved & sent (simulated) {E.TYPE_LABEL[a['type']]} to {a['counterparty']}", "approve")
    return {"ok": True, "token": token, "link": link, "checks": checks}


@api.post("/actions/{aid}/approve")
async def approve_action(aid: str, payload: dict = Body(default={})):
    return await approve_one(aid, payload)


@api.post("/actions/approve-all")
async def approve_all(payload: dict = Body(default={})):
    out = []
    for a in await all_docs("actions", {"status": "proposed", "selected": True}, ("rank", 1)):
        out.append(await approve_one(a["id"], {"origin_url": payload.get("origin_url")}))
    return {"approved": len(out)}


async def record_payment(a, method):
    T = today()
    if a["status"] in E.SECURED_STATES:
        return
    amount = E.r2(a["cash_by_deadline"])
    await db.payments.insert_one({"id": uid("pmt"), "date": E.iso(T), "amount": amount,
                                  "label": f"{a['counterparty']} payment", "action_id": a["id"],
                                  "receivable_id": a["target_id"], "method": method})
    if a["type"] == "split":
        await ensure_installment(a)
        await db.receivables.update_one({"id": a["target_id"]}, {"$set": {"status": "split", "paid_amount": amount}})
        await create_reminder(a)
    else:
        await db.receivables.update_one({"id": a["target_id"]}, {"$set": {"status": "paid", "paid_amount": amount}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"status": "paid", "secured_amount": amount}})
    if a.get("offer_token"):
        await db.offers.update_one({"token": a["offer_token"]}, {"$set": {"status": "paid"}})
    extra = f" Second {E.fmt_money(a['terms']['second'])} scheduled for {E.fmt_date(a['terms']['second_date'])}." if a["type"] == "split" else ""
    await add_msg(a["id"], a["counterparty"], "them", "paid", f"Paid {E.fmt_money(amount)} via {method}.{extra}")
    await log_activity(f"Money secured: {a['counterparty']} paid {E.fmt_money(amount)} ({method})", "secured", amount)


async def create_reminder(a):
    if await db.reminders.find_one({"action_id": a["id"]}):
        return
    lang = (a.get("draft") or {}).get("language", "en")
    subject, body = E.reminder_draft(a, lang)
    send_on = max(today(), E.d(a["terms"]["second_date"]) - timedelta(days=E.REMINDER_DAYS_BEFORE))
    await db.reminders.insert_one({"id": uid("rem"), "action_id": a["id"], "counterparty": a["counterparty"],
                                   "contact": a.get("contact", ""), "amount": a["terms"]["second"],
                                   "due_date": a["terms"]["second_date"], "send_on": E.iso(send_on), "language": lang,
                                   "subject": subject, "body": body, "status": "draft", "created_at": now_iso()})
    await add_msg(a["id"], "Scheduler", "code", "reminder",
                  f"Gentle reminder for the second {E.fmt_money(a['terms']['second'])} drafted for {E.fmt_date(send_on)} "
                  f"({E.REMINDER_DAYS_BEFORE} days before it's due). Waiting for Maria's approval.")


@api.get("/reminders")
async def list_reminders():
    await ensure_seed()
    return {"items": await all_docs("reminders", None, ("send_on", 1))}


async def get_reminder(rid):
    r = await db.reminders.find_one({"id": rid}, NO_ID)
    if not r:
        raise HTTPException(404, "Reminder not found")
    return r


@api.put("/reminders/{rid}")
async def edit_reminder(rid: str, payload: dict = Body(...)):
    r = await get_reminder(rid)
    if r["status"] == "sent":
        raise HTTPException(400, "Already sent")
    upd = {k: str(payload[k])[:4000] for k in ("subject", "body") if payload.get(k)}
    if upd.get("body"):
        upd["body"] = E.ensure_safety(upd["body"], r["language"])
    await db.reminders.update_one({"id": rid}, {"$set": upd})
    return await get_reminder(rid)


@api.post("/reminders/{rid}/approve")
async def approve_reminder(rid: str):
    r = await get_reminder(rid)
    if r["status"] != "draft":
        raise HTTPException(400, f"Reminder is {r['status']}")
    await db.reminders.update_one({"id": rid}, {"$set": {"status": "approved", "approved_at": now_iso()}})
    await add_msg(r["action_id"], "Maria", "maria", "approved", f"Maria approved the reminder for {E.fmt_date(r['send_on'])}.")
    await log_activity(f"Reminder to {r['counterparty']} approved for {E.fmt_date(r['send_on'])}", "approve")
    return await get_reminder(rid)


@api.post("/reminders/{rid}/send")
async def send_reminder(rid: str):
    r = await get_reminder(rid)
    if r["status"] != "approved":
        raise HTTPException(400, "Maria must approve the reminder first")
    await db.outbox.insert_one({"id": uid("out"), "ts": now_iso(), "to": r["contact"], "counterparty": r["counterparty"],
                                "subject": r["subject"], "body": r["body"], "link": None, "channel": "email",
                                "scope": "payroll", "action_id": r["action_id"], "simulated": True, "language": r["language"]})
    await db.reminders.update_one({"id": rid}, {"$set": {"status": "sent", "sent_at": now_iso()}})
    await add_msg(r["action_id"], "Maria's billing assistant", "us", "reminder", f"{r['subject']}\n\n{r['body']}")
    await log_activity(f"Reminder sent (simulated) to {r['counterparty']} for {E.fmt_money(r['amount'])}", "reminder")
    return await get_reminder(rid)


@api.get("/summary")
async def payday_summary():
    await ensure_seed()
    data, actions, fc, st = await status_bundle()
    items = []
    for a in sorted(actions, key=lambda x: x["rank"]):
        if a["status"] not in E.SECURED_STATES:
            continue
        if a["type"] == "split":
            note = f"+ {E.fmt_money(a['terms']['second'])} on {E.fmt_date(a['terms']['second_date'])}"
        elif a["type"] == "extension":
            note = f"moved to {E.fmt_date(a['terms']['new_due'])}"
        elif a["type"] == "early_pay":
            note = f"{a['terms']['discount_pct']}% early-pay discount"
        else:
            note = "paid after a reminder"
        items.append({"counterparty": a["counterparty"], "type_label": E.TYPE_LABEL[a["type"]],
                      "amount": a["secured_amount"], "cost": a["cost"], "note": note})
    total_cost = E.r2(sum(i["cost"] for i in items))
    pct = round(total_cost / st["gap"] * 100, 2) if st["gap"] else 0
    payroll = next((p["amount"] for p in data["payables"] if p.get("kind") == "payroll"), 0)
    lines = [f"Payroll covered \u2713 \u00b7 {E.BUSINESS_NAME}",
             f"{fc['friday_label']} payroll ({E.fmt_money(payroll)}) is covered with {E.fmt_money(st['spare'])} to spare.",
             f"Secured {E.fmt_money(st['secured'])} against a {E.fmt_money(st['gap'])} gap:"]
    lines += [f"\u2022 {i['counterparty']} ({i['type_label']}): {E.fmt_money(i['amount'])}, cost {E.fmt_money(i['cost'])}, {i['note']}" for i in items]
    lines += [f"Total cost to close the gap: {E.fmt_money(total_cost)} ({pct}% of the gap).",
              f"Friday projected balance: {E.fmt_money(fc['friday_balance'])}.", "Gapless \u00b7 demo, synthetic data"]
    return {"covered": st["covered"], "friday_label": fc["friday_label"], "payroll": payroll, "gap": st["gap"],
            "secured": st["secured"], "spare": st["spare"], "friday_balance": fc["friday_balance"], "items": items,
            "total_cost": total_cost, "cost_pct": pct, "text": "\n".join(lines)}


async def ensure_installment(a):
    t = a["terms"]
    await db.cashflow_events.update_one({"id": f"cf_inst_{a['id']}"}, {"$set": {
        "id": f"cf_inst_{a['id']}", "date": t["second_date"], "amount": t["second"],
        "label": f"{a['counterparty']} split, 2nd payment", "kind": "installment"}}, upsert=True)


async def secure_extension(a):
    t = a["terms"]
    fee = E.r2(a["invoice_amount"] * t["fee_pct"] / 100)
    await db.payables.update_one({"id": a["target_id"]}, {"$set": {
        "due_date": t["new_due"], "amount": E.r2(a["invoice_amount"] + fee), "extended": True, "fee": fee}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"status": "secured", "secured_amount": a["invoice_amount"],
                                                           "cost": fee}})
    if a.get("offer_token"):
        await db.offers.update_one({"token": a["offer_token"]}, {"$set": {"status": "accepted"}})
    await log_activity(f"Money secured: {a['counterparty']} accepted net+10 at {t['fee_pct']}% ({E.fmt_money(fee)}); "
                       f"{E.fmt_money(a['invoice_amount'])} moves to {E.fmt_date(t['new_due'])}", "secured", a["invoice_amount"])


async def accept_action(a, actor_note=None):
    if a["type"] == "extension":
        await add_msg(a["id"], a["counterparty"], "them", "accepted",
                      actor_note or f"Accepted: net+10 at {a['terms']['fee_pct']}% fee. New due date {E.fmt_date(a['terms']['new_due'])}.")
        await secure_extension(a)
        return
    if a["type"] == "split":
        await ensure_installment(a)
        await db.receivables.update_one({"id": a["target_id"]}, {"$set": {"status": "split"}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"status": "accepted"}})
    await db.offers.update_one({"token": a.get("offer_token")}, {"$set": {"status": "accepted"}})
    await add_msg(a["id"], a["counterparty"], "them", "accepted", actor_note or "Accepted the offer.")
    await log_activity(f"{a['counterparty']} accepted the {E.TYPE_LABEL[a['type']].lower()} offer", "accepted")


@api.post("/actions/{aid}/mark-paid")
async def mark_paid(aid: str):
    a = await get_action(aid)
    if a["type"] == "extension":
        raise HTTPException(400, "Supplier extensions are secured when accepted, not paid")
    if a["status"] not in E.ACTIVE_STATES:
        raise HTTPException(400, "Approve and send this action first")
    if a["type"] in ("split", "early_pay") and a["status"] != "accepted":
        await accept_action(a, "Accepted (recorded by Maria in demo mode).")
        a = await get_action(aid)
    await record_payment(a, "Mark as paid (demo)")
    return {"ok": True}


async def record_second_payment(a, method):
    t = a["terms"]
    if a["type"] != "split" or a["status"] != "paid" or t.get("second_paid"):
        raise HTTPException(400, "The second payment isn't open")
    amt = E.r2(t["second"])
    await db.payments.insert_one({"id": uid("pmt"), "date": E.iso(today()), "amount": amt,
                                  "label": f"{a['counterparty']} 2nd payment", "action_id": a["id"],
                                  "receivable_id": a["target_id"], "method": method})
    await db.cashflow_events.delete_one({"id": f"cf_inst_{a['id']}"})
    await db.receivables.update_one({"id": a["target_id"]}, {"$set": {"status": "paid", "paid_amount": a["invoice_amount"]}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"terms.second_paid": True, "terms.second_paid_on": E.iso(today()),
                                                           "secured_amount": E.r2(a["secured_amount"] + amt)}})
    await db.reminders.update_many({"action_id": a["id"], "status": {"$ne": "sent"}}, {"$set": {"status": "cancelled"}})
    await add_msg(a["id"], a["counterparty"], "them", "paid",
                  f"Paid the second {E.fmt_money(amt)} via {method}, ahead of {E.fmt_date(t['second_date'])}. Invoice settled in full.")
    await log_activity(f"Cash received: {a['counterparty']} paid the second {E.fmt_money(amt)} early ({method})", "secured", amt)


@api.post("/actions/{aid}/mark-second-paid")
async def mark_second_paid(aid: str):
    await record_second_payment(await get_action(aid), "Mark as paid (demo)")
    return {"ok": True}


def apply_counter_terms(a, pc, T):
    t = dict(a["terms"])
    upd = {}
    if pc.get("percent") is not None:
        if a["type"] == "early_pay":
            t["discount_pct"] = pc["percent"]
            upd["cash_by_deadline"] = E.r2(a["invoice_amount"] * (1 - pc["percent"] / 100))
            upd["cost"] = E.r2(a["invoice_amount"] * pc["percent"] / 100)
        else:
            t["fee_pct"] = pc["percent"]
            upd["cost"] = E.r2(a["invoice_amount"] * pc["percent"] / 100)
    if pc.get("days") is not None:
        if a["type"] == "split":
            t["second_date"] = E.iso(T + timedelta(days=int(pc["days"])))
            t["days"] = int(pc["days"])
        elif a["type"] == "extension":
            t["new_due"] = E.iso(E.d(a["invoice_due"]) + timedelta(days=int(pc["days"])))
            t["days"] = int(pc["days"])
        else:
            t["promised_in_days"] = int(pc["days"])
    upd["terms"] = t
    return upd


@api.post("/actions/{aid}/counter-decision")
async def counter_decision(aid: str, payload: dict = Body(...)):
    a = await get_action(aid)
    offer = await db.offers.find_one({"token": a.get("offer_token")}, NO_ID)
    if not offer or not offer.get("pending_counter") or a["status"] != "countered":
        raise HTTPException(400, "No counter waiting for your decision")
    pc = offer["pending_counter"]
    if payload.get("accept"):
        upd = apply_counter_terms(a, pc, today())
        await db.actions.update_one({"id": aid}, {"$set": upd})
        await db.offers.update_one({"token": a["offer_token"]}, {"$set": {"pending_counter": None}})
        await add_msg(aid, "Maria", "maria", "approved", "Maria approved the counter.")
        a = await get_action(aid)
        await accept_action(a, "Counter terms agreed.")
    else:
        await db.offers.update_one({"token": a["offer_token"]}, {"$set": {"pending_counter": None, "status": "open"}})
        await db.actions.update_one({"id": aid}, {"$set": {"status": "approved"}})
        await add_msg(aid, "Maria's billing assistant", "us", "declined",
                      "Thanks for the counter. Maria can't take that one; our original offer still stands.")
    return {"ok": True}


# ------------------------------------------------------------------ public offer page

async def offer_public(token):
    offer = await db.offers.find_one({"token": token}, NO_ID)
    if not offer:
        raise HTTPException(404, "Offer not found")
    a = await get_action(offer["action_id"])
    t = a["terms"]
    summary = {"type": a["type"], "type_label": E.TYPE_LABEL[a["type"]]}
    if a["type"] == "collect":
        summary.update(amount_due=a["cash_by_deadline"])
    elif a["type"] == "early_pay":
        summary.update(discount_pct=t["discount_pct"], expires=t["expires"], amount_due=a["cash_by_deadline"])
    elif a["type"] == "split":
        summary.update(first=t["first"], second=t["second"], second_date=t["second_date"], amount_due=t["first"],
                       second_paid=bool(t.get("second_paid")), second_open=a["status"] == "paid" and not t.get("second_paid"))
    else:
        summary.update(fee_pct=t["fee_pct"], fee=E.r2(a["invoice_amount"] * t["fee_pct"] / 100), new_due=t["new_due"])
    hist = await all_docs("messages", {"thread_id": a["id"], "side": {"$in": ["us", "them"]}}, ("ts", 1))
    return {"token": token, "business": E.BUSINESS_NAME, "counterparty": a["counterparty"],
            "invoice": {"number": a["invoice_number"], "amount": a["invoice_amount"], "due_date": a["invoice_due"]},
            "offer": summary, "status": offer["status"], "pending_counter": offer.get("pending_counter"),
            "language": offer.get("language", "en"), "payable": a["type"] != "extension",
            "history": [{"ts": m["ts"], "actor": m["actor"], "kind": m["kind"], "text": m["text"]} for m in hist[1:]]}


@api.get("/offers/{token}")
async def get_offer(token: str):
    return await offer_public(token)


@api.post("/offers/{token}")
async def post_offer(token: str, payload: dict = Body(default={})):
    act = payload.get("action")
    if act == "accept":
        return await offer_accept(token)
    if act == "decline":
        return await offer_decline(token)
    if act == "counter":
        return await offer_counter(token, payload)
    return await offer_public(token)


@api.post("/offers/{token}/accept")
async def offer_accept(token: str):
    offer = await db.offers.find_one({"token": token}, NO_ID)
    if not offer:
        raise HTTPException(404, "Offer not found")
    if offer["status"] not in ("open",):
        raise HTTPException(400, f"Offer is {offer['status']}")
    a = await get_action(offer["action_id"])
    await accept_action(a, "Accepted on the offer page.")
    return await offer_public(token)


@api.post("/offers/{token}/decline")
async def offer_decline(token: str):
    offer = await db.offers.find_one({"token": token}, NO_ID)
    if not offer:
        raise HTTPException(404, "Offer not found")
    if offer["status"] not in ("open",):
        raise HTTPException(400, f"Offer is {offer['status']}")
    a = await get_action(offer["action_id"])
    await db.offers.update_one({"token": token}, {"$set": {"status": "declined"}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"status": "declined"}})
    await add_msg(a["id"], a["counterparty"], "them", "declined", "Declined on the offer page.")
    await log_activity(f"{a['counterparty']} declined the {E.TYPE_LABEL[a['type']].lower()} offer", "declined")
    return await offer_public(token)


@api.post("/offers/{token}/counter")
async def offer_counter(token: str, payload: dict = Body(...)):
    offer = await db.offers.find_one({"token": token}, NO_ID)
    if not offer:
        raise HTTPException(404, "Offer not found")
    if offer["status"] != "open":
        raise HTTPException(400, f"Offer is {offer['status']}")
    a = await get_action(offer["action_id"])
    settings = await get_settings()
    percent = payload.get("percent")
    days = payload.get("days")
    note = (payload.get("note") or "").strip()[:300]
    if percent in ("", None) and days in ("", None):
        raise HTTPException(400, "Enter a percent or a number of days")
    pc = {}
    if percent not in ("", None):
        percent = round(float(percent), 2)
        if a["type"] not in ("early_pay", "extension"):
            raise HTTPException(400, "Percent counters apply to discounts and fees only; counter with days instead")
        word = "discount" if a["type"] == "early_pay" else "fee"
        await add_msg(a["id"], a["counterparty"], "them", "counter", f"Counter: {percent}% {word}. {note}".strip())
        allowed, lim, reason = E.guardrail_counter(a["type"], percent, settings)
        if not allowed:
            orig = a["terms"]["discount_pct"] if a["type"] == "early_pay" else a["terms"]["fee_pct"]
            await add_msg(a["id"], "Guardrail (code)", "code", "guardrail", reason.replace(f"countered at {lim}%", f"kept the offer at {orig}%"))
            await add_msg(a["id"], "Maria's billing assistant", "us", "counter",
                          f"Thanks for coming back to us. We can't go to {percent}%, but our offer of {orig}% still stands.")
            await log_activity(f"Guardrail blocked {a['counterparty']}'s {percent}% counter (limit {lim}%)", "guardrail")
            return {**(await offer_public(token)), "guardrail": {"blocked": True, "reason": reason}}
        pc["percent"] = percent
        await add_msg(a["id"], "Guardrail (code)", "code", "guardrail", reason + " Waiting for Maria's approval.")
    if days not in ("", None):
        days = int(days)
        if days < 1 or days > 60:
            raise HTTPException(400, "Days must be between 1 and 60")
        pc["days"] = days
        if "percent" not in pc:
            await add_msg(a["id"], a["counterparty"], "them", "counter", f"Counter: {days} days. {note}".strip())
            await add_msg(a["id"], "Guardrail (code)", "code", "guardrail", "Timing counter recorded. Waiting for Maria's approval.")
    await db.offers.update_one({"token": token}, {"$set": {"status": "countered", "pending_counter": pc}})
    await db.actions.update_one({"id": a["id"]}, {"$set": {"status": "countered"}})
    await log_activity(f"{a['counterparty']} countered; waiting for Maria", "counter")
    return {**(await offer_public(token)), "guardrail": {"blocked": False}}


# ------------------------------------------------------------------ payments (Stripe test)

@api.post("/payments/checkout")
async def payments_checkout(payload: dict = Body(...)):
    token = payload.get("token")
    origin = (payload.get("origin_url") or "").rstrip("/")
    offer = await db.offers.find_one({"token": token}, NO_ID)
    if not offer:
        raise HTTPException(404, "Offer not found")
    a = await get_action(offer["action_id"])
    part = "second" if payload.get("part") == "second" else "main"
    if part == "second":
        if a["type"] != "split" or a["status"] != "paid" or a["terms"].get("second_paid"):
            raise HTTPException(400, "The second payment isn't open")
        amount = E.r2(a["terms"]["second"])
    else:
        if offer["status"] != "accepted":
            raise HTTPException(400, "Accept the offer before paying")
        amount = E.r2(a["cash_by_deadline"])
    label = " · 2nd payment" if part == "second" else ""
    try:
        s = await asyncio.to_thread(
            stripe.checkout.Session.create, mode="payment",
            line_items=[{"price_data": {"currency": "usd", "unit_amount": int(round(amount * 100)),
                                        "product_data": {"name": f"{E.BUSINESS_NAME} · invoice {a['invoice_number']}{label} (TEST)"}},
                         "quantity": 1}],
            success_url=f"{origin}/o/{token}?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/o/{token}?cancelled=1",
            metadata={"token": token, "action_id": a["id"], "part": part})
    except Exception as e:
        log.warning("stripe checkout failed: %s", e)
        raise HTTPException(502, "Stripe test checkout is unavailable. Use 'Mark as paid (demo)'.")
    await db.payment_transactions.insert_one({"session_id": s.id, "token": token, "action_id": a["id"], "amount": amount,
                                              "part": part,
                                              "currency": "usd", "status": "initiated", "payment_status": "pending",
                                              "created_at": now_iso()})
    return {"url": s.url, "session_id": s.id}


async def settle_session(session_id):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, NO_ID)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if tx["payment_status"] != "paid":
        try:
            s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid":
                res = await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "complete", "payment_status": "paid", "updated_at": now_iso()}})
                if res.modified_count:
                    a = await get_action(tx["action_id"])
                    if tx.get("part") == "second":
                        await record_second_payment(a, "Card · Stripe test checkout")
                    else:
                        await record_payment(a, "Card · Stripe test checkout")
            elif s.status == "expired":
                await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": "expired"}})
        except stripe.error.StripeError as e:
            log.warning("stripe status: %s", e)
        tx = await db.payment_transactions.find_one({"session_id": session_id}, NO_ID)
    return {"session_id": session_id, "status": tx["status"], "payment_status": tx["payment_status"]}


@api.get("/payments/status")
async def payments_status(session_id: str):
    return await settle_session(session_id)


@api.get("/payments/status/{session_id}")
async def payments_status_path(session_id: str):
    return await settle_session(session_id)


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    if event["type"] == "checkout.session.completed":
        try:
            await settle_session(event["data"]["object"]["id"])
        except HTTPException:
            pass
    return {"status": "ok"}


# ------------------------------------------------------------------ simulator

async def simulate_payroll():
    settings = await get_settings()
    actions = await all_docs("actions")
    active = sorted([a for a in actions if a["status"] in E.ACTIVE_STATES], key=lambda a: E.SIM_ORDER[a["type"]])
    if not active:
        if any(a["status"] == "proposed" for a in actions):
            return {"ok": False, "message": "Nothing is waiting on a reply. Approve actions on the Plan first."}
        return {"ok": False, "message": "All counterparties have responded."}
    # skip a human-lane supplier when AI is off
    a = active[0]
    if a["type"] == "extension" and not settings.get("supplier_has_ai"):
        others = [x for x in active if x["type"] != "extension"]
        if not others:
            return {"ok": False, "message": "Pacific Lumber is answering by hand on this lane. Open their offer page from the outbox to respond.",
                    "link_token": a.get("offer_token")}
        a = others[0]
    cp = a["counterparty"]
    if a["type"] == "collect":
        await add_msg(a["id"], cp, "them", "reply", "Thanks for the reminder, sending payment today.")
        await record_payment(await get_action(a["id"]), "Bank transfer (simulated)")
        return {"ok": True, "message": f"{cp} paid {E.fmt_money(a['cash_by_deadline'])}"}
    if a["type"] == "early_pay":
        if a["status"] != "accepted":
            await accept_action(a, f"We'll take the {a['terms']['discount_pct']}% and pay today.")
        await record_payment(await get_action(a["id"]), "Card · Stripe test (simulated)")
        return {"ok": True, "message": f"{cp} accepted {a['terms']['discount_pct']}% off and paid {E.fmt_money(a['cash_by_deadline'])}"}
    if a["type"] == "split":
        if a["status"] != "accepted":
            await accept_action(a, "The split works for us. Sending the first half now.")
        await record_payment(await get_action(a["id"]), "Bank transfer (simulated)")
        return {"ok": True, "message": f"{cp} accepted the split and paid {E.fmt_money(a['terms']['first'])}"}
    # extension, supplier AI agent lane
    await db.threads.update_one({"id": a["id"]}, {"$set": {"badge": "Agent <-> Agent"}})
    await add_msg(a["id"], "Pacific Lumber agent", "them", "counter", "Counter: net+10 for a 1.0% fee.",
                  {"type": "counter", "invoice": a["invoice_number"], "amount": a["invoice_amount"], "terms": "net+10", "fee_pct": 1.0})
    _, lim, reason = E.guardrail_counter("extension", 1.0, settings)
    await add_msg(a["id"], "Guardrail (code)", "code", "guardrail",
                  f"{reason} Maria approved {a['terms']['fee_pct']}%, so the agent counters at {a['terms']['fee_pct']}%.")
    await add_msg(a["id"], "Maria's billing assistant", "us", "counter",
                  f"Counter: net+10 at {a['terms']['fee_pct']}% ({E.fmt_money(a['cost'])}).",
                  {"type": "counter", "invoice": a["invoice_number"], "terms": "net+10", "fee_pct": a["terms"]["fee_pct"],
                   "new_due": a["terms"]["new_due"]})
    await accept_action(a, f"Accepted: net+10 at {a['terms']['fee_pct']}%.")
    return {"ok": True, "message": f"Pacific Lumber's agent countered 1.0%, we countered {a['terms']['fee_pct']}%, they accepted"}


@api.post("/demo/simulate-next")
async def simulate_next(payload: dict = Body(default={})):
    await ensure_seed()
    if payload.get("screen") == "buy":
        return await buy_next()
    return await simulate_payroll()


# ------------------------------------------------------------------ settings, activity, outbox, threads

@api.get("/settings")
async def read_settings():
    return await get_settings()


@api.put("/settings")
async def write_settings(payload: dict = Body(...)):
    s = await get_settings()
    upd = {}
    for k, lo, hi in (("max_early_pay_pct", 0, 10), ("max_ext_fee_pct", 0, 10)):
        if k in payload:
            v = float(payload[k])
            if not lo <= v <= hi:
                raise HTTPException(400, f"{k} must be between {lo} and {hi}")
            upd[k] = v
    if payload.get("tone") in ("friendly", "firm"):
        upd["tone"] = payload["tone"]
    if payload.get("language") in ("en", "es"):
        upd["language"] = payload["language"]
    if "max_late_credit_pct" in payload:
        v = float(payload["max_late_credit_pct"])
        if not 0 <= v <= 5:
            raise HTTPException(400, "max_late_credit_pct must be between 0 and 5")
        upd["max_late_credit_pct"] = v
    for k in ("supplier_has_ai", "llm_force_fail", "auto_late_credit"):
        if k in payload:
            upd[k] = bool(payload[k])
    upd["require_approval"] = True  # always, enforced in code
    await db.settings.update_one({"id": "settings"}, {"$set": upd})
    if "tone" in upd or "language" in upd:
        s2 = {**s, **upd}
        for a in await all_docs("actions", {"status": "proposed"}):
            await db.actions.update_one({"id": a["id"]}, {"$set": {"draft": E.draft_message(a, s2["tone"], s2["language"], today())}})
    return await get_settings()


@api.get("/activity")
async def activity():
    await ensure_seed()
    _, _, _, st = await status_bundle()
    return {"items": await all_docs("activity_log", None, ("ts", -1)), "money_secured": st["secured"], "status": st}


@api.get("/outbox")
async def outbox():
    await ensure_seed()
    return {"items": await all_docs("outbox", None, ("ts", -1))}


@api.get("/threads")
async def threads():
    await ensure_seed()
    out = []
    for t in await all_docs("threads"):
        a = await get_action(t["action_id"])
        offer = await db.offers.find_one({"token": a.get("offer_token")}, NO_ID) if a.get("offer_token") else None
        out.append({**t, "status": a["status"], "type_label": E.TYPE_LABEL[a["type"]], "token": a.get("offer_token"),
                    "cash": a["cash_by_deadline"], "pending_counter": (offer or {}).get("pending_counter"),
                    "sim_order": E.SIM_ORDER[a["type"]], "second_paid": bool(a["terms"].get("second_paid")),
                    "messages": await all_docs("messages", {"thread_id": t["id"]}, ("ts", 1))})
    out.sort(key=lambda x: x["sim_order"])
    return {"threads": out}


# ------------------------------------------------------------------ invoices

def fallback_invoice_parse(text):
    amts = [float(x.replace(",", "")) for x in re.findall(r"\$\s?([\d,]+(?:\.\d{1,2})?)", text)]
    m = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    num = re.search(r"(?:invoice|inv)\s*#?\s*([A-Z0-9-]{3,})", text, re.I)
    party = re.search(r"(?:from|bill to|customer|vendor)\s*[:\-]?\s*([A-Za-z0-9&.' ]{2,40})", text, re.I)
    kind = "payable" if re.search(r"\b(bill from|vendor|supplier|we owe)\b", text, re.I) else "receivable"
    return {"kind": kind, "party": party.group(1).strip() if party else "", "number": num.group(1) if num else "",
            "amount": max(amts) if amts else None, "due_date": m.group(1) if m else ""}


@api.post("/invoices/parse")
async def parse_invoice(payload: dict = Body(...)):
    text = (payload.get("text") or "")[:4000]
    settings = await get_settings()
    out = await llm_text("Extract invoice fields. Return JSON only: {\"kind\":\"receivable|payable\",\"party\":str,"
                         "\"number\":str,\"amount\":number,\"due_date\":\"YYYY-MM-DD\"}. Today is " + E.iso(today()),
                         text, settings.get("llm_force_fail"))
    j = extract_json(out)
    if j and j.get("amount"):
        try:
            j["amount"] = float(j["amount"])
            return {"fields": j, "source": "ai"}
        except Exception:
            pass
    return {"fields": fallback_invoice_parse(text), "source": "fallback"}


@api.post("/invoices")
async def add_invoice(payload: dict = Body(...)):
    try:
        amount = E.r2(float(payload["amount"]))
        due = E.iso(E.d(payload["due_date"]))
        party = str(payload["party"]).strip()[:60]
        assert amount > 0 and party
    except Exception:
        raise HTTPException(400, "Party, a positive amount and a due date (YYYY-MM-DD) are required")
    num = (payload.get("number") or uid("INV")[:12]).upper()
    if payload.get("kind") == "payable":
        await db.payables.insert_one({"id": uid("pay"), "vendor": party, "number": num, "amount": amount, "due_date": due,
                                      "status": "scheduled", "kind": "other"})
    else:
        await db.receivables.insert_one({"id": uid("rcv"), "customer": party, "number": num, "amount": amount,
                                         "due_date": due, "avg_days_late": 0, "status": "open", "paid_amount": 0.0,
                                         "contact": ""})
    await log_activity(f"Invoice added: {party} {num} {E.fmt_money(amount)} due {E.fmt_date(due)}", "invoice")
    return {"ok": True}


# ------------------------------------------------------------------ BUY: materials agent

def mandate_for(T, max_total=3600.0):
    thu = E.friday_for(T) - timedelta(days=1)
    return {"max_total": max_total, "deliver_by_date": E.iso(thu), "deliver_by_time": "7:00 AM",
            "latest_delivery": f"{E.fmt_date(thu)} · 7:00 AM", "preferred_terms": "net+10 or better",
            "suppliers": [s["name"] for s in E.SUPPLIERS], "final_approval": "Maria",
            "site": "Nguyen Kitchen job site"}


async def create_seed_request(email=None, items=None, max_total=3600.0, source="seeded"):
    T = today()
    await db.purchase_requests.delete_many({})
    for c in ("rfq_threads", "quotes", "shipments"):
        await db[c].delete_many({})
    await db.payables.delete_many({"kind": "materials"})
    req = {"id": uid("req"), "stage": "request", "round": 0, "email": email or E.SEED_REQUEST_EMAIL,
           "inbox": "orders@bayremodel.gapless.app", "items": items or [dict(x) for x in E.SEED_ITEMS],
           "mandate": mandate_for(T, max_total), "parse_source": source, "selected": None, "pay_choice": None,
           "spend_request": None, "created_at": now_iso(),
           "supplier_lang": {s["id"]: "en" for s in E.SUPPLIERS}}
    await db.purchase_requests.insert_one(dict(req))
    return req


async def get_req(rid=None):
    q = {"id": rid} if rid else {}
    r = await db.purchase_requests.find_one(q, NO_ID)
    if not r:
        raise HTTPException(404, "Purchase request not found")
    return r


async def rfq_msg(rid, sid, actor, side, text, structured=None, internal=False):
    m = {"id": uid("rm"), "ts": now_iso(), "actor": actor, "side": side, "text": text, "structured": structured}
    field = "internal" if internal else "messages"
    await db.rfq_threads.update_one({"request_id": rid, "supplier_id": sid}, {"$push": {field: m}})
    if side == "us" and not internal:
        s = next(x for x in E.SUPPLIERS if x["id"] == sid)
        await db.outbox.insert_one({"id": uid("out"), "ts": now_iso(), "to": s["contact"], "counterparty": s["name"],
                                    "subject": "Materials request · Nguyen Kitchen", "body": text, "link": None,
                                    "channel": "agent" if structured else "email", "scope": "buy", "simulated": True})


def pay_options(req, quote, fri_balance, T):
    F = E.friday_for(T)
    if not quote:
        return None
    if quote["supplier_id"] == "pacific":
        early_amt = E.r2(quote["total"] * 0.98)
        ok, after, msg = E.pay_early_check(fri_balance, early_amt)
        wed = max(T, F - timedelta(days=2))
        return {"early": {"amount": early_amt, "saves": E.r2(quote["total"] - early_amt), "pay_by": E.iso(wed),
                          "allowed": ok, "friday_after": after, "message": msg, "friday_now": fri_balance},
                "due": {"amount": quote["total"], "date": quote["due_date"]}}
    return {"delivery": {"amount": quote["total"], "date": quote["due_date"]}}


@api.get("/buy/current")
async def buy_current():
    await ensure_seed()
    T = today()
    req = await get_req()
    _, _, fc, st = await status_bundle()
    threads = await all_docs("rfq_threads", {"request_id": req["id"]})
    order = {s["id"]: i for i, s in enumerate(E.SUPPLIERS)}
    threads.sort(key=lambda t: order.get(t["supplier_id"], 9))
    quotes = await all_docs("quotes", {"request_id": req["id"]})
    quotes.sort(key=lambda q: (not q["recommended"], q["total"]))
    sel = next((q for q in quotes if q["supplier_id"] == req.get("selected")), None)
    ship = await db.shipments.find_one({"request_id": req["id"]}, NO_ID)
    rec = next((q for q in quotes if q["recommended"]), None)
    other = next((q for q in quotes if not q["recommended"]), None)
    compare = None
    if rec and other:
        diff = E.r2(rec["total"] - other["total"])
        if diff > 0:
            compare = (f"{rec['supplier_name'].split()[0]} costs {E.fmt_money(diff)} more, but {rec['terms']} keeps "
                       f"{E.fmt_money(other['total'])} out of Friday's gap.")
        else:
            compare = f"{rec['supplier_name']} is cheaper and keeps cash out of Friday's gap."
    return {"request": req, "threads": threads, "quotes": quotes, "compare": compare, "shipment": ship,
            "pay_options": pay_options(req, sel, fc["friday_balance"], T), "friday_balance": fc["friday_balance"],
            "friday_label": fc["friday_label"], "status": st, "suppliers": E.SUPPLIERS,
            "route": E.ROUTE, "steps": E.SHIP_STEPS}


@api.post("/buy/requests")
async def buy_parse_request(payload: dict = Body(...)):
    text = (payload.get("text") or "").strip()[:4000]
    if not text:
        raise HTTPException(400, "Paste the request email first")
    settings = await get_settings()
    out = await llm_text(
        "Extract a building-materials order. Return JSON only: {\"items\":[{\"name\":str,\"qty\":int,\"unit\":str}],"
        "\"max_total\":number}. Do not invent items.", text, settings.get("llm_force_fail"))
    j = extract_json(out)
    items, max_total, source = None, 3600.0, "fallback (seeded request)"
    if j and isinstance(j.get("items"), list) and j["items"]:
        try:
            seed_by_kw = {"plywood": "ply34", "stud": "stud8", "screw": "screw5"}
            items = []
            for it in j["items"][:10]:
                name = str(it["name"])[:60]
                sku = next((v for k, v in seed_by_kw.items() if k in name.lower()), "misc")
                items.append({"sku": sku, "name": name, "qty": int(it["qty"]), "unit": str(it.get("unit") or "units")[:20]})
            if j.get("max_total"):
                max_total = float(j["max_total"])
            source = "ai"
        except Exception:
            items = None
    if not items:
        m = re.search(r"\$\s?([\d,]{3,})", text)
        if m:
            max_total = float(m.group(1).replace(",", ""))
    req = await create_seed_request(text, items, max_total, source)
    await log_activity(f"New materials request received in the simulated inbox (parsed by {source})", "buy", scope="buy")
    return req


def stage_guard(req, *stages):
    if req["stage"] not in stages:
        raise HTTPException(400, f"Not available at the '{req['stage']}' step")


@api.post("/buy/{rid}/start")
async def buy_start(rid: str):
    req = await get_req(rid)
    stage_guard(req, "request")
    m = req["mandate"]
    item_txt = "\n".join(f"- {i['qty']} {i['unit']}: {i['name']}" for i in req["items"])
    for s in E.SUPPLIERS:
        await db.rfq_threads.insert_one({"id": uid("rfq"), "request_id": rid, "supplier_id": s["id"], "supplier_name": s["name"],
                                         "lane": s["lane"], "status": "rfq_sent", "messages": [], "internal": []})
        if s["lane"] == "agent_agent":
            await rfq_msg(rid, s["id"], "Maria's assistant", "us", "Request for quote (structured).",
                          {"type": "rfq", "items": [{"item": i["name"], "qty": i["qty"]} for i in req["items"]],
                           "terms_requested": "net+10", "deadline": m["latest_delivery"], "deliver_to": m["site"]})
        else:
            await rfq_msg(rid, s["id"], "Maria's assistant", "us",
                          E.buy_text("rfq", slang(req, s["id"]), name=s["name"], site=m["site"], deadline=m["latest_delivery"], items=item_txt))
    await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "sourcing", "round": 0}})
    await log_activity("Sourcing started: quote requests sent (simulated) to 3 saved suppliers", "buy", scope="buy")
    return await buy_current()


@api.get("/suppliers/scorecard")
async def supplier_scorecard():
    await ensure_seed()
    cards = [E.scorecard(h) for h in await all_docs("supplier_history")]
    order = {s["id"]: i for i, s in enumerate(E.SUPPLIERS)}
    cards.sort(key=lambda c: order.get(c["supplier_id"], 9))
    return {"cards": cards, "rule": (f"Recommendation = least cash due before Friday, then lowest effective cost. Effective cost adds "
                                     f"{E.RELIABILITY_RATE * 100}% of the price for each on-time point below {E.RELIABILITY_TARGET}%. "
                                     f"Every finished order updates this record.")}


async def make_quotes(req):
    T = today()
    hist = {h["supplier_id"]: E.scorecard(h) for h in await all_docs("supplier_history")}
    F = E.friday_for(T)
    thu = F - timedelta(days=1)
    items = req["items"]
    pac_lines = E.price_lines(items, E.PRICES[("pacific", "final")])
    bay_lines = E.price_lines(items, E.PRICES[("bayside", "quote")]) + [
        {"name": "Early delivery (7:00 AM)", "qty": 1, "unit": "fee", "unit_price": 60.0, "total": 60.0}]
    first = {"pacific": E.lines_total(E.price_lines(items, E.PRICES[("pacific", "quote")])),
             "bayside": E.lines_total(E.price_lines(items, E.PRICES[("bayside", "quote")]))}
    qs = [("pacific", pac_lines, "net+10", E.iso(thu + timedelta(days=10)), "7:00 AM"),
          ("bayside", bay_lines, "due on delivery", E.iso(thu), "7:00 AM")]
    out = []
    for sid, lines, terms, due, time in qs:
        s = next(x for x in E.SUPPLIERS if x["id"] == sid)
        total = E.lines_total(lines)
        before_fri = E.d(due) <= F
        sc = hist.get(sid) or {}
        on_time = sc.get("on_time_pct", s["on_time"])
        risk, eff = E.reliability_adjust(total, on_time)
        out.append({"id": uid("q"), "request_id": req["id"], "supplier_id": sid, "supplier_name": s["name"], "lane": s["lane"],
                    "lines": lines, "total": total, "terms": terms, "due_date": due, "delivery": f"{E.fmt_date(thu)} · {time}",
                    "on_time": on_time, "orders_on_record": sc.get("orders", 0), "late_recent": sc.get("late_recent", 0),
                    "reliability_risk": risk, "effective_total": eff, "first_quote": first[sid], "cash_before_friday": total if before_fri else 0.0,
                    "cash_impact": (f"{E.fmt_money(total)} due {E.fmt_date(due)}, before payroll" if before_fri else "$0 before Friday"),
                    "impact_bad": before_fri, "within_mandate": total <= req["mandate"]["max_total"]})
    eligible = [q for q in out if q["within_mandate"]]
    if eligible:
        best = min(eligible, key=lambda q: (q["cash_before_friday"], q["effective_total"]))
        best["recommended"] = True
    for q in out:
        q.setdefault("recommended", False)
        await db.quotes.insert_one(dict(q))


@api.post("/buy/{rid}/advance")
async def buy_advance(rid: str):
    req = await get_req(rid)
    stage_guard(req, "sourcing")
    rnd = req["round"] + 1
    m = req["mandate"]
    items = req["items"]
    if rnd == 1:
        pl = E.price_lines(items, E.PRICES[("pacific", "quote")])
        await rfq_msg(rid, "pacific", "Pacific Lumber agent", "them", f"Quote: {E.fmt_money(E.lines_total(pl))}, net+10, delivery {m['latest_delivery']}.",
                      {"type": "quote", "lines": pl, "price": E.lines_total(pl), "terms": "net+10", "deadline": m["latest_delivery"]})
        bl = E.price_lines(items, E.PRICES[("bayside", "quote")])
        await rfq_msg(rid, "bayside", "Dana at Bayside Building Supply", "them",
                      E.buy_text("bay_quote", slang(req, "bayside"), total=E.fmt_money(E.lines_total(bl))))
        await rfq_msg(rid, "eastbay", "System", "system", "Waiting for a reply…")
        await db.rfq_threads.update_many({"request_id": rid, "supplier_id": {"$in": ["pacific", "bayside"]}}, {"$set": {"status": "quoted"}})
    elif rnd == 2:
        counter = E.lines_total(E.price_lines(items, E.PRICES[("pacific", "final")])) + 10.0
        ok, why = E.check_buy_counter(counter, m)
        await rfq_msg(rid, "pacific", "Rule check (code)", "code", why, internal=True)
        if not ok:
            counter = m["max_total"]
            await rfq_msg(rid, "pacific", "Rule check (code)", "code", f"Countering at your limit instead: {E.fmt_money(counter)}.", internal=True)
        await rfq_msg(rid, "pacific", "Maria's assistant", "us", f"Counter: {E.fmt_money(counter)}, keep net+10.",
                      {"type": "counter", "price": counter, "terms": "net+10", "deadline": m["latest_delivery"]})
        await rfq_msg(rid, "bayside", "Rule check (code)", "code",
                      f"Thursday 11:00 AM misses the {m['deliver_by_time']} deadline; asking for 7:00 AM and net+10.", internal=True)
        await rfq_msg(rid, "bayside", "Maria's assistant", "us", E.buy_text("ask", slang(req, "bayside")))
        await db.rfq_threads.update_many({"request_id": rid, "supplier_id": {"$in": ["pacific", "bayside"]}}, {"$set": {"status": "negotiating"}})
    else:
        fl = E.price_lines(items, E.PRICES[("pacific", "final")])
        await rfq_msg(rid, "pacific", "Pacific Lumber agent", "them", f"Final: {E.fmt_money(E.lines_total(fl))}, net+10, delivery {m['latest_delivery']}.",
                      {"type": "final", "lines": fl, "price": E.lines_total(fl), "terms": "net+10", "deadline": m["latest_delivery"]})
        await rfq_msg(rid, "bayside", "Dana at Bayside Building Supply", "them",
                      E.buy_text("bay_final", slang(req, "bayside"),
                                 total=E.fmt_money(E.lines_total(E.price_lines(items, E.PRICES[('bayside', 'quote')])) + 60)))
        await rfq_msg(rid, "eastbay", "System", "system", "No reply after 2 hours. Excluded from the comparison.")
        await db.rfq_threads.update_many({"request_id": rid, "supplier_id": {"$in": ["pacific", "bayside"]}}, {"$set": {"status": "final"}})
        await db.rfq_threads.update_one({"request_id": rid, "supplier_id": "eastbay"}, {"$set": {"status": "excluded"}})
        await db.supplier_history.update_many({"supplier_id": {"$in": ["pacific", "bayside"]}}, {"$inc": {"rfqs": 1, "replies": 1}})
        await db.supplier_history.update_one({"supplier_id": "eastbay"}, {"$inc": {"rfqs": 1}})
        await make_quotes(req)
        await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "quotes", "round": rnd}})
        await log_activity("Sourcing complete: 2 final quotes, East Bay Hardware excluded (no reply)", "buy", scope="buy")
        return await buy_current()
    await db.purchase_requests.update_one({"id": rid}, {"$set": {"round": rnd}})
    return await buy_current()


@api.post("/buy/{rid}/counter")
async def buy_counter(rid: str, payload: dict = Body(...)):
    req = await get_req(rid)
    stage_guard(req, "sourcing", "quotes")
    sid = payload.get("supplier_id")
    if sid not in ("pacific", "bayside"):
        raise HTTPException(400, "Pick Pacific Lumber or Bayside")
    try:
        price = E.r2(float(payload.get("price")))
    except Exception:
        raise HTTPException(400, "Enter a price")
    ok, why = E.check_buy_counter(price, req["mandate"])
    await rfq_msg(rid, sid, "Rule check (code)", "code", why, internal=True)
    if not ok:
        await log_activity(f"Blocked by code: counter of {E.fmt_money(price)} is above the mandate", "guardrail", scope="buy")
        raise HTTPException(400, why)
    if sid == "pacific":
        await rfq_msg(rid, sid, "Maria's assistant", "us", f"Counter: {E.fmt_money(price)}.", {"type": "counter", "price": price, "terms": "net+10"})
    else:
        await rfq_msg(rid, sid, "Maria's assistant", "us", E.buy_text("counter", slang(req, sid), price=E.fmt_money(price)))
    return await buy_current()


@api.post("/buy/{rid}/approve-quote")
async def buy_approve_quote(rid: str, payload: dict = Body(...)):
    req = await get_req(rid)
    stage_guard(req, "quotes")
    sid = payload.get("supplier_id")
    if sid in (None, "none", ""):
        await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "denied"}})
        await log_activity("Maria denied all quotes. Nothing was committed.", "buy", scope="buy")
        return await buy_current()
    q = await db.quotes.find_one({"request_id": rid, "supplier_id": sid}, NO_ID)
    if not q:
        raise HTTPException(404, "Quote not found")
    if not q["within_mandate"]:
        raise HTTPException(400, f"Blocked by code: {E.fmt_money(q['total'])} is above your {E.fmt_money(req['mandate']['max_total'])} limit")
    await db.payables.insert_one({"id": f"pay_mat_{rid}", "vendor": f"{q['supplier_name']} (materials)", "number": "PO-" + rid[-5:].upper(),
                                  "amount": q["total"], "due_date": q["due_date"], "status": "scheduled", "kind": "materials"})
    await rfq_msg(rid, sid, "Maria's assistant", "us",
                  "Maria approved your quote. Please confirm the order." if sid == "pacific" else E.buy_text("confirm", slang(req, sid)),
                  {"type": "order", "price": q["total"], "terms": q["terms"]} if sid == "pacific" else None)
    if sid == "pacific":
        T = today()
        wed = max(T, E.friday_for(T) - timedelta(days=2))
        early = E.r2(q["total"] * 0.98)
        await rfq_msg(rid, sid, "Pacific Lumber agent", "them",
                      f"Order confirmed. Optional: 2% off ({E.fmt_money(early)}) if paid by {E.fmt_date(wed)}.",
                      {"type": "early_pay_offer", "discount_pct": 2.0, "amount": early, "pay_by": E.iso(wed)})
    await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "pay", "selected": sid}})
    await log_activity(f"Maria approved {q['supplier_name']} at {E.fmt_money(q['total'])} ({q['terms']})", "buy", q["total"], "buy")
    return await buy_current()


@api.post("/buy/{rid}/pay-decision")
async def buy_pay_decision(rid: str, payload: dict = Body(...)):
    req = await get_req(rid)
    stage_guard(req, "pay")
    T = today()
    q = await db.quotes.find_one({"request_id": rid, "supplier_id": req["selected"]}, NO_ID)
    _, _, fc, _ = await status_bundle()
    opts = pay_options(req, q, fc["friday_balance"], T)
    choice = payload.get("choice")
    if choice not in opts:
        raise HTTPException(400, f"Choose one of: {', '.join(opts)}")
    o = opts[choice]
    if choice == "early" and not o["allowed"]:
        raise HTTPException(400, o["message"])
    lines = q["lines"] + ([{"name": "Early-pay discount (2%)", "qty": 1, "unit": "", "unit_price": -o["saves"], "total": -o["saves"]}]
                          if choice == "early" else [])
    when = "now" if choice == "early" else o["date"]
    sr = {"id": uid("sr"), "amount": o["amount"], "merchant": q["supplier_name"], "requested_by": "Maria's billing assistant",
          "credential": "One-time virtual card", "limit": f"{E.fmt_money(o['amount'])} at {q['supplier_name']} only",
          "line_items": lines, "when": when, "choice": choice, "status": "pending", "test_mode": True,
          "note": "The agent never sees or holds card details."}
    await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "spend", "pay_choice": choice, "spend_request": sr}})
    return await buy_current()


@api.post("/buy/{rid}/spend-request/approve")
async def buy_spend_approve(rid: str, payload: dict = Body(default={})):
    req = await get_req(rid)
    stage_guard(req, "spend")
    sr = dict(req["spend_request"])
    T = today()
    if payload.get("approve") is False:
        sr["status"] = "declined"
        await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "pay", "spend_request": sr}})
        await log_activity("Spend request declined in Link (test). Nothing was charged.", "buy", scope="buy")
        return await buy_current()
    pay_id = f"pay_mat_{rid}"
    if sr["when"] == "now":
        mode, ref = "demo", None
        try:
            pi = await asyncio.to_thread(
                stripe.PaymentIntent.create, amount=int(round(sr["amount"] * 100)), currency="usd",
                payment_method="pm_card_visa", confirm=True,
                automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
                description=f"Gapless TEST · {sr['merchant']} materials", metadata={"request_id": rid})
            if pi.status == "succeeded":
                mode, ref = "stripe_test", pi.id
        except Exception as e:
            log.warning("stripe PI failed, demo mode: %s", e)
        sr.update(status="paid", mode=mode, ref=ref, paid_at=now_iso())
        await db.payables.update_one({"id": pay_id}, {"$set": {"status": "paid", "paid_date": E.iso(T), "paid_amount": sr["amount"]}})
        await rfq_msg(rid, req["selected"], "Pacific Lumber agent", "them", f"Payment of {E.fmt_money(sr['amount'])} received. Invoice paid.",
                      {"type": "receipt", "amount": sr["amount"], "status": "paid"} if req["selected"] == "pacific" else None)
        await log_activity(f"Invoice paid: {E.fmt_money(sr['amount'])} to {sr['merchant']} via one-time card "
                           f"({'Stripe test' if mode == 'stripe_test' else 'demo mode'})", "buy", sr["amount"], "buy")
    else:
        sr.update(status="scheduled", mode="scheduled")
        await log_activity(f"Spend request approved: {E.fmt_money(sr['amount'])} to {sr['merchant']} scheduled for {E.fmt_date(sr['when'])}",
                           "buy", sr["amount"], "buy")
    sup = req["selected"]
    await db.shipments.insert_one({"id": uid("shp"), "request_id": rid, "supplier_id": sup,
                                   "supplier_name": next(s["name"] for s in E.SUPPLIERS if s["id"] == sup),
                                   "step": 0, "eta": "6:50 AM", "deadline": "7:00 AM", "delayed": False, "alert": None,
                                   "ref": "PL-20931" if sup == "pacific" else "BB-5528",
                                   "asked": "carrier, reference, driver contact", "carrier": "Bay Freight (simulated)",
                                   "history": [{"step": 0, "label": E.SHIP_STEPS[0], "ts": now_iso()}],
                                   "matched": None, "backup": None})
    await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "delivery", "spend_request": sr}})
    return await buy_current()


async def get_ship(rid):
    s = await db.shipments.find_one({"request_id": rid}, NO_ID)
    if not s:
        raise HTTPException(400, "No shipment yet")
    return s


@api.post("/buy/{rid}/shipment/advance")
async def ship_advance(rid: str):
    s = await get_ship(rid)
    if s["step"] >= 4:
        raise HTTPException(400, "Already delivered")
    step = s["step"] + 1
    upd = {"step": step}
    await db.shipments.update_one({"request_id": rid}, {"$set": upd, "$push": {"history": {"step": step, "label": E.SHIP_STEPS[step], "ts": now_iso()}}})
    if step == 4:
        await log_activity(f"Delivered to the Nguyen Kitchen job site (ref {s['ref']})", "buy", scope="buy")
        settings = await get_settings()
        if s.get("delayed") and settings.get("auto_late_credit") and not s.get("credit"):
            await request_late_credit(await get_req(rid), {**s, "step": 4}, settings)
    return await buy_current()


async def request_late_credit(req, s, settings):
    rid, sid = req["id"], req["selected"]
    sr = req["spend_request"]
    cap = float(settings.get("max_late_credit_pct", 0))
    if cap <= 0:
        await rfq_msg(rid, sid, "Rule check (code)", "code", "Late-delivery credit limit is 0%, so the agent did not ask.", internal=True)
        return
    ask, gpct, granted = E.late_credit(sr["amount"], cap, sid)
    lang = slang(req, sid)
    name = s["supplier_name"]
    await rfq_msg(rid, sid, "Rule check (code)", "code",
                  f"Truck arrived 30 min late. Asking {E.fmt_money(ask)} ({cap}%), within your {cap}% late-delivery credit limit.", internal=True)
    if sid == "pacific":
        await rfq_msg(rid, sid, "Maria's assistant", "us", "Late-delivery credit request.",
                      {"type": "credit_request", "ref": s["ref"], "minutes_late": 30, "amount": ask})
        await rfq_msg(rid, sid, "Pacific Lumber agent", "them", f"Credit offered: {E.fmt_money(granted)}.",
                      {"type": "credit_offer", "ref": s["ref"], "amount": granted, "pct": gpct})
    else:
        await rfq_msg(rid, sid, "Maria's assistant", "us", E.buy_text("credit_ask", lang, name=name, ref=s["ref"], late=30, ask=E.fmt_money(ask)))
        await rfq_msg(rid, sid, f"Dana at {name}", "them", E.buy_text("credit_reply", lang, granted=E.fmt_money(granted), who=f"Dana, {name}"))
    pay_id = f"pay_mat_{rid}"
    pay = await db.payables.find_one({"id": pay_id}, NO_ID)
    if pay and pay["status"] == "scheduled":
        await db.payables.update_one({"id": pay_id}, {"$set": {"amount": E.r2(pay["amount"] - granted)}})
        applied = f"taken off the {E.fmt_date(pay['due_date'])} payment"
    else:
        await db.cashflow_events.insert_one({"id": f"cf_credit_{rid}", "date": E.iso(today()), "amount": granted,
                                             "label": f"{name} late-delivery credit", "kind": "buy_credit"})
        applied = "refunded to the one-time card"
    await rfq_msg(rid, sid, "Rule check (code)", "code",
                  f"{E.fmt_money(granted)} is at or below the ask, so it was accepted automatically (a credit only lowers what you owe).", internal=True)
    await db.shipments.update_one({"request_id": rid}, {"$set": {"credit": {
        "asked": ask, "ask_pct": cap, "granted": granted, "granted_pct": gpct, "applied": applied}}})
    await log_activity(f"Late-delivery credit: asked {name} for {E.fmt_money(ask)}, got {E.fmt_money(granted)} ({applied})",
                       "buy", granted, "buy")


def slang(req, sid):
    return (req.get("supplier_lang") or {}).get(sid, "en")


@api.post("/buy/{rid}/supplier-language")
async def buy_supplier_language(rid: str, payload: dict = Body(...)):
    await get_req(rid)
    sid, lang = payload.get("supplier_id"), payload.get("language")
    if sid not in [s["id"] for s in E.SUPPLIERS] or lang not in ("en", "es"):
        raise HTTPException(400, "Pick a saved supplier and en/es")
    await db.purchase_requests.update_one({"id": rid}, {"$set": {f"supplier_lang.{sid}": lang}})
    return await buy_current()


@api.get("/digest")
async def weekly_digest():
    await ensure_seed()
    T = today()
    data, actions, fc, st = await status_bundle()
    F = E.friday_for(T)
    mon, sun = F - timedelta(days=4), F + timedelta(days=2)
    week_items = [x for x in fc["items"] if E.iso(mon) <= x["date"] <= E.iso(sun)]
    opens = [{"counterparty": a["counterparty"], "type_label": E.TYPE_LABEL[a["type"]], "amount": a["cash_by_deadline"],
              "status": a["status"]} for a in sorted(actions, key=lambda a: a["rank"]) if a["status"] in E.ACTIVE_STATES]
    drafts = [a["counterparty"] for a in actions if a["status"] == "proposed" and a.get("selected")]
    horizon = E.iso(F + timedelta(days=14))
    sup = sorted([{"vendor": p["vendor"], "amount": p["amount"], "due_date": p["due_date"], "kind": p.get("kind")}
                  for p in data["payables"] if p["status"] == "scheduled" and p.get("kind") != "payroll"
                  and E.iso(T) <= p["due_date"] <= horizon], key=lambda p: p["due_date"])
    rems = [r for r in await all_docs("reminders", None, ("send_on", 1)) if r["status"] in ("draft", "approved")]
    headline = (f"Payroll on {fc['friday_label']} is covered with {E.fmt_money(st['spare'])} to spare." if st["covered"]
                else f"Short {E.fmt_money(st['remaining'])} for payroll on {fc['friday_label']}.")
    lines = [f"Monday digest · week of {E.fmt_date(mon)} · {E.BUSINESS_NAME}", headline,
             f"Friday projected balance: {E.fmt_money(fc['friday_balance'])}. Lowest point next 4 weeks: "
             f"{E.fmt_money(fc['lowest']['balance'])} on {E.fmt_date(fc['lowest']['date'])}.",
             f"Open offers ({len(opens)}): " + ("; ".join(f"{o['counterparty']} {E.fmt_money(o['amount'])} ({o['status']})" for o in opens) or "none"),
             f"Drafts waiting for your approval: {', '.join(drafts) or 'none'}",
             "Upcoming supplier payments: " + ("; ".join(f"{p['vendor']} {E.fmt_money(p['amount'])} on {E.fmt_date(p['due_date'])}" for p in sup) or "none"),
             "Gapless · demo, synthetic data"]
    return {"week_of": E.iso(mon), "week_label": f"Week of {E.fmt_date(mon)}", "headline": headline, "status": st,
            "friday_label": fc["friday_label"], "friday_balance": fc["friday_balance"], "lowest": fc["lowest"],
            "week_items": week_items, "open_offers": opens, "drafts": drafts, "supplier_payments": sup,
            "reminders": rems, "text": "\n".join(lines)}


@api.post("/buy/{rid}/shipment/delay")
async def ship_delay(rid: str):
    s = await get_ship(rid)
    if s["step"] >= 4:
        raise HTTPException(400, "Already delivered")
    await db.shipments.update_one({"request_id": rid}, {"$set": {"eta": "7:30 AM", "delayed": True, "alert": {
        "text": "Truck will miss your 7:00 AM deadline", "detail": "New ETA 7:30 AM (+40 min).", "resolved": False}}})
    await log_activity("Delivery alert: truck running 40 min late, will miss 7:00 AM", "alert", scope="buy")
    return await buy_current()


@api.post("/buy/{rid}/shipment/backup")
async def ship_backup(rid: str, payload: dict = Body(...)):
    s = await get_ship(rid)
    choice = payload.get("choice")
    if choice == "hold":
        await db.outbox.insert_one({"id": uid("out"), "ts": now_iso(), "to": "sales@baysidebuilding.example",
                                    "counterparty": "Bayside Building Supply", "subject": "Backup stock hold · Nguyen Kitchen",
                                    "body": E.buy_text("hold", slang(await get_req(rid), "bayside")), "link": None,
                                    "channel": "email", "scope": "buy", "simulated": True})
        text = "Asked Bayside to hold backup stock (simulated)."
    else:
        text = "Keeping the original delivery."
    alert = dict(s.get("alert") or {}, resolved=True, resolution=text)
    await db.shipments.update_one({"request_id": rid}, {"$set": {"backup": choice, "alert": alert}})
    await log_activity(text, "buy", scope="buy")
    return await buy_current()


@api.post("/buy/{rid}/receipt/match")
async def receipt_match(rid: str):
    req = await get_req(rid)
    s = await get_ship(rid)
    if s["step"] < 4:
        raise HTTPException(400, "Wait until the delivery arrives")
    q = await db.quotes.find_one({"request_id": rid, "supplier_id": req["selected"]}, NO_ID)
    received = [{"name": i["name"], "qty": i["qty"]} for i in req["items"]]
    qty_ok = all(any(l["name"] == r["name"] and l["qty"] == r["qty"] for l in q["lines"]) for r in received)
    invoice_amount = req["spend_request"]["amount"]
    amt_ok = abs(invoice_amount - req["spend_request"]["amount"]) < 0.01 and invoice_amount <= q["total"]
    matched = qty_ok and amt_ok
    if not s.get("matched"):
        await db.supplier_history.update_one({"supplier_id": req["selected"]}, {"$push": {"orders": {
            "date": E.iso(today()), "quoted": q.get("first_quote", q["total"]), "final": q["total"],
            "on_time": not s.get("delayed"), "minutes_late": 30 if s.get("delayed") else 0, "job": "Nguyen Kitchen"}}})
        await log_activity(f"Scorecard updated: {q['supplier_name']} delivered {'late (+30 min)' if s.get('delayed') else 'on time'}",
                           "buy", scope="buy")
    await db.shipments.update_one({"request_id": rid}, {"$set": {"matched": {
        "ok": matched, "received": received, "invoice_amount": invoice_amount, "approved_amount": req["spend_request"]["amount"],
        "quote_total": q["total"]}}})
    if matched:
        await db.purchase_requests.update_one({"id": rid}, {"$set": {"stage": "done"}})
    await log_activity("Receipt matched ✓ quantities and invoice match the approved quote" if matched else "Receipt mismatch: review needed",
                       "buy", scope="buy")
    return await buy_current()


async def buy_next():
    req = await get_req()
    rid, st = req["id"], req["stage"]
    if st == "request":
        await buy_start(rid)
        return {"ok": True, "message": "Sourcing started"}
    if st == "sourcing":
        await buy_advance(rid)
        return {"ok": True, "message": f"Round {req['round'] + 1} of negotiation"}
    if st == "quotes":
        q = await db.quotes.find_one({"request_id": rid, "recommended": True}, NO_ID)
        await buy_approve_quote(rid, {"supplier_id": q["supplier_id"]})
        return {"ok": True, "message": f"Maria approved {q['supplier_name']}"}
    if st == "pay":
        cur = await buy_current()
        opts = cur["pay_options"]
        if "early" in opts and opts["early"]["allowed"]:
            choice = "early"
        else:
            choice = "due" if "due" in opts else "delivery"
        await buy_pay_decision(rid, {"choice": choice})
        msg = "Pay early allowed: spend request ready" if choice == "early" else (
            "Pay early is blocked (Friday would go negative), so paying on the due date" if "early" in opts else "Pay on delivery")
        return {"ok": True, "message": msg}
    if st == "spend":
        await buy_spend_approve(rid, {"approve": True})
        return {"ok": True, "message": "Spend request approved in Link (test)"}
    if st == "delivery":
        s = await get_ship(rid)
        if s["step"] < 4:
            await ship_advance(rid)
            return {"ok": True, "message": E.SHIP_STEPS[s["step"] + 1]}
        await receipt_match(rid)
        return {"ok": True, "message": "Receipt matched ✓"}
    return {"ok": False, "message": "This order is complete. Reset to run it again." if st == "done" else "All quotes were denied."}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
