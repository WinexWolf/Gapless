"""Gapless deterministic engine. Plain Python only: all money, dates, rankings and
guardrail decisions live here. The LLM never touches these numbers."""
from datetime import date, timedelta
from collections import defaultdict

BUSINESS_NAME = "Bay Remodel Co."
OWNER = "Maria Alvarez"
OPENING_BALANCE = 12000.0
COVER_FACTOR = 1.15


def d(s):
    return date.fromisoformat(s) if isinstance(s, str) else s


def iso(x):
    return x.isoformat()


def r2(x):
    return round(float(x) + 0.0, 2)


def friday_for(T):
    """Next upcoming Friday; if today is Friday use +7 days."""
    k = (4 - T.weekday()) % 7
    return T + timedelta(days=k if k else 7)


def fmt_money(x):
    x = r2(x)
    sign = "-" if x < 0 else ""
    x = abs(x)
    if abs(x - round(x)) < 0.005:
        return f"{sign}${x:,.0f}"
    return f"{sign}${x:,.2f}"


DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DAYS_ES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
MON_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def fmt_date(x, lang="en"):
    x = d(x)
    if lang == "es":
        return f"{DAYS_ES[x.weekday()]} {x.day} {MON_ES[x.month - 1]}"
    return f"{DAYS_EN[x.weekday()]}, {MON_EN[x.month - 1]} {x.day}"


# ---------------------------------------------------------------- seed

def seed_docs(T):
    F = friday_for(T)
    D = lambda n: timedelta(days=n)
    receivables = [
        {"id": "rcv_smith", "customer": "Smith Bath", "number": "INV-1041", "amount": 2000.0,
         "due_date": iso(min(T + D(3), F - D(1))), "avg_days_late": 0, "status": "open", "paid_amount": 0.0,
         "contact": "ap@smithbath.example"},
        {"id": "rcv_lee", "customer": "Lee Bathroom", "number": "INV-1032", "amount": 3600.0,
         "due_date": iso(T - D(5)), "avg_days_late": 6, "status": "open", "paid_amount": 0.0,
         "contact": "billing@leebathroom.example"},
        {"id": "rcv_patel", "customer": "Patel Deck", "number": "INV-1027", "amount": 4800.0,
         "due_date": iso(T - D(9)), "avg_days_late": 12, "status": "open", "paid_amount": 0.0,
         "contact": "accounts@pateldeck.example"},
        {"id": "rcv_johnson", "customer": "Johnson Kitchen", "number": "INV-1019", "amount": 6200.0,
         "due_date": iso(T - D(21)), "avg_days_late": 24, "status": "open", "paid_amount": 0.0,
         "contact": "office@johnsonkitchen.example"},
    ]
    payables = [
        {"id": "pay_payroll", "vendor": "Payroll (6 employees)", "number": "PAYROLL", "amount": 18500.0,
         "due_date": iso(F), "status": "scheduled", "kind": "payroll"},
        {"id": "pay_pacific", "vendor": "Pacific Lumber", "number": "PL-77812", "amount": 4100.0,
         "due_date": iso(F), "status": "scheduled", "kind": "supplier", "contact": "ar@pacificlumber.example"},
        {"id": "pay_insurance", "vendor": "Insurance premium", "number": "INS-2210", "amount": 1200.0,
         "due_date": iso(F), "status": "scheduled", "kind": "insurance"},
    ]
    ev = lambda i, n, amt, label: {"id": i, "date": iso(F + D(n)), "amount": amt, "label": label, "kind": "scheduled"}
    cashflow_events = [
        ev("cf_rent", 4, -3500.0, "Shop rent"),
        ev("cf_hernandez", 6, 5200.0, "Hernandez Fence payment"),
        ev("cf_baytool", 7, -2200.0, "Bay Tool & Supply"),
        ev("cf_nguyen", 12, 6000.0, "Nguyen Kitchen deposit"),
        ev("cf_fuel", 13, -2400.0, "Fuel and tools"),
        ev("cf_roof", 20, -5500.0, "Roof subcontractor"),
    ]
    business = {"id": "biz", "name": BUSINESS_NAME, "owner": OWNER, "employees": 6,
                "bank_balance": OPENING_BALANCE, "seed_date": iso(T)}
    return {"business": [business], "receivables": receivables, "payables": payables,
            "cashflow_events": cashflow_events, "payments": []}


