import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, ArrowRight, Compass, Sparkles } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { DashboardTour } from "@/components/DashboardTour";
import { http, money, fdate, errMsg, useApp } from "@/lib/api";
import GapBar from "@/components/GapBar";
import WeekBars from "@/components/WeekBars";
import { Loading } from "@/components/Common";
import PaydayCard from "@/components/PaydayCard";
import Confetti from "@/components/Confetti";

export default function Dashboard() {
  const { tick } = useApp();
  const [tourReplay, setTourReplay] = useState(0);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [d, setD] = useState(null);
  const [plan, setPlan] = useState(null);
  const [regen, setRegen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const prevCovered = useRef(null);

  useEffect(() => {
    setLoadError("");
    http.get("/forecast").then((r) => setD(r.data)).catch((e) => setLoadError(errMsg(e)));
    http.get("/plan").then((r) => setPlan(r.data)).catch(() => {});
  }, [tick, fetchAttempt]);

  useEffect(() => {
    if (!d) return;
    const nowCovered = !!d.status.covered;
    if (prevCovered.current === false && nowCovered) {
      setBurstKey((k) => k + 1);
    }
    prevCovered.current = nowCovered;
  }, [d]);

  if (loadError) return <div className="card" role="alert" data-testid="dashboard-load-error"><p>{loadError}</p><MotionButton className="btn btn-primary" onClick={() => setFetchAttempt(x=>x+1)} data-testid="dashboard-retry">Try again</MotionButton></div>;
  if (!d) return <Loading />;
  const { forecast: fc, status: st } = d;
  const upcoming = fc.items.filter((x) => x.date <= fc.friday);
  const payroll = d.payroll ?? 18500;
  const before = fc.friday_balance;
  const expected = plan?.expected_total ?? (st.gap - st.remaining);
  const afterPreview = st.covered ? fc.friday_balance : before + expected;
  const delta = afterPreview - before;

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
      <Confetti fireKey={burstKey} />
      <DashboardTour replay={tourReplay} />
      <div className="dashboard-intro">
        <div><div className="eyebrow" data-testid="dashboard-demo-label">BAY REMODEL CO.</div><h1 className="h2" data-testid="dashboard-heading">Your week, in focus.</h1></div>
        <div className="dashboard-intro-actions">
          <MotionButton className="icon-btn" onClick={() => setTourReplay(x=>x+1)} aria-label="Replay quick tour" data-testid="dashboard-replay-tour"><Compass size={19} /></MotionButton>
          <MotionButton asChild className="btn btn-primary btn-sm" data-testid="dashboard-walkthrough-cta"><Link to="/walkthrough"><Sparkles size={16} /> See it work</Link></MotionButton>
        </div>
      </div>
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
            <div className="banner-sub">Payroll is {money(payroll)}. Gap left after secured cash: {money(st.remaining)}.</div>
          </div>
        </div>
      )}

      <section className="card hero g-glass" data-testid="hero-card">
        <div className="hero-top">
          <div className="hero-kpi" data-testid="dashboard-payroll-hero">
            <div className="eyebrow">Protect Friday payroll · {fc.friday_label}</div>
            <div className="hero-transform big-num num" data-testid="hero-number">
              <span className={before < 0 ? "t-red" : "muted"} data-testid="dashboard-friday-before">{money(before)}</span>
              <span className="hero-arrow" aria-hidden="true">→</span>
              <span className={afterPreview >= 0 ? "t-green" : "t-red"} data-testid="dashboard-friday-after">{st.covered ? "Covered ✓" : money(afterPreview)}</span>
            </div>
            <div className="tiny muted hero-transform-sub">
              {st.covered
                ? `Payroll is ${money(payroll)} — covered with ${money(st.spare)} to spare.`
                : `Friday today vs. after the agent's plan lands. Payroll is ${money(payroll)}.`}
            </div>
            <div className="chips hero-safety">
              <span className="chip chip-deep kpi-after" data-testid="dashboard-payroll-safety-claim">Agent never breaks Friday payroll</span>
              {delta > 0.5 && <span className="chip chip-green" data-testid="dashboard-friday-delta">+{money(delta)} from the plan</span>}
              <span className="chip chip-line">Deterministic math</span>
            </div>
          </div>
          <div className="hero-ctas btn-row" style={{ marginTop: 0 }}>
            <Link to="/digest" className="btn btn-ghost" data-testid="open-digest-btn">Monday digest</Link>
            <MotionButton asChild className="btn btn-primary" data-testid="open-plan-btn"><Link to="/plan">Open the plan <ArrowRight size={18} /></Link></MotionButton>
          </div>
        </div>
        <GapBar gap={st.gap} secured={st.secured} pending={st.pending} covered={st.covered} />
        <div className="expl" data-testid="plan-explanation">
          <div className="tiny muted" style={{ marginBottom: 4 }}>Why this works (numbers from rules):</div>
          <p>{d.explanation}</p>
          <MotionButton className="btn btn-ghost btn-sm" onClick={regenerate} disabled={regen} data-testid="regen-explanation">
            <RefreshCw size={15} className={regen ? "spin" : ""} /> {regen ? "Writing…" : "Regenerate"}
          </MotionButton>
          <span className="tiny muted">{d.explanation_source === "ai" ? "Phrased by AI · numbers from rules" : "Standard explanation"}</span>
        </div>
      </section>

      {st.covered && <PaydayCard />}

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
