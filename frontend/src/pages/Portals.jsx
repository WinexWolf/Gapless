import React, { useCallback, useEffect, useState } from "react";
import { UserButton } from "@clerk/react";
import { toast } from "sonner";
import { Inbox, FileText, Truck, Package, Check, X, MessageSquareReply, Send } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, money, fdate, errMsg } from "@/lib/api";

const PortalTop = ({ label }) => (
  <header className="portal-top">
    <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless</div>
    <div className="g-top-right">
      <span className="biz-pill" data-testid="portal-role-pill">{label}</span>
      <UserButton afterSignOutUrl="/" />
    </div>
  </header>
);

function OfferCard({ o, onDone }) {
  const [countering, setCountering] = useState(false);
  const [pct, setPct] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const open = o.status === "open";
  const act = async (path, body) => {
    setBusy(true);
    try { await http.post(`/offers/${o.token}/${path}`, body || {}); toast.success("Sent to Bay Remodel"); onDone && onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const s = o.offer || {};
  return (
    <div className="portal-offer" data-testid={`client-offer-${o.token}`}>
      <div className="portal-offer-head">
        <div><b>{s.type_label}</b><div className="tiny muted">Invoice {o.invoice?.number} · {money(o.invoice?.amount)}</div></div>
        <span className={`chip ${open ? "chip-teal" : "chip-line"}`}>{o.status}</span>
      </div>
      <div className="tiny muted portal-offer-terms">
        {s.type === "early_pay" && `Pay early for ${s.discount_pct}% off · you'd pay ${money(s.amount_due)}`}
        {s.type === "collect" && `Please confirm payment of ${money(s.amount_due)}`}
        {s.type === "split" && `Split: ${money(s.first)} now, ${money(s.second)} by ${fdate(s.second_date)}`}
        {s.type === "extension" && `Fee ${s.fee_pct}% (${money(s.fee)}) for new due date ${fdate(s.new_due)}`}
      </div>
      {open && !countering && (
        <div className="portal-actions">
          <MotionButton className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("accept")} data-testid={`offer-accept-${o.token}`}><Check size={15} /> Accept</MotionButton>
          <MotionButton className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setCountering(true)} data-testid={`offer-counter-${o.token}`}><MessageSquareReply size={15} /> Counter</MotionButton>
          <MotionButton className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("decline")} data-testid={`offer-decline-${o.token}`}><X size={15} /> Decline</MotionButton>
        </div>
      )}
      {open && countering && (
        <div className="portal-counter">
          {(s.type === "early_pay" || s.type === "extension") && (
            <label className="field"><span>Counter %</span><input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g. 1.5" data-testid={`offer-pct-${o.token}`} /></label>
          )}
          <label className="field"><span>Or days</span><input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 7" data-testid={`offer-days-${o.token}`} /></label>
          <div className="portal-actions">
            <MotionButton className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("counter", { percent: pct || null, days: days || null })} data-testid={`offer-counter-send-${o.token}`}><Send size={14} /> Send counter</MotionButton>
            <MotionButton className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setCountering(false)}>Cancel</MotionButton>
          </div>
        </div>
      )}
      {(o.history || []).slice(-3).map((h, k) => (
        <div className="portal-msg" key={k}><span className="tiny muted">{h.actor}</span><div>{h.text}</div></div>
      ))}
    </div>
  );
}

