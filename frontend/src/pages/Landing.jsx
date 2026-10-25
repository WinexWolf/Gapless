import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Bot, Truck, CheckCircle2, Scale, Eye, Lock, Sparkles, Star } from "lucide-react";
import GapBar from "@/components/GapBar";
import ThemeToggle from "@/components/ThemeToggle";

const FRAMES = [
  { secured: 0, pending: 0, label: "Short $9,800 on Friday", note: "Payroll $18,500 · bank $12,000" },
  { secured: 0, pending: 11428, label: "4 asks sent, cheapest first", note: "You approved every message" },
  { secured: 3600, pending: 7828, label: "Lee Bathroom paid $3,600", note: "Reminder worked" },
  { secured: 8328, pending: 3100, label: "Patel Deck paid $4,728", note: "1.5% early-pay offer" },
  { secured: 11428, pending: 0, label: "Covered · $1,628 to spare", note: "Total cost: $72" },
];

function HeroDemo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setI(FRAMES.length - 1); return; }
    const id = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 2200);
    return () => clearInterval(id);
  }, []);
  const f = FRAMES[i];
  const covered = f.secured >= 9800;
  return (
    <div className="lp-demo card" aria-label="Animated example of the payroll gap being covered" data-testid="landing-hero-demo">
      <div className="eyebrow">Bay Remodel Co. · Friday payroll</div>
      <div className={`lp-demo-title ${covered ? "t-green" : "t-red"}`}>{f.label}</div>
      <div className="tiny muted">{f.note}</div>
      <div className="lp-demo-bar"><GapBar gap={9800} secured={f.secured} pending={f.pending} covered={covered} /></div>
      <div className="lp-dots" aria-hidden="true">{FRAMES.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp" data-testid="landing-page">
      <header className="lp-top">
        <div className="lp-in lp-top-in">
          <Link to="/" className="brand" data-testid="landing-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless</Link>
          <div className="g-top-right">
            <ThemeToggle compact />
            <Link to="/dashboard" className="btn btn-primary btn-sm" data-testid="landing-top-cta">Open the demo</Link>
          </div>
        </div>
      </header>

      <div className="lp-hero-wrap">
        <section className="lp-in lp-hero">
          <div>
            <div className="lp-badge" data-testid="landing-badge"><span className="pulse" aria-hidden="true" /> Live demo · synthetic data</div>
            <h1 className="lp-h1">Close the payroll gap <em>before Friday.</em></h1>
            <p className="lp-lead">Gapless shows exactly how short you'll be, finds the cheapest way to cover it, and asks customers and suppliers for you. It also buys materials without breaking cash flow. You approve every step.</p>
            <div className="btn-row">
              <Link to="/dashboard" className="btn btn-primary btn-lg" data-testid="landing-hero-cta">Open the live demo <ArrowRight size={18} /></Link>
              <a href="#how" className="btn btn-ghost btn-lg" data-testid="landing-how-link">See how it works</a>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}><Sparkles size={12} style={{ verticalAlign: -1 }} /> Nothing is actually sent or charged in the demo.</p>
          </div>
          <HeroDemo />
        </section>
      </div>

      <section className="lp-in lp-section">
        <div className="lp-stats">
          <div><b className="num">$9,800</b><span>gap spotted days before payday</span></div>
          <div><b className="num">4</b><span>replies to cover it</span></div>
          <div><b className="num">$102.75</b><span>total cost</span></div>
          <div><b className="num">0</b><span>messages sent without approval</span></div>
        </div>
      </section>

      <section className="lp-in lp-section" id="how">
        <div className="lp-section-head">
          <h2 className="lp-h2">How it works</h2>
          <p>Three plain steps. No surprises, no autopilot.</p>
        </div>
        <div className="lp-steps">
          {[
            ["1", "See the gap", "A 4-week forecast that only counts cash you can rely on. Overdue invoices aren't counted until someone commits to pay."],
            ["2", "Approve the cheapest plan", "Reminders, split payments, early-pay discounts and supplier extensions, ranked by cost per expected dollar."],
            ["3", "Watch it get covered", "Replies come in, payments land, and the gap bar fills plank by plank until it says Covered."],
          ].map(([n, h, p]) => (
            <div className="card lp-step" key={n}><span className="lp-num">{n}</span><h3 className="h3">{h}</h3><p className="muted small">{p}</p></div>
          ))}
        </div>
      </section>

      <section className="lp-in lp-section">
        <div className="lp-section-head">
          <h2 className="lp-h2">Two agents, one bank account</h2>
          <p>They talk to customers and suppliers for you — but only draft, never send without your OK.</p>
        </div>
        <div className="lp-features">
          <div className="card lp-feat">
            <div className="lp-ico"><Scale size={22} /></div>
            <h3 className="h3">Payroll gap</h3>
            <ul>
              <li>Friendly or firm drafts in English or Spanish</li>
              <li>A private offer page for each customer: accept, counter or pay by card</li>
              <li>Split payments with a gentle reminder before the second one</li>
              <li>A shareable payday summary when you're covered</li>
            </ul>
          </div>
          <div className="card lp-feat">
            <div className="lp-ico"><Truck size={22} /></div>
            <h3 className="h3">Buying agent</h3>
            <ul>
              <li>Email a materials list; the agent gets quotes from your usual suppliers</li>
              <li>Sealed bids: suppliers never see each other's prices or your limit</li>
              <li>Pays early only when Friday stays positive</li>
              <li>Live delivery map, delay alerts and automatic late-delivery credit</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-trust">
        <div className="lp-in">
          <div className="lp-section-head">
            <h2 className="lp-h2 light">Your money, your rules</h2>
          </div>
          <div className="lp-trust-grid">
            <div><Lock size={20} /><b>Hard limits in code</b><span>Max discount, max fee and max spend are checked by rules. A counter above them is declined automatically.</span></div>
            <div><ShieldCheck size={20} /><b>You approve everything</b><span>No message, deal or payment goes ahead without your OK.</span></div>
            <div><Bot size={20} /><b>AI only writes words</b><span>Every number, date and decision comes from plain rules, never the AI.</span></div>
            <div><Eye size={20} /><b>See every step</b><span>Threads, an outbox and an activity log show exactly what happened.</span></div>
          </div>
        </div>
      </section>

      <section className="lp-in lp-quote-wrap" data-testid="landing-testimonial">
        <div className="lp-quote">
          <div className="lp-quote-avatar" aria-hidden="true">RM</div>
          <div className="lp-quote-body">
            <p className="lp-quote-text">"Friday was always the day I called the bank in a panic. With Gapless I saw the gap on Tuesday, approved two reminders and an early-pay offer, and payroll went out without me losing sleep."</p>
            <div className="lp-quote-attr">
              <span className="lp-quote-stars" aria-label="5 out of 5 stars">
                <Star size={14} fill="currentColor" strokeWidth={0} />
                <Star size={14} fill="currentColor" strokeWidth={0} />
                <Star size={14} fill="currentColor" strokeWidth={0} />
                <Star size={14} fill="currentColor" strokeWidth={0} />
                <Star size={14} fill="currentColor" strokeWidth={0} />
              </span>
              <b>Rosa Marquez</b> · Owner, Marquez Finish Carpentry · 7 crew
            </div>
          </div>
        </div>
      </section>

      <section className="lp-in lp-cta">
        <div>
          <h2 className="lp-h2">Try the Bay Remodel Co. demo</h2>
          <p className="muted">One click per step: press Next in Demo controls and watch Friday get covered.</p>
        </div>
        <Link to="/dashboard" className="btn btn-primary btn-lg" data-testid="landing-bottom-cta"><CheckCircle2 size={18} /> Open the live demo</Link>
      </section>
      <footer className="footer" data-testid="footer">Demo: synthetic data</footer>
    </div>
  );
}