DEFAULT_SETTINGS = {"id": "settings", "max_early_pay_pct": 2.0, "max_ext_fee_pct": 1.0,
                    "require_approval": True, "tone": "friendly", "language": "en",
                    "supplier_has_ai": True, "llm_force_fail": False}


# ---------------------------------------------------------------- forecast

def forecast(data, T, include_buy=True):
    """Committed cash only: bank balance, receivables not overdue (on due date),
    received payments, scheduled payables and scheduled events. Overdue invoices are
    informational only (likely arrival)."""
    F = friday_for(T)
    end = max(T + timedelta(days=27), F + timedelta(days=24))
    flows = defaultdict(float)
    items = []

    def add(day, amt, label, kind):
        day = max(d(day), T)
        if day > end:
            return
        flows[day] += amt
        items.append({"date": iso(day), "amount": r2(amt), "label": label, "kind": kind})

    for r in data["receivables"]:
        if r["status"] == "open" and d(r["due_date"]) >= T:
            add(r["due_date"], r["amount"] - r.get("paid_amount", 0), f"{r['customer']} {r['number']}", "receivable")
    for p in data["payments"]:
        add(p["date"], p["amount"], p["label"], "payment")
    for p in data["payables"]:
        if p.get("kind") == "materials" and not include_buy:
            continue
        if p["status"] == "scheduled":
            add(p["due_date"], -p["amount"], p["vendor"], "payable")
        elif p["status"] == "paid":
            add(p.get("paid_date", iso(T)), -p.get("paid_amount", p["amount"]), p["vendor"] + " (paid)", "payable")
    for e in data["cashflow_events"]:
        add(e["date"], e["amount"], e["label"], e.get("kind", "scheduled"))

    biz = data["business"][0] if isinstance(data["business"], list) else data["business"]
    bal = float(biz["bank_balance"])
    days = []
    cur = T
    while cur <= end:
        bal += flows.get(cur, 0.0)
        days.append({"date": iso(cur), "balance": r2(bal), "flow": r2(flows.get(cur, 0.0))})
        cur += timedelta(days=1)
    by_date = {x["date"]: x["balance"] for x in days}
    fri_bal = by_date[iso(F)]
    weeks = [{"label": "Payday", "sub": fmt_date(F), "end_date": iso(F), "balance": fri_bal}]
    for k in (2, 3, 4):
        e = F + timedelta(days=7 * (k - 1) + 3)
        weeks.append({"label": f"Week {k}", "sub": "to " + fmt_date(e), "end_date": iso(e), "balance": by_date[iso(e)]})
    first_neg = next((x for x in days if x["balance"] < 0), None)
    lowest = min(days, key=lambda x: x["balance"])
    likely = []
    for r in data["receivables"]:
        if r["status"] == "open" and d(r["due_date"]) < T:
            ld = d(r["due_date"]) + timedelta(days=r["avg_days_late"])
            likely.append({"customer": r["customer"], "number": r["number"], "amount": r["amount"],
                           "due_date": r["due_date"], "days_overdue": (T - d(r["due_date"])).days,
                           "avg_days_late": r["avg_days_late"], "likely_date": iso(max(ld, T))})
    items.sort(key=lambda x: x["date"])
    return {"today": iso(T), "friday": iso(F), "friday_label": fmt_date(F), "friday_balance": fri_bal,
            "days": days, "weeks": weeks, "items": items, "likely_arrivals": likely,
            "first_negative": first_neg, "lowest": lowest}


SECURED_STATES = ("paid", "secured")
ACTIVE_STATES = ("approved", "accepted", "countered")


def payroll_status(data, actions, T):
    fc = forecast(data, T, include_buy=False)
    secured = r2(sum(a.get("secured_amount", 0) for a in actions if a["status"] in SECURED_STATES))
    gap = r2(max(0.0, -(fc["friday_balance"] - secured)))
    pending = r2(sum(a["cash_by_deadline"] for a in actions if a["status"] in ACTIVE_STATES))
    remaining = r2(max(0.0, gap - secured))
    return {"gap": gap, "secured": secured, "pending": pending, "remaining": remaining,
            "covered": gap > 0 and secured >= gap, "spare": r2(secured - gap)}


# ---------------------------------------------------------------- plan

