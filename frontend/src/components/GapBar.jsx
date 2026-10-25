import React from "react";
import { CheckCircle2 } from "lucide-react";
import { money } from "@/lib/api";

const N = 14;

export default function GapBar({ gap, secured, pending, covered, compact = false, language = "en" }) {
  const es = language === "es";
  const u = gap > 0 ? gap / N : 1;
  const planks = Array.from({ length: N }, (_, i) => {
    const lo = i * u;
    const sec = covered ? 1 : Math.max(0, Math.min(1, (secured - lo) / u));
    const tot = covered ? 1 : Math.max(0, Math.min(1, (secured + pending - lo) / u));
    return { sec, pen: Math.max(0, tot - sec) };
  });
  const remaining = Math.max(0, gap - secured);
  return (
    <div className={`gapbar ${covered ? "is-covered" : ""} ${compact ? "compact" : ""}`} data-testid="gap-bar">
      <div className="planks" role="img" aria-label={es ? `Asegurado ${money(secured)} de ${money(gap)}; pendiente ${money(pending)}` : `Secured ${money(secured)} of ${money(gap)}; pending ${money(pending)}`}>
        {planks.map((p, i) => (
          <div className="plank" key={i}>
            <div className="plank-sec" style={{ width: `${p.sec * 100}%` }} />
            <div className="plank-pen" style={{ left: `${p.sec * 100}%`, width: `${p.pen * 100}%` }} />
          </div>
        ))}
        {covered && (
          <div className="covered-badge" data-testid="covered-badge">
            <span className="covered-badge-pill"><CheckCircle2 size={18} aria-hidden="true" /> {es ? "Cubierta" : "Covered"}</span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="gap-legend">
          <div><span className="dot dot-sec" />{es ? "Asegurado" : "Secured"} <b className="num" data-testid="secured-amount">{money(secured)}</b></div>
          <div><span className="dot dot-pen" />{es ? "Pendiente" : "Pending"} <b className="num" data-testid="pending-amount">{money(pending)}</b></div>
          <div><span className="dot dot-rem" />{es ? "Falta" : "Gap left"} <b className="num" data-testid="remaining-amount">{money(remaining)}</b></div>
        </div>
      )}
    </div>
  );
}
