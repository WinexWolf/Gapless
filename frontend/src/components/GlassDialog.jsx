import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogPortal, DialogOverlay, DialogSurface } from "@/components/ui/dialog";
import { SHEET_SPRING } from "@/components/MotionButton";

export const useMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 640px)");
    const change = () => setMobile(q.matches);
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  return mobile;
};

export const GlassDialog = ({ open, onOpenChange, children, testId, className = "" }) => {
  const reduce = useReducedMotion();
  const mobile = useMobile();
  const focus = useRef(null);
  useEffect(() => {
    if (!open) return;
    focus.current = document.activeElement;
    const root = document.getElementById("root");
    root.inert = true;
    return () => { root.inert = false; focus.current?.focus?.(); };
  }, [open]);
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, ...(mobile ? { y: "100%" } : { x: "100%" }) };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <AnimatePresence>
      {open && <DialogPortal forceMount key="glass-dialog">
        <DialogOverlay asChild forceMount>
          <motion.div className="glass-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }} data-testid={`${testId}-scrim`} />
        </DialogOverlay>
        <DialogSurface asChild forceMount onEscapeKeyDown={(e) => { e.preventDefault(); onOpenChange(false); }} onCloseAutoFocus={(e) => { e.preventDefault(); focus.current?.focus?.(); }}>
          <motion.section className={`glass-sheet ${className}`} initial={hidden} animate={{ x: 0, y: 0, opacity: 1 }} exit={hidden} transition={reduce ? { duration: 0 } : SHEET_SPRING} data-testid={testId}>
            {children}
          </motion.section>
        </DialogSurface>
      </DialogPortal>}
    </AnimatePresence>
  </Dialog>;
};
