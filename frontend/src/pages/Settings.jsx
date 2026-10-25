import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { http, errMsg, useApp } from "@/lib/api";
import { Loading } from "@/components/Common";

export default function Settings() {
  const { tick, bump } = useApp();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { http.get("/settings").then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!s) return <Loading />;
  const save = async () => {
    setBusy(true);
    try { const r = await http.put("/settings", s); setS(r.data); toast.success("Settings saved"); bump(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const Seg = ({ k, opts }) => (
    <div className="seg" role="group">
      {opts.map(([v, l]) => <button key={v} className={s[k] === v ? "on" : ""} onClick={() => setS({ ...s, [k]: v })} data-testid={`setting-${k}-${v}`}>{l}</button>)}
    </div>
  );
  const Sw = ({ k, label, desc }) => (
    <div className="set-row">
      <div><b>{label}</b><div className="tiny muted">{desc}</div></div>
      <button role="switch" aria-checked={!!s[k]} aria-label={label} className={`switch dark ${s[k] ? "on" : ""}`} onClick={() => setS({ ...s, [k]: !s[k] })} data-testid={`setting-${k}`}><span /></button>
    </div>
  );
  return (
    <div className="page narrow" data-testid="settings-page">
      <div className="page-head"><div><div className="eyebrow">Settings</div><h1 className="h1">Guardrails &amp; voice</h1></div></div>
      <section className="card">
        <h2 className="h3">Guardrails</h2>
        <p className="tiny muted">Enforced in code. Any counter above these is declined automatically and the thread shows why.</p>
        <div className="set-row"><label htmlFor="maxep"><b>Max early-pay discount</b></label><div className="suffix"><input id="maxep" className="input num" type="number" step="0.25" min="0" max="10" value={s.max_early_pay_pct} onChange={(e) => setS({ ...s, max_early_pay_pct: e.target.value })} data-testid="setting-max-early" /><span>%</span></div></div>
        <div className="set-row"><label htmlFor="maxfee"><b>Max extension fee</b></label><div className="suffix"><input id="maxfee" className="input num" type="number" step="0.25" min="0" max="10" value={s.max_ext_fee_pct} onChange={(e) => setS({ ...s, max_ext_fee_pct: e.target.value })} data-testid="setting-max-fee" /><span>%</span></div></div>
        <div className="set-row"><div><b>Always require my approval</b><div className="tiny muted">Nothing is sent, accepted or paid without Maria.</div></div><span className="chip chip-green"><Lock size={12} /> Always on</span></div>
      </section>
      <section className="card">
        <h2 className="h3">Late deliveries</h2>
        <div className="set-row"><label htmlFor="maxcredit"><b>Max credit to ask for</b><div className="tiny muted">Share of the order. The agent never asks for more.</div></label><div className="suffix"><input id="maxcredit" className="input num" type="number" step="0.5" min="0" max="5" value={s.max_late_credit_pct} onChange={(e) => setS({ ...s, max_late_credit_pct: e.target.value })} data-testid="setting-max-late-credit" /><span>%</span></div></div>
        <Sw k="auto_late_credit" label="Ask automatically after a late delivery" desc="Credits at or below the ask are accepted, since they only lower what you owe." />
      </section>
      <section className="card">
        <h2 className="h3">Messages</h2>
        <div className="set-row"><b>Tone</b><Seg k="tone" opts={[["friendly", "Friendly"], ["firm", "Firm"]]} /></div>
        <div className="set-row"><b>Language</b><Seg k="language" opts={[["en", "English"], ["es", "Español"]]} /></div>
      </section>
      <section className="card">
        <h2 className="h3">Demo</h2>
        <Sw k="supplier_has_ai" label="Supplier has an AI agent" desc="Pacific Lumber answers agent-to-agent. Off: a person answers on the offer page." />
        <Sw k="llm_force_fail" label="Simulate AI outage" desc="Every AI call falls back to templates, so you can see the app still works." />
      </section>
      <button className="btn btn-primary btn-lg" onClick={save} disabled={busy} data-testid="save-settings-btn">Save settings</button>
    </div>
  );
}
