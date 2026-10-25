import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, PartyPopper } from "lucide-react";
import { PaydayImage } from "@/components/PaydayImage";
import { MotionButton } from "@/components/MotionButton";
import { http, money, errMsg, useApp } from "@/lib/api";

export default function PaydayCard() {
  const { tick } = useApp();
  const [s, setS] = useState(null);
  useEffect(() => { http.get("/summary").then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!s || !s.covered) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(s.text); toast.success("Summary copied"); }
    catch (e) { toast.error("Couldn't copy. Select the text and copy it instead."); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Payroll covered", text: s.text }); } catch (e) { /* cancelled */ }
    } else copy();
  };

  return (
    <section className="card payday" data-testid="payday-card">
      <div className="payday-head">
        <div>
          <div className="eyebrow light"><PartyPopper size={14} /> Payday summary</div>
          <h2 className="h2">Payroll covered ✓</h2>
          <p className="payday-sub">{s.friday_label} payroll of {money(s.payroll)} is safe, with <b className="num">{money(s.spare)}</b> to spare.</p>
        </div>
        <div className="payday-cost">
          <span>Cost to close the gap</span>
          <b className="num" data-testid="payday-total-cost">{money(s.total_cost)}</b>
          <span className="tiny">{s.cost_pct}% of {money(s.gap)}</span>
        </div>
      </div>
      <ul className="payday-list">
        {s.items.map((i) => (
          <li key={i.counterparty}>
            <span><b>{i.counterparty}</b> <span className="tiny">· {i.type_label} · {i.note}</span></span>
            <span className="num">{money(i.amount)} <span className="tiny">cost {money(i.cost)}</span></span>
          </li>
        ))}
        <li className="tot"><span>Secured</span><span className="num">{money(s.secured)}</span></li>
      </ul>
      <div className="btn-row">
        <PaydayImage />
        <MotionButton className="btn btn-ghost-light" onClick={share} data-testid="payday-share-btn"><Share2 size={16} /> Share text</MotionButton>
        <MotionButton className="btn btn-ghost-light" onClick={copy} data-testid="payday-copy-btn"><Copy size={16} /> Copy summary</MotionButton>
      </div>
    </section>
  );
}
