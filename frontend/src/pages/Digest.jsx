import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, Copy } from "lucide-react";
import { http, money, fdate, errMsg, useApp } from "@/lib/api";
import { StatusChip, Loading } from "@/components/Common";

export default function Digest() {
  const { tick } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { http.get("/digest").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!d) return <Loading />;
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.text); toast.success("Digest copied"); } catch (e) { toast.error("Couldn't copy"); }
  };
  return (
    <div className="page narrow" data-testid="digest-page">
      <div className="page-head"><div><div className="eyebrow"><CalendarDays size={14} /> Monday digest</div><h1 className="h1">{d.week_label}</h1></div>
        <button className="btn btn-ghost" onClick={copy} data-testid="digest-copy-btn"><Copy size={16} /> Copy digest</button>
      </div>
      <div className={`banner ${d.status.covered ? "banner-green" : "banner-red"}`} data-testid="digest-headline"><div><div className="banner-title">{d.headline}</div>
        <div className="banner-sub">Friday projected {money(d.friday_balance)} · lowest point {money(d.lowest.balance)} on {fdate(d.lowest.date)}</div></div></div>
      <section className="card" data-testid="digest-gap">
        <h2 className="h3">The week's gap</h2>
        <div className="row"><span>Payroll gap</span><b className="num">{money(d.status.gap)}</b></div>
        <div className="row"><span>Secured</span><b className="num t-green">{money(d.status.secured)}</b></div>
        <div className="row"><span>Pending replies</span><b className="num">{money(d.status.pending)}</b></div>
        <div className="row"><span>Still to cover</span><b className={`num ${d.status.remaining > 0 ? "t-red" : "t-green"}`}>{money(d.status.remaining)}</b></div>
        <h3 className="h4">Cash moving this week</h3>
        <ul className="rows">{d.week_items.map((x, i) => <li className="row" key={i}><span>{x.label} <span className="tiny muted">· {fdate(x.date)}</span></span><b className={`num ${x.amount < 0 ? "t-red" : "t-green"}`}>{x.amount > 0 ? "+" : ""}{money(x.amount)}</b></li>)}</ul>
      </section>
      <section className="card" data-testid="digest-offers">
        <h2 className="h3">Open offers</h2>
        {d.open_offers.length === 0 && <p className="muted small">No offers waiting on a reply.</p>}
        {d.open_offers.map((o) => <div className="row" key={o.counterparty}><span>{o.counterparty} · {o.type_label}</span><b className="num">{money(o.amount)} <StatusChip status={o.status} /></b></div>)}
        {d.drafts.length > 0 && <p className="small">Waiting for your approval: <b>{d.drafts.join(", ")}</b>. <Link to="/plan">Review the plan</Link></p>}
        {d.reminders.length > 0 && <p className="small">Reminders: {d.reminders.map((r) => `${r.counterparty} on ${fdate(r.send_on)} (${r.status})`).join("; ")}</p>}
      </section>
      <section className="card" data-testid="digest-suppliers">
        <h2 className="h3">Upcoming supplier payments</h2>
        {d.supplier_payments.length === 0 && <p className="muted small">Nothing due in the next two weeks.</p>}
        {d.supplier_payments.map((p, i) => <div className="row" key={i}><span>{p.vendor} <span className="tiny muted">· {fdate(p.due_date)}</span></span><b className="num">{money(p.amount)}</b></div>)}
      </section>
    </div>
  );
}
