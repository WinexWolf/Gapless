import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, ArrowRight } from "lucide-react";
import { http, money, fdate, errMsg, useApp } from "@/lib/api";
import GapBar from "@/components/GapBar";
import WeekBars from "@/components/WeekBars";
import { Loading } from "@/components/Common";

export default function Dashboard() {
  const { tick } = useApp();
  const [d, setD] = useState(null);
  const [regen, setRegen] = useState(false);

  useEffect(() => {
    http.get("/forecast").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [tick]);

  if (!d) return <Loading />;
  const { forecast: fc, status: st } = d;
  const upcoming = fc.items.filter((x) => x.date <= fc.friday);

  const regenerate = async () => {
    setRegen(true);
    try {
      const r = await http.post("/plan/explain");
      setD({ ...d, explanation: r.data.explanation, explanation_source: r.data.source });
      if (r.data.source !== "ai") toast("AI unavailable, kept the standard explanation");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRegen(false);
    }
  };

  return (
    <div className="page" data-testid="dashboard-page">
      {st.covered ? (
        <div className="banner banner-green" data-testid="gap-banner">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <div className="banner-title">Payroll on {fc.friday_label} is covered ✓</div>
            <div className="banner-sub">{money(st.spare)} to spare. Friday's projected balance is {money(fc.friday_balance)}.</div>
          </div>
        </div>
      ) : (
        <div className="banner banner-red" data-testid="gap-banner">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <div className="banner-title">Short {money(st.gap)} on {fc.friday_label}</div>
            <div className="banner-sub">Payroll is $18,500. Gap left after secured cash: {money(st.remaining)}.</div>
          </div>
        </div>
      )}

      <section className="card hero" data-testid="hero-card">
        <div className="hero-top">
          <div>
            <div className="eyebrow">Payroll gap · {fc.friday_label}</div>
            <div className={`big-num num ${st.covered ? "t-green" : ""}`} data-testid="hero-number">
              {st.covered ? "Covered ✓" : `${money(st.remaining)} to go`}
            </div>
          </div>
          <Link to="/plan" className="btn btn-primary" data-testid="open-plan-btn">Open the plan <ArrowRight size={18} /></Link>
        </div>
        <GapBar gap={st.gap} secured={st.secured} pending={st.pending} covered={st.covered} />
        <div className="expl" data-testid="plan-explanation">
          <p>{d.explanation}</p>
          <button className="btn btn-ghost btn-sm" onClick={regenerate} disabled={regen} data-testid="regen-explanation">
            <RefreshCw size={15} className={regen ? "spin" : ""} /> {regen ? "Writing…" : "Regenerate"}
          </button>
          <span className="tiny muted">{d.explanation_source === "ai" ? "Phrased by AI · numbers from rules" : "Standard explanation"}</span>
        </div>
      </section>

      <div className="grid2">
        <section className="card" data-testid="cash-calendar">
          <h2 className="h3">4-week cash calendar</h2>
          <p className="muted small">End-of-week balance, committed cash only.</p>
          <WeekBars weeks={fc.weeks} />
        </section>
        <section className="card" data-testid="cash-items">
          <h2 className="h3">Through Friday</h2>
          <ul className="rows">
            <li className="row"><span>Bank balance today</span><b className="num">{money(d.business.bank_balance)}</b></li>
            {upcoming.map((x, i) => (
              <li className="row" key={i}>
                <span>{x.label}<span className="tiny muted"> · {fdate(x.date)}</span></span>
                <b className={`num ${x.amount < 0 ? "t-red" : "t-green"}`}>{x.amount > 0 ? "+" : ""}{money(x.amount)}</b>
              </li>
            ))}
            <li className="row total"><span>Friday balance</span><b className={`num ${fc.friday_balance < 0 ? "t-red" : "t-green"}`} data-testid="friday-balance">{money(fc.friday_balance)}</b></li>
          </ul>
          {fc.likely_arrivals.length > 0 && (
            <>
              <h3 className="h4">Overdue, not counted as cash</h3>
              <ul className="rows" data-testid="likely-arrivals">
                {fc.likely_arrivals.map((x) => (
                  <li className="row" key={x.number}>
                    <span>{x.customer} <span className="tiny muted">· {x.days_overdue} days late · likely {fdate(x.likely_date)}</span></span>
                    <b className="num muted">{money(x.amount)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
