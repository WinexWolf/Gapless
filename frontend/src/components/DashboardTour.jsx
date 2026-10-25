import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogSurface, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MotionButton, MOVE_SPRING } from "@/components/MotionButton";

const KEY = "gapless-tour-seen";
const STEPS = [
  { selector: '[data-testid="hero-card"] .hero-top', title: "Friday, at a glance.", body: "See the payroll gap and what is secured. Once it's covered, save a payday image to share with your crew." },
  { selector: '[data-testid="open-plan-btn"]', title: "You make the final call.", body: "Open the plan to review the lowest-cost options. Nothing moves ahead without your approval." },
  { selector: '[data-testid="dashboard-access-button"]', title: "Try the whole journey.", body: "Monthly demo access unlocks plan actions and the buying agent through Stripe test checkout. No real charges." },
];

export const DashboardTour = ({ replay = 0 }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const focus = useRef(null);
  const tip = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "true"; } catch (_) {}
    if (!seen || replay > 0) {
      const timer = setTimeout(() => { setStep(0); setOpen(true); }, 300);
      return () => clearTimeout(timer);
    }
  }, [replay]);
  useEffect(() => {
    if (!open) return;
    focus.current = document.activeElement;
    document.getElementById("root").inert = true;
    return () => { document.getElementById("root").inert = false; focus.current?.focus?.(); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const target = document.querySelector(STEPS[step].selector);
    if (!target) { setOpen(false); return; }
    target.scrollIntoView({ block: "center", behavior: "instant" });
    const measure = () => {
      const r = target.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(352, vw - 32);
      const height = tip.current?.offsetHeight || 255;
      const bottom = r.bottom + 18;
      const top = bottom + height < window.innerHeight - 24 ? bottom : Math.max(16, r.top - height - 18);
      setRect({ x: Math.max(4, r.x - 7), y: r.y - 7, w: Math.min(r.width + 14, vw - 8), h: r.height + 14,
        tipX: Math.max(16, Math.min(vw-width-16, r.x)), tipY: top, tipW: width });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(target);
    if (tip.current) observer.observe(tip.current);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, step]);
  const close = () => {
    try { localStorage.setItem(KEY, "true"); } catch (_) {}
    setOpen(false);
  };
  const transition = reduce ? { duration: 0 } : MOVE_SPRING;
  return <Dialog open={open} onOpenChange={(v) => !v && close()}>
    <AnimatePresence>{open && rect && <DialogPortal forceMount key="tour">
      <DialogOverlay asChild forceMount>
        <motion.div className="tour-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }} data-testid="dashboard-tour-overlay">
          <svg className="tour-mask" aria-hidden="true" width="100%" height="100%">
            <defs><mask id="tour-spotlight"><rect width="100%" height="100%" fill="white" /><motion.rect initial={false} animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} transition={transition} rx="16" fill="black" /></mask></defs>
            <rect width="100%" height="100%" fill="var(--scrim-strong)" mask="url(#tour-spotlight)" />
            <motion.rect initial={false} animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} transition={transition} rx="16" fill="none" stroke="var(--teal)" strokeWidth="2" />
          </svg>
        </motion.div>
      </DialogOverlay>
      <DialogSurface asChild forceMount onInteractOutside={(e) => e.preventDefault()} onCloseAutoFocus={(e) => { e.preventDefault(); focus.current?.focus?.(); }}>
        <motion.div ref={tip} className="tour-tip g-glass" style={{ width: rect.tipW }} initial={{ opacity: 0, x: rect.tipX, y: rect.tipY }} animate={{ opacity: 1, x: rect.tipX, y: rect.tipY }} exit={{ opacity: 0 }} transition={transition} data-testid="dashboard-tour-tooltip">
          <div className="sec-head"><span className="eyebrow" data-testid="dashboard-tour-step-indicator" aria-live="polite">YOUR QUICK TOUR · {step+1} / 3</span><MotionButton className="icon-btn" aria-label="Close tour" onClick={close} data-testid="dashboard-tour-close"><X size={16} /></MotionButton></div>
          <DialogTitle className="h3" data-testid="dashboard-tour-title">{STEPS[step].title}</DialogTitle>
          <DialogDescription className="muted" data-testid="dashboard-tour-description">{STEPS[step].body}</DialogDescription>
          <div className="tour-actions"><MotionButton className="btn btn-ghost btn-sm" onClick={close} data-testid="dashboard-tour-skip-button">Skip</MotionButton><div className="tour-nav">
            {step > 0 && <MotionButton className="icon-btn" aria-label="Previous step" onClick={() => setStep(s=>s-1)} data-testid="dashboard-tour-back-button"><ArrowLeft size={18} /></MotionButton>}
            <MotionButton className="btn btn-primary btn-sm" onClick={() => step === 2 ? close() : setStep(s=>s+1)} data-testid="dashboard-tour-next-button">{step === 2 ? "Let's go" : "Next"}{step === 2 ? <Check size={16} /> : <ArrowRight size={16} />}</MotionButton>
          </div></div>
        </motion.div>
      </DialogSurface>
    </DialogPortal>}</AnimatePresence>
  </Dialog>;
};