TYPE_LABEL = {"collect": "Collect", "split": "Split", "early_pay": "Early-pay", "extension": "Supplier extension"}
SIM_ORDER = {"collect": 1, "early_pay": 2, "split": 3, "extension": 4}


def build_candidates(data, T):
    F = friday_for(T)
    R = {r["id"]: r for r in data["receivables"]}
    P = {p["id"]: p for p in data["payables"]}
    lee, patel, john, pac = R["rcv_lee"], R["rcv_patel"], R["rcv_johnson"], P["pay_pacific"]
    wed = F - timedelta(days=2)
    expires = wed if T <= wed else T
    disc = 1.5
    fee_pct = 0.75
    half = r2(john["amount"] / 2)
    second = F + timedelta(days=14)
    acts = [
        {"id": "act_lee", "type": "collect", "counterparty": lee["customer"], "target_id": lee["id"],
         "invoice_number": lee["number"], "invoice_amount": lee["amount"], "invoice_due": lee["due_date"],
         "contact": lee["contact"], "cash_by_deadline": lee["amount"], "probability": 0.85, "cost": 0.0,
         "friction": 1, "terms": {}},
        {"id": "act_patel", "type": "early_pay", "counterparty": patel["customer"], "target_id": patel["id"],
         "invoice_number": patel["number"], "invoice_amount": patel["amount"], "invoice_due": patel["due_date"],
         "contact": patel["contact"], "cash_by_deadline": r2(patel["amount"] * (1 - disc / 100)),
         "probability": 0.75, "cost": r2(patel["amount"] * disc / 100), "friction": 2,
         "terms": {"discount_pct": disc, "expires": iso(expires)}},
        {"id": "act_johnson", "type": "split", "counterparty": john["customer"], "target_id": john["id"],
         "invoice_number": john["number"], "invoice_amount": john["amount"], "invoice_due": john["due_date"],
         "contact": john["contact"], "cash_by_deadline": half, "probability": 0.60, "cost": 0.0, "friction": 2,
         "terms": {"first": half, "second": r2(john["amount"] - half), "second_date": iso(second), "days": 14}},
        {"id": "act_pacific", "type": "extension", "counterparty": pac["vendor"], "target_id": pac["id"],
         "invoice_number": pac["number"], "invoice_amount": pac["amount"], "invoice_due": pac["due_date"],
         "contact": pac["contact"], "cash_by_deadline": pac["amount"], "probability": 0.75,
         "cost": r2(pac["amount"] * fee_pct / 100), "friction": 2,
         "terms": {"fee_pct": fee_pct, "days": 10, "new_due": iso(F + timedelta(days=10))}},
    ]
    alts = [
        {"id": "alt_patel", "type": "collect", "counterparty": patel["customer"], "label": "Plain reminder to Patel Deck",
         "cash_by_deadline": patel["amount"], "probability": 0.55, "cost": 0.0, "friction": 1,
         "instead_of": "act_patel"},
        {"id": "alt_johnson", "type": "collect", "counterparty": john["customer"], "label": "Plain reminder to Johnson Kitchen",
         "cash_by_deadline": john["amount"], "probability": 0.35, "cost": 0.0, "friction": 1,
         "instead_of": "act_johnson"},
    ]
    for a in acts + alts:
        a["expected"] = r2(a["cash_by_deadline"] * a["probability"])
        a["cost_per_expected"] = round(a["cost"] / a["expected"], 5) if a["expected"] else 0
    return acts, alts


def rank_actions(acts, gap):
    """Cheapest cost per expected dollar first, then lowest friction; add until
    expected cash >= 1.15 x gap."""
    target = r2(COVER_FACTOR * gap)
    ordered = sorted(acts, key=lambda a: (a["cost_per_expected"], a["friction"], a["id"]))
    total = 0.0
    for i, a in enumerate(ordered):
        a["rank"] = i + 1
        a["selected"] = total < target
        if a["selected"]:
            total += a["expected"]
    return ordered, target, r2(total)


