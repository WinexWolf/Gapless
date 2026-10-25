import React, { useEffect, useState } from "react";
import { UserButton } from "@clerk/react";
import { Inbox, FileText, Truck, Package } from "lucide-react";
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

export function ClientPortal({ me }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { http.get("/portal/client/summary").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  const open = (d?.invoices || []).filter((i) => i.status !== "paid");
  return (
    <div className="portal-shell" data-testid="client-portal">
      <PortalTop label={`Client · ${me?.linked_name || ""}`} />
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">{me?.linked_name}</div>
          <h1 className="h1">Your account with Bay Remodel Co.</h1>
          <p className="muted">Invoices and messages from Bay Remodel's assistant appear here.</p>
        </div></div>

        {err && <div className="card"><p className="muted">{err}</p></div>}

        <section className="card">
          <h2 className="h3"><FileText size={16} /> Your invoices</h2>
          {!d && <p className="muted">Loading…</p>}
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

        <section className="card">
          <h2 className="h3"><Inbox size={16} /> Messages</h2>
          {d && (d.threads || []).length === 0 && <p className="muted" data-testid="client-no-messages">No messages yet. When Bay Remodel's assistant reaches out, it'll show up here.</p>}
          {(d?.threads || []).map((t) => (
            <div className="portal-thread" key={t.id} data-testid={`client-thread-${t.id}`}>
              <div className="tiny muted">{t.badge || "Conversation"}</div>
              {(t.messages || []).slice(-3).map((m, k) => (
                <div className="portal-msg" key={k}><span className="tiny muted">{m.who === "them" ? me?.linked_name : "Bay Remodel"}</span><div>{m.body}</div></div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function SupplierPortal({ me }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { http.get("/portal/supplier/summary").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  return (
    <div className="portal-shell" data-testid="supplier-portal">
      <PortalTop label={`Supplier · ${me?.linked_name || ""}`} />
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">{me?.linked_name}</div>
          <h1 className="h1">Your orders with Bay Remodel Co.</h1>
          <p className="muted">Quote requests and delivery updates from the buying assistant appear here.</p>
        </div></div>

        {err && <div className="card"><p className="muted">{err}</p></div>}

        <section className="card">
          <h2 className="h3"><Package size={16} /> Quote requests</h2>
          {!d && <p className="muted">Loading…</p>}
          {d && (d.rfqs || []).length === 0 && <p className="muted" data-testid="supplier-no-rfqs">No quote requests yet. New requests from the buying assistant will show here.</p>}
          {(d?.rfqs || []).map((r) => (
            <div className="portal-thread" key={r.id} data-testid={`supplier-rfq-${r.id}`}>
              <div className="tiny muted">Request {r.request_id} · {r.status}</div>
              {(r.messages || r.inbound || []).slice(-3).map((m, k) => (
                <div className="portal-msg" key={k}><div>{typeof m === "string" ? m : (m.body || m.text || "")}</div></div>
              ))}
            </div>
          ))}
        </section>

        <section className="card">
          <h2 className="h3"><Truck size={16} /> Your quotes</h2>
          {d && (d.quotes || []).length === 0 && <p className="muted" data-testid="supplier-no-quotes">No quotes submitted yet.</p>}
          <div className="portal-list">
            {(d?.quotes || []).map((q) => (
              <div className="portal-row" key={q.id} data-testid={`supplier-quote-${q.id}`}>
                <div><b>Quote</b><div className="tiny muted">Request {q.request_id}</div></div>
                <div className="portal-amt">{money(q.total || q.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
