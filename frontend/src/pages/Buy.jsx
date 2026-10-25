import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, Lock, Bot, User, Check, X, Truck, AlertTriangle, CreditCard, PackageCheck, Clock } from "lucide-react";
import { http, money, fdate, ftime, errMsg, useApp } from "@/lib/api";
import { Chip, Structured, Loading } from "@/components/Common";
import DeliveryMap from "@/pages/DeliveryMap";
import Scorecard from "@/components/Scorecard";

const STEPS = ["Request", "Sourcing", "Quotes", "Pay", "Delivery"];
const STAGE_IDX = { request: 0, sourcing: 1, quotes: 2, denied: 2, pay: 3, spend: 3, delivery: 4, done: 4 };

function Lane({ t, req, onCounter }) {
  const [price, setPrice] = useState("");
  const agent = t.lane === "agent_agent";
  return (
    <div className={`lane ${t.status === "excluded" ? "excluded" : ""}`} data-testid={`lane-${t.supplier_id}`}>
      <div className="lane-head">
        <b>{t.supplier_name}</b>
        <Chip kind={agent ? "chip-deep" : "chip-line"}>{agent ? <Bot size={13} /> : <User size={13} />} {agent ? "Agent ↔ Agent" : "Agent ↔ Human"}</Chip>
        <Chip kind={t.status === "excluded" ? "chip-red" : t.status === "final" ? "chip-green" : "chip-amber"}>{t.status.replace("_", " ")}</Chip>
        {(req.supplier_lang?.[t.supplier_id] === "es") && !agent && <Chip kind="chip-teal">Español</Chip>}
      </div>
      <div className="lane-msgs">
        {t.messages.map((m) => (
          <div key={m.id} className={`bubble b-${m.side}`}>
            <div className="tiny muted">{m.actor} · {ftime(m.ts)}</div>
            {m.structured ? <Structured data={m.structured} /> : <pre className="tl-text">{m.text}</pre>}
          </div>
        ))}
      </div>
      {t.internal.length > 0 && (
        <div className="internal" data-testid={`internal-${t.supplier_id}`}>
          <div className="tiny"><Lock size={12} /> Only you see this</div>
          {t.internal.map((m) => <div key={m.id} className={`small ${m.text.startsWith("Blocked") ? "t-red" : ""}`}>{m.text}</div>)}
        </div>
      )}
      {["sourcing", "quotes"].includes(req.stage) && t.supplier_id !== "eastbay" && (
        <div className="lane-counter">
          <input className="input" type="number" placeholder="Try a counter $" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Counter price for ${t.supplier_name}`} data-testid={`counter-input-${t.supplier_id}`} />
          <button className="btn btn-ghost btn-sm" onClick={() => onCounter(t.supplier_id, price)} disabled={!price} data-testid={`counter-send-${t.supplier_id}`}>Counter</button>
        </div>
      )}
    </div>
  );
}

export default function Buy() {
  const { tick, bump } = useApp();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => { http.get("/buy/current").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);

  const call = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const r = await http.post(path, body || {});
      if (r.data.request) setD(r.data);
      if (okMsg) toast.success(okMsg);
      bump();
      return true;
    } catch (e) { toast.error(errMsg(e)); return false; } finally { setBusy(false); }
  };

  if (!d) return <Loading />;
  const req = d.request;
  const rid = req.id;
  const idx = STAGE_IDX[req.stage];
  const sel = d.quotes.find((q) => q.supplier_id === req.selected);
  const sr = req.spend_request;
  const ship = d.shipment;
  const po = d.pay_options;

  const parse = async () => {
    setBusy(true);
    try {
      const r = await http.post("/buy/requests", { text: compose });
      toast.success(r.data.parse_source === "ai" ? "Request parsed" : "Couldn't parse with AI, using the standard request");
      setShowCompose(false); setCompose(""); bump();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="page" data-testid="buy-page">
      <div className="page-head"><div><div className="eyebrow">Materials agent</div><h1 className="h1">Buy what the job needs</h1></div>
        <div className="fri-pill" data-testid="buy-friday">Friday projected <b className={`num ${d.friday_balance < 0 ? "t-red" : "t-green"}`}>{money(d.friday_balance)}</b></div>
      </div>

      <ol className="steps" data-testid="buy-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < idx || req.stage === "done" ? "done" : i === idx ? "current" : ""} data-testid={`buy-step-${s.toLowerCase()}`}>
            <span className="step-dot">{i < idx || req.stage === "done" ? <Check size={14} /> : i + 1}</span><span className="step-label">{s}</span>
          </li>
        ))}
      </ol>

      {/* REQUEST */}
      <section className="card" data-testid="buy-request">
        <div className="sec-head"><h2 className="h3"><Inbox size={18} /> Simulated inbox · {req.inbox}</h2>
          {req.stage === "request" && <button className="btn btn-ghost btn-sm" onClick={() => setShowCompose(!showCompose)} data-testid="compose-toggle">Compose request email</button>}
        </div>
        {showCompose && (
          <div className="compose" data-testid="compose-box">
            <textarea className="input" rows={6} placeholder="Paste a materials request email…" value={compose} onChange={(e) => setCompose(e.target.value)} data-testid="compose-text" />
            <button className="btn btn-primary btn-sm" disabled={!compose.trim() || busy} onClick={parse} data-testid="compose-parse">Read this request</button>
          </div>
        )}
        <div className="buy-req-grid">
          <pre className="email" data-testid="request-email">{req.email}</pre>
          <div>
            <table className="tbl" data-testid="items-table">
              <thead><tr><th>Item</th><th className="r">Qty</th></tr></thead>
              <tbody>{req.items.map((i) => <tr key={i.name}><td>{i.name}</td><td className="r num">{i.qty} {i.unit}</td></tr>)}</tbody>
            </table>
            <div className="mandate" data-testid="mandate">
              <div className="eyebrow">Mandate · code-enforced</div>
              <div className="row"><span>Max total</span><b className="num">{money(req.mandate.max_total)}</b></div>
              <div className="row"><span>Latest delivery</span><b>{req.mandate.latest_delivery}</b></div>
              <div className="row"><span>Preferred terms</span><b>{req.mandate.preferred_terms}</b></div>
              <div className="row"><span>May contact</span><b>Only the 3 saved suppliers</b></div>
              <div className="row"><span>Final approval</span><b>Maria</b></div>
            </div>
            <div className="tiny muted">Parsed: {req.parse_source}</div>
            <div className="sup-lang" data-testid="supplier-languages">
              <div className="eyebrow">Email language per supplier</div>
              {d.suppliers.filter((s) => s.lane === "agent_human").map((s) => (
                <div className="row" key={s.id}><span>{s.name}</span>
                  <div className="seg sm" role="group" aria-label={`Language for ${s.name}`}>
                    {["en", "es"].map((l) => <button key={l} className={(req.supplier_lang?.[s.id] || "en") === l ? "on" : ""} disabled={busy} onClick={() => call(`/buy/${rid}/supplier-language`, { supplier_id: s.id, language: l }, l === "es" ? `${s.name} will get Spanish emails` : `${s.name} will get English emails`)} data-testid={`sup-lang-${l}-${s.id}`}>{l === "en" ? "English" : "Español"}</button>)}
                  </div>
                </div>
              ))}
              <div className="tiny muted">Pacific Lumber's lane is agent-to-agent structured data.</div>
            </div>
          </div>
        </div>
        {req.stage === "request" && <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => call(`/buy/${rid}/start`, null, "Quote requests sent")} data-testid="start-sourcing-btn">Start sourcing</button>}
      </section>

      {/* SOURCING */}
      {idx >= 1 && (
        <section className="card" data-testid="buy-sourcing">
          <div className="sec-head"><h2 className="h3">Sourcing · round {req.round} of 3</h2>
            {req.stage === "sourcing" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(`/buy/${rid}/advance`)} data-testid="next-round-btn">Next round</button>}
          </div>
          <div className="notice" data-testid="sealed-bid-notice"><Lock size={16} /> Sealed bids: each supplier thread is separate. Suppliers never see each other's quotes or your limits.</div>
          <div className="lanes">{d.threads.map((t) => <Lane key={t.id} t={t} req={req} onCounter={(sid, price) => call(`/buy/${rid}/counter`, { supplier_id: sid, price: Number(price) }, "Counter sent")} />)}</div>
        </section>
      )}

      {/* QUOTES */}
      {idx >= 2 && d.quotes.length > 0 && (
        <section className="card" data-testid="buy-quotes">
          <h2 className="h3">Quotes</h2>
          {d.compare && <p className="compare" data-testid="quote-compare">{d.compare}</p>}
          <div className="quotes">
            {d.quotes.map((q) => (
              <div key={q.id} className={`quote ${q.recommended ? "rec" : ""} ${req.selected === q.supplier_id ? "chosen" : ""}`} data-testid={`quote-${q.supplier_id}`}>
                <div className="quote-top"><b>{q.supplier_name}</b>{q.recommended && <Chip kind="chip-teal">Recommended</Chip>}{req.selected === q.supplier_id && <Chip kind="chip-green">Approved ✓</Chip>}</div>
                <div className="num big-amt">{money(q.total)}</div>
                <div className="row"><span>Terms</span><b>{q.terms}{q.terms.startsWith("net") ? ` · due ${fdate(q.due_date)}` : ` · ${fdate(q.due_date)}`}</b></div>
                <div className="row"><span>Delivery</span><b>{q.delivery}</b></div>
                <div className="row"><span>On-time record</span><b className="num">{q.on_time}% · {q.orders_on_record} orders</b></div>
                <div className="row"><span>Reliability adjustment</span><b className="num" data-testid={`reliability-${q.supplier_id}`}>{q.reliability_risk > 0 ? `+${money(q.reliability_risk)} → ${money(q.effective_total)}` : "none"}</b></div>
                <div className={`impact ${q.impact_bad ? "bad" : "good"}`} data-testid={`impact-${q.supplier_id}`}>Cash impact: {q.cash_impact}</div>
                {req.stage === "quotes" && (
                  <button className={`btn ${q.recommended ? "btn-primary" : "btn-ghost"}`} disabled={busy || !q.within_mandate} onClick={() => call(`/buy/${rid}/approve-quote`, { supplier_id: q.supplier_id }, `Approved ${q.supplier_name}`)} data-testid={`approve-quote-${q.supplier_id}`}>
                    {q.recommended ? "Approve this deal" : "Choose this instead"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {req.stage === "quotes" && <button className="btn btn-ghost danger" disabled={busy} onClick={() => call(`/buy/${rid}/approve-quote`, { supplier_id: "none" }, "All quotes denied")} data-testid="deny-all-btn">Deny all</button>}
          <p className="tiny muted">Nothing is committed until Maria approves.</p>
        </section>
      )}
      {req.stage === "denied" && (
        <section className="card" data-testid="buy-denied"><h2 className="h3">All quotes denied</h2><p className="muted">Nothing was committed. Use Reset in Demo controls to run sourcing again.</p></section>
      )}

      {/* PAY */}
      {req.stage === "pay" && po && (
        <section className="card" data-testid="buy-pay">
          <h2 className="h3"><CreditCard size={18} /> Pay {sel?.supplier_name}</h2>
          {po.early && (
            <div className="pay-box">
              <p><b>{sel.supplier_name}'s agent offers 2% off</b> if paid by {fdate(po.early.pay_by)}: {money(po.due.amount)} → <b className="num">{money(po.early.amount)}</b> (saves {money(po.early.saves)}).</p>
              <div className={`rulecheck ${po.early.allowed ? "ok" : "bad"}`} data-testid="pay-early-check">
                {po.early.allowed ? <Check size={16} /> : <X size={16} />} {po.early.message}
                <div className="tiny">Rule: Friday balance ({money(po.early.friday_now)}) minus the payment must stay at or above $0.</div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={!po.early.allowed || busy} onClick={() => call(`/buy/${rid}/pay-decision`, { choice: "early" })} data-testid="pay-early-btn">Pay early · {money(po.early.amount)}</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => call(`/buy/${rid}/pay-decision`, { choice: "due" })} data-testid="pay-due-btn">Pay on {fdate(po.due.date)} instead</button>
              </div>
            </div>
          )}
          {po.delivery && (
            <div className="pay-box">
              <p>No early-pay discount. {money(po.delivery.amount)} is due on delivery ({fdate(po.delivery.date)}).</p>
              <button className="btn btn-primary" disabled={busy} onClick={() => call(`/buy/${rid}/pay-decision`, { choice: "delivery" })} data-testid="pay-delivery-btn">Pay on delivery</button>
            </div>
          )}
        </section>
      )}

      {/* SPEND REQUEST */}
      {sr && ["spend", "delivery", "done"].includes(req.stage) && (
        <section className="card spend" data-testid="spend-request">
          <div className="spend-head"><span className="link-logo">Link</span><span>· Spend request</span><Chip kind="chip-amber">TEST MODE</Chip>
            <Chip kind={sr.status === "paid" ? "chip-green" : sr.status === "scheduled" ? "chip-teal" : "chip-line"} testid="spend-status">{sr.status}</Chip></div>
          <div className="num big-num">{money(sr.amount)}</div>
          <div className="row"><span>Requested by</span><b>{sr.requested_by}</b></div>
          <div className="row"><span>Merchant</span><b>{sr.merchant}</b></div>
          <div className="row"><span>Credential</span><b>{sr.credential}</b></div>
          <div className="row"><span>Limit</span><b>{sr.limit}</b></div>
          <div className="row"><span>When</span><b>{sr.when === "now" ? "Now" : fdate(sr.when)}</b></div>
          <table className="tbl"><tbody>{sr.line_items.map((l, i) => <tr key={i}><td>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</td><td className="r num">{money(l.total)}</td></tr>)}</tbody></table>
          <p className="tiny muted">{sr.note}{sr.ref ? ` Stripe test ref ${sr.ref}.` : ""}{sr.mode === "demo" ? " Paid in demo mode." : ""}</p>
          {req.stage === "spend" && (
            <div className="btn-row">
              <button className="btn btn-primary" disabled={busy} onClick={() => call(`/buy/${rid}/spend-request/approve`, { approve: true }, sr.when === "now" ? "Paid with a one-time card (test)" : "Payment scheduled")} data-testid="approve-link-btn">Approve in Link</button>
              <button className="btn btn-ghost danger" disabled={busy} onClick={() => call(`/buy/${rid}/spend-request/approve`, { approve: false }, "Spend request declined")} data-testid="decline-link-btn">Decline</button>
            </div>
          )}
        </section>
      )}

      <Scorecard />

      {/* DELIVERY */}
      {ship && (
        <section className="card" data-testid="buy-delivery">
          <h2 className="h3"><Truck size={18} /> Delivery · {ship.supplier_name}</h2>
          {ship.alert && !ship.alert.resolved && (
            <div className="alert-card" data-testid="delay-alert">
              <div><AlertTriangle size={18} /> <b>{ship.alert.text}</b></div>
              <div className="small">{ship.alert.detail}</div>
              <div className="btn-row">
                <button className="btn btn-primary btn-sm" onClick={() => call(`/buy/${rid}/shipment/backup`, { choice: "hold" }, "Asked Bayside to hold backup stock")} data-testid="hold-backup-btn">Ask Bayside to hold backup stock</button>
                <button className="btn btn-ghost btn-sm" onClick={() => call(`/buy/${rid}/shipment/backup`, { choice: "wait" })} data-testid="keep-waiting-btn">Keep waiting</button>
              </div>
            </div>
          )}
          {ship.alert && ship.alert.resolved && <div className="notice" data-testid="alert-resolved">{ship.alert.resolution}</div>}
          <div className="delivery-grid">
            <DeliveryMap route={d.route} step={ship.step} />
            <div>
              <div className="side-panel">
                <div className="row"><span>ETA</span><b className={`num ${ship.delayed ? "t-red" : ""}`} data-testid="ship-eta"><Clock size={14} /> {ship.eta}</b></div>
                <div className="row"><span>Deadline</span><b>{ship.deadline}</b></div>
                <div className="row"><span>Reference</span><b data-testid="ship-ref">{ship.ref}</b></div>
                <div className="row"><span>Carrier</span><b>{ship.carrier}</b></div>
                <div className="small muted">Asked of supplier: {ship.asked}</div>
              </div>
              <ol className="ship-tl" data-testid="ship-timeline">
                {d.steps.map((s, i) => <li key={s} className={i <= ship.step ? "done" : ""}><span className="step-dot">{i <= ship.step ? <Check size={12} /> : ""}</span>{s}</li>)}
              </ol>
              {ship.step < 4 && (
                <div className="btn-row">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(`/buy/${rid}/shipment/advance`)} data-testid="next-update-btn">Next update</button>
                  {!ship.delayed && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => call(`/buy/${rid}/shipment/delay`)} data-testid="simulate-delay-btn">Simulate delay</button>}
                </div>
              )}
              {ship.step === 4 && !ship.matched && <button className="btn btn-primary" disabled={busy} onClick={() => call(`/buy/${rid}/receipt/match`)} data-testid="confirm-arrived-btn"><PackageCheck size={18} /> Confirm what arrived</button>}
              {ship.credit && (
                <div className="receipt ok credit" data-testid="late-credit">
                  <b>Late-delivery credit {money(ship.credit.granted)}</b>
                  <div className="small">Asked {money(ship.credit.asked)} ({ship.credit.ask_pct}%, your limit). {ship.supplier_name} granted {ship.credit.granted_pct}%, {ship.credit.applied}.</div>
                </div>
              )}
              {ship.matched && (
                <div className={`receipt ${ship.matched.ok ? "ok" : "bad"}`} data-testid="receipt-matched">
                  <b>{ship.matched.ok ? "Receipt matched ✓" : "Receipt mismatch"}</b>
                  <div className="small">Quantities match the approved quote. Invoice {money(ship.matched.invoice_amount)} = approved {money(ship.matched.approved_amount)}.</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