def rule_checks(action, settings):
    t = action["type"]
    terms = action.get("terms", {})
    checks = []
    if t == "early_pay":
        ok = terms["discount_pct"] <= settings["max_early_pay_pct"]
        checks.append({"ok": ok, "text": f"Discount {terms['discount_pct']}% is within your {settings['max_early_pay_pct']}% early-pay limit"})
    if t == "extension":
        ok = terms["fee_pct"] <= settings["max_ext_fee_pct"]
        checks.append({"ok": ok, "text": f"Fee {terms['fee_pct']}% ({fmt_money(action['cost'])}) is within your {settings['max_ext_fee_pct']}% fee limit"})
    checks.append({"ok": True, "text": "Business-to-business message, polite, no threats"})
    checks.append({"ok": True, "text": "Signed by Maria's billing assistant and includes an opt-out line"})
    checks.append({"ok": True, "text": "Maria's approval recorded before anything is sent"})
    checks.append({"ok": True, "text": "Simulated outbox: nothing is actually sent"})
    return checks


def guardrail_counter(action_type, percent, settings):
    """Returns (allowed, limit, reason). Code-enforced; never the LLM."""
    if action_type == "early_pay":
        lim = settings["max_early_pay_pct"]
        if percent > lim:
            return False, lim, f"{percent}% discount is above Maria's {lim}% early-pay limit, so code declined it and countered at {lim}%."
        return True, lim, f"{percent}% discount is within Maria's {lim}% limit."
    if action_type == "extension":
        lim = settings["max_ext_fee_pct"]
        if percent > lim:
            return False, lim, f"{percent}% fee is above Maria's {lim}% fee limit, so code declined it and countered at {lim}%."
        return True, lim, f"{percent}% fee is within Maria's {lim}% fee limit."
    return False, 0, "Percent counters don't apply to this offer."


def plan_explanation(acts_sorted, gap, target, total, F):
    sel = [a for a in acts_sorted if a.get("selected")]
    free = [a["counterparty"] for a in sel if a["cost"] == 0]
    paid = [f"{a['counterparty']} ({fmt_money(a['cost'])})" for a in sel if a["cost"] > 0]
    s1 = (f"Payroll on {fmt_date(F)} leaves you {fmt_money(gap)} short because your overdue invoices "
          f"aren't counted as cash until someone commits to pay.")
    s2 = (f"The plan starts with free asks to {' and '.join(free) or 'customers'}, then adds "
          f"{' and '.join(paid) or 'nothing paid'}, for {fmt_money(total)} expected cash against a "
          f"{fmt_money(target)} target (115% of the gap).")
    return s1 + " " + s2


# ---------------------------------------------------------------- drafts

SIGN = {"en": "Maria's billing assistant, on behalf of Maria Alvarez\nBay Remodel Co.",
        "es": "Asistente de cobros de Maria, en nombre de Maria Alvarez\nBay Remodel Co."}
OPTOUT = {"en": "Prefer not to get these messages? Reply STOP and we won't contact you about this again.",
          "es": "¿Prefiere no recibir estos mensajes? Responda STOP y no volveremos a escribirle sobre esto."}
LINK_PH = "[secure offer link]"

