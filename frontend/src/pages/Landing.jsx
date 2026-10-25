import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Bot, Truck, CheckCircle2, Scale, Eye, Lock, Star, Pause, Play } from "lucide-react";
import GapBar from "@/components/GapBar";
import ThemeToggle from "@/components/ThemeToggle";
import { MotionButton } from "@/components/MotionButton";
import { useBilling } from "@/lib/billing";
import { LANDING_COPY } from "@/lib/landingCopy";

const FRAMES = [{ secured: 0, pending: 0, covered: false }, { secured: 0, pending: 11428, covered: false }, { secured: 3600, pending: 7828, covered: false }, { secured: 8328, pending: 3100, covered: false }, { secured: 11428, pending: 0, covered: true }];
const TRUST_ICONS = [Lock, ShieldCheck, Bot, Eye];
const initialLanguage = () => { try { const l = localStorage.getItem("gapless-lang"); if (l === "en" || l === "es") return l; } catch (_) {} return navigator.language.startsWith("es") ? "es" : "en"; };

const HeroDemo = ({ copy, language }) => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI(x => (x+1) % FRAMES.length), 3600);
    return () => clearInterval(id);
  }, [paused]);
  const f = FRAMES[i];
  return <div className="lp-demo card" aria-label={copy.demoLabel} data-testid="landing-hero-demo">
    <div className="eyebrow" data-testid="landing-demo-heading">{copy.demoHeading}</div>
    <div className={`lp-demo-title ${f.covered ? "t-green" : "t-red"}`} data-testid="landing-demo-label">{copy.frames[i][0]}</div>
    <div className="tiny muted" data-testid="landing-demo-note">{copy.frames[i][1]}</div>
    <div className="lp-demo-bar"><GapBar gap={9800} {...f} language={language} /></div>
    <div className="lp-demo-controls"><div className="lp-dots" aria-hidden="true">{FRAMES.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div><MotionButton className="icon-btn" onClick={() => setPaused(!paused)} aria-label={paused ? copy.play : copy.pause} data-testid="landing-example-pause">{paused ? <Play size={15} /> : <Pause size={15} />}</MotionButton></div>
  </div>;
};

