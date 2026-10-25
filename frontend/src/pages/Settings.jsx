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
  const NEGO_PRESETS = { gentle: { nego_open_pct: 5, nego_max_rounds: 2 }, balanced: { nego_open_pct: 10, nego_max_rounds: 3 }, aggressive: { nego_open_pct: 18, nego_max_rounds: 5 } };
  const setPreset = (v) => setS({ ...s, nego_style: v, ...NEGO_PRESETS[v] });
  const setNego = (k, val) => setS({ ...s, nego_style: "custom", [k]: val });
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
        <h2 className="h3">Mode</h2>
        <p className="tiny muted">Demo plays the guided walkthrough with customers and suppliers replying for you. Real mode uses your own data and waits for real replies — nothing is auto-generated.</p>
        <div className="set-row"><b>App mode</b><Seg k="mode" opts={[["demo", "Demo"], ["real", "Real"]]} /></div>
      </section>
      <section className="card">
        <h2 className="h3">Guardrails</h2>
        <p className="tiny muted">Enforced in code. Any counter above these is declined automatically and the thread shows why.</p>
        <div className="set-row"><label htmlFor="maxep"><b>Max early-pay discount</b></label><div className="suffix"><input id="maxep" className="input num" type="number" step="0.25" min="0" max="10" value={s.max_early_pay_pct} onChange={(e) => setS({ ...s, max_early_pay_pct: e.target.value })} data-testid="setting-max-early" /><span>%</span></div></div>
        <div className="set-row"><label htmlFor="maxfee"><b>Max extension fee</b></label><div className="suffix"><input id="maxfee" className="input num" type="number" step="0.25" min="0" max="10" value={s.max_ext_fee_pct} onChange={(e) => setS({ ...s, max_ext_fee_pct: e.target.value })} data-testid="setting-max-fee" /><span>%</span></div></div>
        <div className="set-row"><div><b>When a reply comes in</b><div className="tiny muted">Within the limits above, agents can act on their own or hold everything for you.</div></div>
          <div className="seg" role="group" aria-label="Agent autonomy">
            <button className={!s.require_approval ? "on" : ""} onClick={() => setS({ ...s, require_approval: false })} data-testid="setting-autonomy-auto">Act within guardrails</button>
            <button className={s.require_approval ? "on" : ""} onClick={() => setS({ ...s, require_approval: true })} data-testid="setting-autonomy-approve">Draft &amp; wait for me</button>
          </div>
        </div>
      </section>
      <section className="card">
        <h2 className="h3">Negotiation</h2>
        <p className="tiny muted">How hard the buying agent bargains with suppliers, and when it walks away — always within your budget cap, enforced in code.</p>
        <div className="set-row"><div><b>Bargaining style</b><div className="tiny muted">Gentle opens close to the cap and concedes fast; aggressive opens lower and holds out longer.</div></div>
          <div className="seg" role="group" aria-label="Bargaining style">
            {[["gentle", "Gentle"], ["balanced", "Balanced"], ["aggressive", "Aggressive"]].map(([v, l]) => (
              <button key={v} className={s.nego_style === v ? "on" : ""} onClick={() => setPreset(v)} data-testid={`setting-nego-${v}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="set-row"><label htmlFor="negoopen"><b>Open this far under the cap</b><div className="tiny muted">The agent's first offer, as a share of your budget cap.</div></label><div className="suffix"><input id="negoopen" className="input num" type="number" step="1" min="0" max="40" value={s.nego_open_pct} onChange={(e) => setNego("nego_open_pct", e.target.value)} data-testid="setting-nego-open" /><span>%</span></div></div>
        <div className="set-row"><label htmlFor="negorounds"><b>Rounds before walking away</b><div className="tiny muted">How many counters before the agent passes on an over-budget supplier.</div></label><div className="suffix"><input id="negorounds" className="input num" type="number" step="1" min="1" max="8" value={s.nego_max_rounds} onChange={(e) => setNego("nego_max_rounds", e.target.value)} data-testid="setting-nego-rounds" /></div></div>
        {s.nego_style === "custom" && <p className="tiny muted" data-testid="nego-custom-note">Using your custom numbers.</p>}
        <Sw k="supplier_ai_live" label="Live supplier AI" desc="Suppliers with an AI agent (e.g. Pacific Lumber) negotiate back with a real AI, bounded by your budget. Off replays the scripted demo instead." />
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
