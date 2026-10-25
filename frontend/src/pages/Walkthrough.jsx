import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Play, Pause, SkipForward, RotateCcw, CheckCircle2, Wallet, Truck, Sparkles, ArrowRight, Download } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, API, errMsg, useApp } from "@/lib/api";
import { useMode } from "@/lib/mode";

const STAGES = ["request", "sourcing", "quotes", "pay", "spend", "delivery", "done"];

function progressFromStatus(st) {
  if (!st) return 0;
  const pr = st.payroll || {};
  const payrollFrac = pr.covered ? 1 : (pr.selected ? Math.min(pr.resolved / pr.selected, 1) : 0);
  const idx = Math.max(STAGES.indexOf(st.buy?.stage || "request"), 0);
  const buyFrac = idx / (STAGES.length - 1);
  return Math.round(payrollFrac * 45 + buyFrac * 55);
}

const AGENT_META = {
  "Payroll agent": { cls: "wt-badge-payroll", Icon: Wallet },
  "Buying agent": { cls: "wt-badge-buy", Icon: Truck },
  Done: { cls: "wt-badge-done", Icon: CheckCircle2 },
};

export default function Walkthrough() {
  const { bump } = useApp();
  const { isDemo, setMode, loaded } = useMode();
  const [feed, setFeed] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | payroll | buy | done
  const [status, setStatus] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const playingRef = useRef(false);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const feedRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await http.get("/demo/walkthrough/status");
      setStatus(r.data);
      return r.data;
    } catch (e) { return null; }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed]);

  useEffect(() => () => { playingRef.current = false; clearTimeout(timerRef.current); }, []);

  const doStep = useCallback(async () => {
    if (busyRef.current) return "busy";
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await http.post("/demo/walkthrough/next", { origin_url: window.location.origin });
      const s = r.data;
      setFeed((f) => [...f, { ...s, key: `${Date.now()}-${f.length}` }]);
      setPhase(s.phase);
      await loadStatus();
      bump();
      return s.done ? "done" : "ok";
    } catch (e) {
      toast.error(errMsg(e));
      return "err";
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [bump, loadStatus]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    clearTimeout(timerRef.current);
  }, []);

  const loop = useCallback(async () => {
    if (!playingRef.current) return;
    const res = await doStep();
    if (!playingRef.current) return;
    if (res === "done" || res === "err") { stop(); return; }
    timerRef.current = setTimeout(loop, 2300);
  }, [doStep, stop]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    loop();
  }, [loop]);

  const restart = useCallback(async () => {
    stop();
    setBusy(true);
    try {
      await http.post("/demo/reset");
      setFeed([]);
      setPhase("idle");
      await loadStatus();
      bump();
      toast.success("Reset to the beginning");
    } catch (e) {
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  }, [bump, loadStatus, stop]);

  const restartAndPlay = useCallback(async () => {
    await restart();
    setTimeout(play, 300);
  }, [restart, play]);

  const pct = phase === "done" ? 100 : progressFromStatus(status);
  const done = phase === "done";
  const started = feed.length > 0;
  const covered = status?.payroll?.covered;

  if (loaded && !isDemo) {
    return (
      <div className="page narrow" data-testid="walkthrough-page">
        <div className="page-head"><div><div className="eyebrow">Guided walkthrough</div><h1 className="h1">See it work, end to end</h1></div></div>
        <section className="card wt-realnote" data-testid="walkthrough-real-note">
          <div className="paywall-icon"><Sparkles size={26} /></div>
          <h2 className="h3">The guided walkthrough runs in Demo mode</h2>
          <p className="muted">In Real mode, customers and suppliers reply on their own time, so there is nothing to auto-play. Switch to Demo mode to watch both agents run from the first offer to a covered payroll and a delivered order.</p>
          <MotionButton className="btn btn-primary" onClick={() => setMode("demo")} data-testid="walkthrough-switch-demo"><Sparkles size={17} /> Switch to Demo mode</MotionButton>
        </section>
      </div>
    );
  }

  return (
    <div className="page" data-testid="walkthrough-page">
      <div className="wt-hero card" data-testid="walkthrough-hero">
        <div className="eyebrow"><Sparkles size={14} /> Guided walkthrough</div>
        <h1 className="h2" data-testid="walkthrough-heading">Watch both agents work, end to end.</h1>
        <p className="muted wt-sub">Press play. The payroll agent closes Friday's gap with your customers and suppliers, then the buying agent sources materials, pays safely, and tracks the delivery — all with your approvals.</p>

        <div className="wt-trail" aria-hidden="true">
          <div className={`wt-node ${phase === "payroll" ? "active" : ""} ${phase === "buy" || phase === "done" ? "did" : ""}`}><Wallet size={16} /><span>Payroll agent</span></div>
          <div className="wt-line"><i style={{ width: `${Math.min(pct * 2, 100)}%` }} /></div>
          <div className={`wt-node ${phase === "buy" ? "active" : ""} ${phase === "done" ? "did" : ""}`}><Truck size={16} /><span>Buying agent</span></div>
          <div className="wt-line"><i style={{ width: `${done ? 100 : 0}%` }} /></div>
          <div className={`wt-node ${phase === "done" ? "active did" : ""}`}><CheckCircle2 size={16} /><span>Done</span></div>
        </div>

        <div className="wt-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} data-testid="walkthrough-progress">
          <i style={{ width: `${pct}%` }} className={playing ? "live" : ""} />
        </div>

        <div className="wt-controls">
          {!done && (playing
            ? <MotionButton className="btn btn-ghost" onClick={stop} data-testid="walkthrough-pause"><Pause size={18} /> Pause</MotionButton>
            : <MotionButton className="btn btn-primary" onClick={started ? play : restartAndPlay} disabled={busy} data-testid="walkthrough-play"><Play size={18} /> {started ? "Resume" : "Play walkthrough"}</MotionButton>)}
          {!done && <MotionButton className="btn btn-ghost" onClick={doStep} disabled={busy || playing} data-testid="walkthrough-step"><SkipForward size={18} /> Step once</MotionButton>}
          <MotionButton className="btn btn-ghost" onClick={restart} disabled={busy} data-testid="walkthrough-restart"><RotateCcw size={16} /> Restart</MotionButton>
        </div>
      </div>

      {done && (
        <div className={`banner ${covered ? "banner-green" : "banner-amber"}`} data-testid="walkthrough-done-banner">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <div className="banner-title">{covered ? "Payroll covered and the order delivered." : "The order is done — review the plan."}</div>
            <div className="banner-sub">Open any screen to see the finished state the agents reached.</div>
          </div>
        </div>
      )}

      {done && (
        <div className="wt-cta-row" data-testid="walkthrough-cta-row">
          <MotionButton asChild className="btn btn-primary"><Link to="/dashboard" data-testid="walkthrough-go-dashboard">See the dashboard <ArrowRight size={17} /></Link></MotionButton>
          <MotionButton asChild className="btn btn-ghost"><Link to="/threads" data-testid="walkthrough-go-threads">Payroll threads</Link></MotionButton>
          <MotionButton asChild className="btn btn-ghost"><Link to="/buy" data-testid="walkthrough-go-buy">Buying order</Link></MotionButton>
          {covered && <a className="btn btn-ghost" href={`${API}/summary/image.png?theme=light`} target="_blank" rel="noreferrer" data-testid="walkthrough-share-image"><Download size={16} /> Payday image</a>}
        </div>
      )}

      <section className="card wt-feed-card">
        <h2 className="h3">What's happening</h2>
        {!started && <p className="muted" data-testid="walkthrough-empty">Press <b>Play walkthrough</b> to begin. Each step is a real action the agents take — nothing is skipped.</p>}
        <ol className="wt-feed" ref={feedRef} data-testid="walkthrough-feed">
          {feed.map((s, i) => {
            const meta = AGENT_META[s.agent] || AGENT_META["Payroll agent"];
            const Icon = meta.Icon;
            return (
              <li className="wt-item" key={s.key} data-testid={`walkthrough-item-${i}`}>
                <span className={`wt-badge ${meta.cls}`}><Icon size={13} /> {s.agent}</span>
                <div className="wt-item-body">
                  <div className="wt-item-title">{s.title}</div>
                  <div className="wt-item-text muted">{s.narration}</div>
                </div>
              </li>
            );
          })}
          {busy && playing && <li className="wt-item wt-item-live" data-testid="walkthrough-live"><span className="wt-dotpulse"><i /><i /><i /></span><span className="muted tiny">working…</span></li>}
        </ol>
      </section>
    </div>
  );
}