export default function Landing() {
  const [language, setLanguage] = useState(initialLanguage);
  const { openPaywall, status } = useBilling();
  const c = LANDING_COPY[language];
  useEffect(() => {
    try { localStorage.setItem("gapless-lang", language); } catch (_) {}
    document.documentElement.lang = language;
    document.title = language === "es" ? "Gapless · Cubre la nómina antes del viernes" : "Gapless · Close the payroll gap";
    return () => { document.documentElement.lang = "en"; document.title = "Gapless · Bay Remodel Co."; };
  }, [language]);
  return <div className="lp" lang={language} data-testid="landing-page">
    <header className="lp-top"><div className="lp-in lp-top-in">
      <Link to="/" className="brand" data-testid="landing-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless</Link>
      <div className="g-top-right lp-header-actions">
        <div className="seg language-toggle" role="group" aria-label={language === "es" ? "Idioma" : "Language"} data-testid="landing-language-toggle">
          <MotionButton className={language === "en" ? "on" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"} aria-label="English" data-testid="landing-language-en">EN</MotionButton>
          <MotionButton className={language === "es" ? "on" : ""} onClick={() => setLanguage("es")} aria-pressed={language === "es"} aria-label="Español" data-testid="landing-language-es">ES</MotionButton>
        </div>
        <ThemeToggle compact language={language} />
        <MotionButton asChild className="btn btn-primary btn-sm lp-top-cta" data-testid="landing-top-cta"><Link to="/sign-in">{c.open}</Link></MotionButton>
      </div>
    </div></header>
    <div className="lp-hero-wrap"><section className="lp-in lp-hero">
      <div><div className="lp-badge" data-testid="landing-badge"><span className="pulse" aria-hidden="true" />{c.badge}</div>
        <h1 className="lp-h1" data-testid="landing-title">{c.title} <em>{c.accent}</em></h1>
        <p className="lp-lead" data-testid="landing-lead">{c.lead}</p>
        <div className="btn-row"><MotionButton asChild className="btn btn-primary btn-lg" data-testid="landing-hero-cta"><Link to="/sign-in">{c.cta}<ArrowRight size={18} /></Link></MotionButton><MotionButton asChild className="btn btn-ghost btn-lg" data-testid="landing-how-link"><a href="#how">{c.howLink}</a></MotionButton></div>
        <p className="tiny muted lp-safety" data-testid="landing-safety"><ShieldCheck size={14} />{c.safety}</p>
      </div><HeroDemo copy={c} language={language} />
    </section></div>
    <section className="lp-in lp-section"><div className="lp-stats">{["$9,800", "4", "$102.75", "0"].map((n,i) => <div key={n} data-testid={`landing-stat-${i}`}><b className="num">{n}</b><span>{c.stats[i]}</span></div>)}</div><p className="tiny muted lp-safety" data-testid="landing-example-disclaimer">{c.example}</p></section>
    <section className="lp-in lp-section" id="how"><div className="lp-section-head"><h2 className="lp-h2" data-testid="landing-how-title">{c.how}</h2><p>{c.howLead}</p></div><div className="lp-steps">{c.steps.map(([h,p],i)=><div className="card lp-step" key={i} data-testid={`landing-step-${i}`}><span className="lp-num">{i+1}</span><h3 className="h3">{h}</h3><p className="muted small">{p}</p></div>)}</div></section>
    <section className="lp-in lp-section"><div className="lp-section-head"><h2 className="lp-h2" data-testid="landing-agents-title">{c.agents}</h2><p>{c.agentsLead}</p></div><div className="lp-features">{[[c.payroll,c.payrollFeatures,Scale],[c.buying,c.buyingFeatures,Truck]].map(([title,items,Icon],i)=><div className="card lp-feat" key={i} data-testid={`landing-feature-${i}`}><div className="lp-ico"><Icon size={22} /></div><h3 className="h3">{title}</h3><ul>{items.map(s=><li key={s}>{s}</li>)}</ul></div>)}</div></section>
    <section className="lp-trust"><div className="lp-in"><div className="lp-section-head"><h2 className="lp-h2 light" data-testid="landing-rules-title">{c.rules}</h2></div><div className="lp-trust-grid">{c.trust.map(([h,p],i)=>{const Icon=TRUST_ICONS[i];return <div key={i} data-testid={`landing-trust-${i}`}><Icon size={20}/><b>{h}</b><span>{p}</span></div>;})}</div></div></section>
    <section className="lp-in lp-quote-wrap" data-testid="landing-testimonial"><div className="lp-quote"><div className="lp-quote-avatar" aria-hidden="true">RM</div><div className="lp-quote-body"><p className="lp-quote-text" data-testid="landing-quote">“{c.quote}”</p><div className="lp-quote-attr"><span className="lp-quote-stars" aria-label={c.stars}>{[0,1,2,3,4].map(n=><Star key={n} size={14} fill="currentColor" strokeWidth={0}/>)}</span><b>Rosa Marquez</b> · {c.quoteAttr}</div><p className="tiny muted" data-testid="landing-fictional-note">{c.fictional}</p></div></div></section>
    <section className="lp-in lp-section" data-testid="landing-pricing"><div className="card lp-pricing"><div><div className="eyebrow">{c.pricingEyebrow}</div><h2 className="lp-h2">{c.pricingTitle}</h2><p className="muted">{c.pricingLead}</p><p className="tiny muted">{c.sample}</p></div><div className="lp-pricing-action"><div className="paywall-price" data-testid="landing-plan-price"><b>{status?.price_label || "$19 USD"}</b><span>{c.priceSuffix}</span></div><MotionButton className="btn btn-primary" onClick={() => openPaywall(language)} data-testid="landing-monthly-access">{status?.active ? c.manage : c.upgrade}<ArrowRight size={17}/></MotionButton></div></div></section>
    <section className="lp-in lp-cta"><div><h2 className="lp-h2" data-testid="landing-end-title">{c.endTitle}</h2><p className="muted">{c.endLead}</p><p className="tiny muted">{c.previewNote}</p></div><MotionButton asChild className="btn btn-primary btn-lg" data-testid="landing-bottom-cta"><Link to="/sign-in"><CheckCircle2 size={18}/>{c.cta}</Link></MotionButton></section>
    <footer className="footer" data-testid="footer">{c.footer}</footer>
  </div>;
}
