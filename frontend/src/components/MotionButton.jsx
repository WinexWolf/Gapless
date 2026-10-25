import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

const SpringButton = motion.create(Button);
export const PRESS_SPRING = { type: "spring", stiffness: 600, damping: 38, mass: 0.6 };
export const SHEET_SPRING = { type: "spring", stiffness: 320, damping: 34, mass: 0.9 };
export const MOVE_SPRING = { type: "spring", stiffness: 260, damping: 33, mass: 1 };
export const MotionButton = React.forwardRef(({ className = "", ...props }, ref) => {
  const reduce = useReducedMotion();
  return <SpringButton ref={ref} variant="ghost" className={`motion-button ${className}`} whileTap={reduce ? undefined : { scale: 0.98 }} transition={PRESS_SPRING} {...props} />;
});
MotionButton.displayName = "MotionButton";
