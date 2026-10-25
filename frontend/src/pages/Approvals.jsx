import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Inbox, ShoppingCart, Wallet } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, money, errMsg } from "@/lib/api";

const KIND = {
  award_quote: { Icon: ShoppingCart, label: "Buying" },
  client_counter: { Icon: Wallet, label: "Payroll" },
};

export default function Approvals() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => { http.get("/approvals").then((r) => setData(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, decision) => {
    setBusy(id + decision);
    try {
      await http.post(`/approvals/${id}/resolve`, { decision, origin_url: window.location.origin });
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  const pending = data?.pending || [];
  return (
    <div className="page narrow" data-testid="approvals-page">
      <div className="page-head"><div>
        <div className="eyebrow">Needs you</div>
        <h1 className="h1">Approvals {pending.length > 0 && <span className="chip chip-amber" data-testid="approvals-count">{pending.length}</span>}</h1>
        <p className="muted">When your agents are set to "draft &amp; wait", everything that needs your yes/no lands here.</p>
      </div></div>
      {err && <div className="card"><p className="muted">{err}</p></div>}
      {data && pending.length === 0 && <div className="card"><p className="muted" data-testid="approvals-empty">You're all caught up — nothing waiting for approval.</p></div>}

      {pending.map((a) => {
        const meta = KIND[a.kind] || { Icon: Inbox, label: "" };
        const Icon = meta.Icon;
        return (
          <section className="card approval-item" key={a.id} data-testid={`approval-${a.id}`}>
            <div className="approval-head">
              <span className="wt-badge wt-badge-payroll"><Icon size={13} /> {meta.label}</span>
              {a.amount != null && <span className="portal-amt">{money(a.amount)}</span>}
            </div>
            <div className="approval-title">{a.title}</div>
            <p className="tiny muted">{a.detail}</p>
            <div className="portal-actions">
              <MotionButton className="btn btn-primary btn-sm" disabled={busy} onClick={() => resolve(a.id, "approve")} data-testid={`approval-approve-${a.id}`}><Check size={15} /> Approve</MotionButton>
              <MotionButton className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve(a.id, "reject")} data-testid={`approval-reject-${a.id}`}><X size={15} /> Reject</MotionButton>
            </div>
          </section>
        );
      })}

      {(data?.recent || []).length > 0 && (
        <section className="card">
          <h2 className="h3">Recently decided</h2>
          <div className="portal-list">
            {data.recent.map((a) => (
              <div className="portal-row" key={a.id} data-testid={`approval-recent-${a.id}`}>
                <div><b>{a.title}</b><div className="tiny muted">{a.status}</div></div>
                {a.amount != null && <div className="portal-amt">{money(a.amount)}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
