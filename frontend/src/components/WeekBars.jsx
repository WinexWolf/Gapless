import React from "react";
import { money } from "@/lib/api";

export default function WeekBars({ weeks }) {
  const vals = weeks.map((w) => w.balance);
  const posMax = Math.max(0, ...vals);
  const negMax = Math.max(0, ...vals.map((v) => -v));
  const total = posMax + negMax || 1;
  const H = 170;
  const zero = (posMax / total) * H;
  return (
    <div className="weekbars" data-testid="week-bars">
      <div className="wb-area" style={{ height: H + 40 }}>
        <div className="wb-zero" style={{ top: zero + 20 }} />
        {weeks.map((w, i) => {
          const h = Math.max(4, (Math.abs(w.balance) / total) * H);
          const neg = w.balance < 0;
          return (
            <div className="wb-col" key={w.end_date} data-testid={`week-bar-${i + 1}`}>
              <div className={`wb-bar ${neg ? "neg" : "pos"}`} style={{ height: h, top: neg ? zero + 20 : zero + 20 - h }} />
              <div className={`wb-val num ${neg ? "t-red" : "t-green"}`} style={{ top: neg ? zero + 24 + h : zero - h }}>
                {money(w.balance)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="wb-labels">
        {weeks.map((w) => (
          <div key={w.end_date}><b>{w.label}</b><span>{w.sub}</span></div>
        ))}
      </div>
    </div>
  );
}