TPL = {
    ("collect", "en", "friendly"): ("Friendly reminder: invoice {num}",
        "Hi {cp} team,\n\nJust a friendly reminder that invoice {num} for {amt} was due on {due}. If payment is already on its way, thank you! If not, you can review and pay it here: {link}"),
    ("collect", "en", "firm"): ("Invoice {num} is {late} days past due",
        "Hello {cp} team,\n\nInvoice {num} for {amt} is now {late} days past its due date ({due}). Please arrange payment by {fri}. You can review and pay it here: {link}"),
    ("collect", "es", "friendly"): ("Recordatorio amable: factura {num}",
        "Hola equipo de {cp}:\n\nLe recordamos amablemente que la factura {num} por {amt} venció el {due}. Si el pago ya está en camino, ¡gracias! Si no, puede revisarla y pagarla aquí: {link}"),
    ("collect", "es", "firm"): ("La factura {num} tiene {late} días de atraso",
        "Hola equipo de {cp}:\n\nLa factura {num} por {amt} tiene {late} días de atraso (venció el {due}). Le pedimos programar el pago antes del {fri}. Puede revisarla y pagarla aquí: {link}"),
    ("early_pay", "en", "friendly"): ("{pct}% off invoice {num} if paid by {exp}",
        "Hi {cp} team,\n\nInvoice {num} for {amt} is still open. If you pay by {exp}, we'll take {pct}% off, so you'd pay {net} instead. Details and payment: {link}"),
    ("early_pay", "en", "firm"): ("Settle invoice {num}: {pct}% off until {exp}",
        "Hello {cp} team,\n\nInvoice {num} for {amt} is {late} days overdue. To help settle it, we can offer {pct}% off ({net}) if paid by {exp}. After that the full amount applies. Details: {link}"),
    ("early_pay", "es", "friendly"): ("{pct}% de descuento en la factura {num} si paga antes del {exp}",
        "Hola equipo de {cp}:\n\nLa factura {num} por {amt} sigue abierta. Si paga antes del {exp}, le descontamos {pct}%, así pagaría {net}. Detalles y pago: {link}"),
    ("early_pay", "es", "firm"): ("Liquide la factura {num}: {pct}% de descuento hasta el {exp}",
        "Hola equipo de {cp}:\n\nLa factura {num} por {amt} tiene {late} días de atraso. Para ayudar a liquidarla, ofrecemos {pct}% de descuento ({net}) si paga antes del {exp}. Después aplica el monto completo. Detalles: {link}"),
    ("split", "en", "friendly"): ("Split invoice {num} into two payments?",
        "Hi {cp} team,\n\nWe know {amt} at once can be a lot. We're happy to split invoice {num} in two: {first} now and {second} on {date2}. You can accept the split here: {link}"),
    ("split", "en", "firm"): ("Invoice {num}: proposed two-part payment",
        "Hello {cp} team,\n\nInvoice {num} for {amt} is {late} days overdue. We can split it: {first} by {fri} and {second} on {date2}. Please confirm here: {link}"),
    ("split", "es", "friendly"): ("¿Dividimos la factura {num} en dos pagos?",
        "Hola equipo de {cp}:\n\nSabemos que {amt} de una vez puede ser mucho. Con gusto dividimos la factura {num} en dos: {first} ahora y {second} el {date2}. Puede aceptar aquí: {link}"),
    ("split", "es", "firm"): ("Factura {num}: propuesta de pago en dos partes",
        "Hola equipo de {cp}:\n\nLa factura {num} por {amt} tiene {late} días de atraso. Podemos dividirla: {first} antes del {fri} y {second} el {date2}. Confirme aquí: {link}"),
    ("extension", "en", "friendly"): ("Request: net+10 on invoice {num}",
        "Hi {cp} team,\n\nCould we move invoice {num} ({amt}, due {due}) to {newdue} (net+10)? We're happy to add a {fee_pct}% fee ({fee}). You can accept or reply here: {link}"),
    ("extension", "en", "firm"): ("Net+10 request for invoice {num}",
        "Hello {cp} team,\n\nWe'd like to request net+10 on invoice {num} ({amt}), moving the due date to {newdue}, with a {fee_pct}% fee ({fee}). Please confirm here: {link}"),
    ("extension", "es", "friendly"): ("Solicitud: neto+10 en la factura {num}",
        "Hola equipo de {cp}:\n\n¿Podríamos mover la factura {num} ({amt}, vence el {due}) al {newdue} (neto+10)? Con gusto agregamos un cargo de {fee_pct}% ({fee}). Puede aceptar o responder aquí: {link}"),
    ("extension", "es", "firm"): ("Solicitud de neto+10 para la factura {num}",
        "Hola equipo de {cp}:\n\nSolicitamos neto+10 en la factura {num} ({amt}), moviendo el vencimiento al {newdue}, con un cargo de {fee_pct}% ({fee}). Confirme aquí: {link}"),
}
THANKS = {"en": "Thank you,", "es": "Gracias,"}


def draft_message(action, tone, lang, T, link=LINK_PH):
    lang = lang if lang in ("en", "es") else "en"
    tone = tone if tone in ("friendly", "firm") else "friendly"
    F = friday_for(T)
    t = action["terms"]
    late = max(0, (T - d(action["invoice_due"])).days)
    v = {"cp": action["counterparty"], "num": action["invoice_number"], "amt": fmt_money(action["invoice_amount"]),
         "due": fmt_date(action["invoice_due"], lang), "late": late, "fri": fmt_date(F, lang), "link": link}
    if action["type"] == "early_pay":
        v.update(pct=t["discount_pct"], exp=fmt_date(t["expires"], lang),
                 net=fmt_money(action["invoice_amount"] * (1 - t["discount_pct"] / 100)))
    if action["type"] == "split":
        v.update(first=fmt_money(t["first"]), second=fmt_money(t["second"]), date2=fmt_date(t["second_date"], lang))
    if action["type"] == "extension":
        v.update(fee_pct=t["fee_pct"], fee=fmt_money(action["invoice_amount"] * t["fee_pct"] / 100),
                 newdue=fmt_date(t["new_due"], lang))
    subj, body = TPL[(action["type"], lang, tone)]
    body = body.format(**v) + f"\n\n{THANKS[lang]}\n{SIGN[lang]}\n\n{OPTOUT[lang]}"
    return {"subject": subj.format(**v), "body": body, "tone": tone, "language": lang, "source": "template"}


