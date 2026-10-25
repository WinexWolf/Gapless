import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { http, money, ftime, errMsg, useApp } from "@/lib/api";
import { Chip, Loading } from "@/components/Common";

export default function Activity() {
  const { tick } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { http.get("/activity").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!d) return <Loading />;
  return (
    <div className="page narrow" data-testid="activity-page">
      <div className="page-head"><div><div className="eyebrow">Activity log</div><h1 className="h1">Everything that happened</h1></div></div>
      <section className="card counter-card" data-testid="money-secured">
        <div className="eyebrow">Money secured for payroll</div>
        <div className="big-num num t-green" data-testid="money-secured-value">{money(d.money_secured)}</div>
        <div className="small muted">of a {money(d.status.gap)} gap{d.status.covered ? " · Covered ✓" : ""}</div>
      </section>
      <section className="card">
        <ul className="log">
          {d.items.map((x) => (
            <li key={x.id} data-testid="activity-item">
              <span className="tiny muted num">{ftime(x.ts)}</span>
              <Chip kind={x.kind === "secured" ? "chip-green" : x.kind === "guardrail" || x.kind === "alert" ? "chip-amber" : x.scope === "buy" ? "chip-deep" : "chip-line"}>{x.scope === "buy" ? "Buy" : x.kind}</Chip>
              <span className="small">{x.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
