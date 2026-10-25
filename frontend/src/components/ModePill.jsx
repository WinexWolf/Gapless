import React from "react";
import { Sparkles, Radio } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { useMode } from "@/lib/mode";

export default function ModePill({ compact }) {
  const { mode, setMode } = useMode();
  const demo = mode === "demo";
  return (
    <div className="seg mode-pill" role="group" aria-label="App mode" data-testid="mode-pill">
      <MotionButton
        className={demo ? "on" : ""}
        onClick={() => setMode("demo")}
        aria-pressed={demo}
        data-testid="mode-demo"
        title="Demo: watch the agents work with guided playback"
      >
        <Sparkles size={14} /> {compact ? "Demo" : "Demo"}
      </MotionButton>
      <MotionButton
        className={!demo ? "on" : ""}
        onClick={() => setMode("real")}
        aria-pressed={!demo}
        data-testid="mode-real"
        title="Real: operate with your own data, no auto-replies"
      >
        <Radio size={14} /> Real
      </MotionButton>
    </div>
  );
}