def ensure_safety(body, lang="en"):
    """Every outgoing payroll message is signed and carries an opt-out line."""
    if "billing assistant" not in body and "Asistente de cobros" not in body:
        body += f"\n\n{SIGN.get(lang, SIGN['en'])}"
    if "STOP" not in body:
        body += f"\n\n{OPTOUT.get(lang, OPTOUT['en'])}"
    return body


# ---------------------------------------------------------------- buy side

SEED_REQUEST_EMAIL = (
    "From: Maria Alvarez <maria@bayremodel.example>\n"
    "To: orders@bayremodel.gapless.app\n"
    "Subject: Materials for the Nguyen Kitchen job\n\n"
    "Hi,\n\nPlease order:\n"
    "- 40 sheets 3/4\" plywood\n"
    "- 120 2x4 studs, 8 ft\n"
    "- 12 boxes deck screws (5 lb)\n\n"
    "Deliver to the Nguyen Kitchen job site by Thursday 7:00 AM. Keep it under $3,600 and use my usual suppliers.\n\n"
    "Thanks,\nMaria")

SEED_ITEMS = [
    {"sku": "ply34", "name": "3/4\" plywood", "qty": 40, "unit": "sheets"},
    {"sku": "stud8", "name": "2x4 studs, 8 ft", "qty": 120, "unit": "studs"},
    {"sku": "screw5", "name": "Deck screws (5 lb box)", "qty": 12, "unit": "boxes"},
]

SUPPLIERS = [
    {"id": "pacific", "name": "Pacific Lumber", "lane": "agent_agent", "on_time": 96, "contact": "agent@pacificlumber.example"},
    {"id": "bayside", "name": "Bayside Building Supply", "lane": "agent_human", "on_time": 88, "contact": "sales@baysidebuilding.example"},
    {"id": "eastbay", "name": "East Bay Hardware", "lane": "agent_human", "on_time": 91, "contact": "orders@eastbayhardware.example"},
]

# Scripted unit prices per supplier per round (numbers are rules, not LLM output)
PRICES = {
    ("pacific", "quote"): {"ply34": 55.00, "stud8": 7.50, "screw5": 35.00, "misc": 13.00},     # 3,520
    ("pacific", "final"): {"ply34": 52.50, "stud8": 7.50, "screw5": 32.50, "misc": 12.50},     # 3,390
    ("bayside", "quote"): {"ply34": 52.00, "stud8": 7.25, "screw5": 30.00, "misc": 12.00},     # 3,310
}


def price_lines(items, prices):
    lines = []
    for it in items:
        u = prices.get(it["sku"], prices["misc"])
        lines.append({"name": it["name"], "qty": it["qty"], "unit": it["unit"], "unit_price": u, "total": r2(u * it["qty"])})
    return lines


def lines_total(lines):
    return r2(sum(x["total"] for x in lines))


def check_buy_counter(price, mandate):
    """Code-enforced: the agent may only counter inside Maria's mandate."""
    if price > mandate["max_total"]:
        return False, f"Blocked by code: {fmt_money(price)} is above your {fmt_money(mandate['max_total'])} limit. The agent can't offer it."
    return True, f"Rule check: {fmt_money(price)} is inside your {fmt_money(mandate['max_total'])} limit."


def pay_early_check(friday_balance, amount):
    after = r2(friday_balance - amount)
    if after < 0:
        return False, after, (f"Not yet: paying early would leave Friday at {fmt_money(after)}. "
                              f"Close the payroll gap first, or pay on the due date.")
    return True, after, f"OK: Friday stays at {fmt_money(after)} after paying early."


ROUTE = [[37.6470, -122.1260], [37.6880, -122.1560], [37.7280, -122.1940], [37.7520, -122.2050],
         [37.7790, -122.2290], [37.8080, -122.2500], [37.8440, -122.2520]]
