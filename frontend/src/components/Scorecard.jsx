import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Check, Clock } from "lucide-react";
import { http, money, fdate, errMsg, useApp } from "@/lib/api";

export default function Scorecard() {
  const { tick } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { http.get("/suppliers/scorecard").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!d) return null;
  return (
    <section className="card" data-testid="supplier-scorecard">
      <h2 className="h3"><BarChart3 size={18} /> Supplier scorecard</h2>
      <p className="tiny muted">{d.rule}</p>
      <div className="score-grid">
        {d.cards.map((c) => (
          <div className="score" key={c.supplier_id} data-testid={`score-${c.supplier_id}`}>
            <b className="score-name">{c.name}</b>
            <div className="score-stats">
              <div><span>On time</span><b className={`num ${c.on_time_pct >= 95 ? "t-green" : c.on_time_pct < 90 ? "t-red" : ""}`} data-testid={`score-ontime-${c.supplier_id}`}>{c.on_time_pct}%</b><i className="tiny">{c.on_time_count}/{c.orders} orders</i></div>
              <div><span>Replies</span><b className="num">{c.reply_rate}%</b><i className="tiny">{c.replies}/{c.rfqs} requests</i></div>
              <div><span>Negotiated</span><b className="num">-{c.avg_negotiated_pct}%</b><i className="tiny">avg off first quote</i></div>
            </div>
            <ul className="score-recent">
              {c.recent.map((o, i) => (
                <li key={i}>
                  <span className="tiny muted">{fdate(o.date)}</span>
                  <span className="num">{money(o.final)}{o.quoted > o.final && <i className="tiny muted"> (from {money(o.quoted)})</i>}</span>
                  {o.on_time ? <span className="t-green tiny"><Check size={12} /> on time</span> : <span className="t-red tiny"><Clock size={12} /> +{o.minutes_late}m</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