export function ClientPortal({ me }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { http.get("/portal/client/summary").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(() => { load(); }, [load]);
  const open = (d?.invoices || []).filter((i) => i.status !== "paid");
  return (
    <div className="portal-shell" data-testid="client-portal">
      <PortalTop label={`Client · ${me?.linked_name || ""}`} />
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">{me?.linked_name}</div>
          <h1 className="h1">Your account with Bay Remodel Co.</h1>
          <p className="muted">Respond to requests and see your invoices here.</p>
        </div></div>
        {err && <div className="card"><p className="muted">{err}</p></div>}

        <section className="card">
          <h2 className="h3"><Inbox size={16} /> Requests waiting for you</h2>
          {!d && <p className="muted">Loading…</p>}
          {d && (d.offers || []).length === 0 && <p className="muted" data-testid="client-no-offers">Nothing needs your response right now.</p>}
          {(d?.offers || []).map((o) => <OfferCard key={o.token} o={o} onDone={load} />)}
        </section>

        <section className="card">
          <h2 className="h3"><FileText size={16} /> Your invoices</h2>
          {d && open.length === 0 && <p className="muted" data-testid="client-no-invoices">No open invoices right now.</p>}
          <div className="portal-list">
            {open.map((i) => (
              <div className="portal-row" key={i.id} data-testid={`client-invoice-${i.id}`}>
                <div><b>{i.number}</b><div className="tiny muted">Due {fdate(i.due_date)} · {i.status}</div></div>
                <div className="portal-amt">{money(i.amount - (i.paid_amount || 0))}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function SupplierPortal({ me }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [price, setPrice] = useState("");
  const [terms, setTerms] = useState("net+10");
  const [delivery, setDelivery] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { http.get("/portal/supplier/summary").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(() => { load(); }, [load]);
  const req = d?.request;
  const cap = req?.mandate?.max_total;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await http.post("/portal/supplier/quote", { price, terms, delivery_date: delivery, note });
      toast.success(r.data?.reaction?.message || "Quote sent");
      setPrice(""); setNote(""); load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="portal-shell" data-testid="supplier-portal">
      <PortalTop label={`Supplier · ${me?.linked_name || ""}`} />
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">{me?.linked_name}</div>
          <h1 className="h1">Your orders with Bay Remodel Co.</h1>
          <p className="muted">Submit quotes and track delivery here.</p>
        </div></div>
        {err && <div className="card"><p className="muted">{err}</p></div>}

        <section className="card">
          <h2 className="h3"><Package size={16} /> Current request</h2>
          {!d && <p className="muted">Loading…</p>}
          {d && !req && <p className="muted" data-testid="supplier-no-request">No active materials request right now.</p>}
          {req && (
            <>
              <div className="portal-list">
                {(req.items || []).map((it, k) => (
                  <div className="portal-row" key={k} data-testid={`supplier-item-${k}`}><div><b>{it.name}</b></div><div className="tiny muted">{it.qty} {it.unit}</div></div>
                ))}
              </div>
              <p className="tiny muted" data-testid="supplier-budget" style={{ marginTop: 10 }}>
                Deliver to {req.mandate?.site} by {req.mandate?.latest_delivery}{cap ? ` · budget cap ${money(cap)}` : ""}
              </p>
              <div className="portal-quote-form">
                <label className="field"><span>Your price (total)</span><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 3400" data-testid="supplier-price" /></label>
                <label className="field"><span>Terms</span><input value={terms} onChange={(e) => setTerms(e.target.value)} data-testid="supplier-terms" /></label>
                <label className="field"><span>Delivery date</span><input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder={req.mandate?.latest_delivery} data-testid="supplier-delivery" /></label>
                <label className="field"><span>Note (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} data-testid="supplier-note" /></label>
                <MotionButton className="btn btn-primary" disabled={busy || !price} onClick={submit} data-testid="supplier-submit-quote"><Send size={16} /> Submit quote</MotionButton>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2 className="h3"><Truck size={16} /> Conversation</h2>
          {d && (d.rfqs || []).length === 0 && <p className="muted" data-testid="supplier-no-rfqs">No conversation yet.</p>}
          {(d?.rfqs || []).map((r) => (
            <div className="portal-thread" key={r.id} data-testid={`supplier-rfq-${r.id}`}>
              <div className="tiny muted">Status: {r.status}</div>
              {(r.messages || []).slice(-4).map((m, k) => (
                <div className="portal-msg" key={k}><span className="tiny muted">{m.actor}</span><div>{m.text}</div></div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