SHIP_STEPS = ["Packed and loaded", "Left the yard", "On the highway", "Arriving in about 10 minutes", "Delivered"]
STEP_POINT = [0, 1, 3, 5, 6]


# ---------------------------------------------------------------- supplier scorecard

def supplier_history_seed(T):
    """Synthetic past record per supplier. Prior aggregates + the last 6 orders."""
    def recs(rows, late_idx=()):
        out = []
        for i, (q, f) in enumerate(rows):
            out.append({"date": iso(T - timedelta(days=7 * (len(rows) - i) + 3)), "quoted": float(q), "final": float(f),
                        "on_time": i not in late_idx, "minutes_late": 35 if i in late_idx else 0, "job": f"Past job #{i + 1}"})
        return out
    return [
        {"supplier_id": "pacific", "name": "Pacific Lumber", "prior_orders": 19, "prior_on_time": 18,
         "rfqs": 14, "replies": 14,
         "orders": recs([(2950, 2860), (4100, 3980), (1800, 1760), (3300, 3190), (2600, 2540), (3720, 3600)])},
        {"supplier_id": "bayside", "name": "Bayside Building Supply", "prior_orders": 19, "prior_on_time": 17,
         "rfqs": 12, "replies": 11,
         "orders": recs([(2750, 2750), (3900, 3860), (1650, 1650), (3100, 3060), (2400, 2400), (3500, 3480)], late_idx=(3,))},
        {"supplier_id": "eastbay", "name": "East Bay Hardware", "prior_orders": 5, "prior_on_time": 5,
         "rfqs": 10, "replies": 6,
         "orders": recs([(900, 900), (1200, 1180), (760, 760), (1450, 1420), (980, 980), (1300, 1300)], late_idx=(1,))},
    ]


RELIABILITY_TARGET = 95
RELIABILITY_RATE = 0.005  # each on-time point below 95% adds 0.5% to effective cost


def scorecard(h):
    orders = h["prior_orders"] + len(h["orders"])
    on_time = h["prior_on_time"] + sum(1 for o in h["orders"] if o["on_time"])
    savings = [(o["quoted"] - o["final"]) / o["quoted"] * 100 for o in h["orders"] if o["quoted"]]
    pct = round(on_time / orders * 100) if orders else 0
    return {"supplier_id": h["supplier_id"], "name": h["name"], "orders": orders, "on_time_count": on_time,
            "on_time_pct": pct, "reply_rate": round(h["replies"] / h["rfqs"] * 100) if h["rfqs"] else 0,
            "rfqs": h["rfqs"], "replies": h["replies"],
            "avg_negotiated_pct": round(sum(savings) / len(savings), 1) if savings else 0.0,
            "recent": h["orders"][-6:][::-1], "late_recent": sum(1 for o in h["orders"][-6:] if not o["on_time"])}


def reliability_adjust(total, on_time_pct):
    pts = max(0, RELIABILITY_TARGET - on_time_pct)
    risk = r2(total * pts * RELIABILITY_RATE)
    return risk, r2(total + risk)


# ---------------------------------------------------------------- installment reminder

REMINDER_TPL = {
    "en": ("Friendly heads-up: second payment on {date}",
           "Hi {cp} team,\n\nThank you again for the first {first} on invoice {num}. Just a friendly heads-up that the second "
           "payment of {amt} is scheduled for {date}. Nothing to do if it's already planned.\n\n"
           "Thank you,\n" + SIGN["en"] + "\n\n" + OPTOUT["en"]),
    "es": ("Aviso amable: segundo pago el {date}",
           "Hola equipo de {cp}:\n\nGracias de nuevo por el primer pago de {first} de la factura {num}. Les recordamos "
           "amablemente que el segundo pago de {amt} est\u00e1 programado para el {date}. Si ya est\u00e1 planeado, no tienen que hacer nada.\n\n"
           "Gracias,\n" + SIGN["es"] + "\n\n" + OPTOUT["es"]),
}
REMINDER_DAYS_BEFORE = 3


def reminder_draft(action, lang):
    lang = lang if lang in REMINDER_TPL else "en"
    t = action["terms"]
    v = {"cp": action["counterparty"], "num": action["invoice_number"], "first": fmt_money(t["first"]),
         "amt": fmt_money(t["second"]), "date": fmt_date(t["second_date"], lang)}
    s, b = REMINDER_TPL[lang]
    return s.format(**v), b.format(**v)
