import React, { useEffect, useState } from "react";

// Lightweight CSS-only confetti burst. No deps.
// Fires once per `fireKey` change; auto-cleans after 2.4s.
const COLORS = ["#0E7C74", "#7EE0A6", "#1E8A4C", "#E08A1E", "#0F3D3A", "#146C3B"];
const COUNT = 60;

export default function Confetti({ fireKey }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!fireKey) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const next = Array.from({ length: COUNT }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.25;
      const dur = 1.6 + Math.random() * 1.1;
      const drift = -40 + Math.random() * 80;
      const rot = -180 + Math.random() * 360;
      const rotEnd = rot + (-540 + Math.random() * 1080);
      const size = 6 + Math.random() * 6;
      const color = COLORS[i % COLORS.length];
      const shape = Math.random() > 0.6 ? "circle" : "rect";
      return { id: `${fireKey}-${i}`, left, delay, dur, drift, rot, rotEnd, size, color, shape };
    });
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 2600);
    return () => clearTimeout(t);
  }, [fireKey]);

  if (pieces.length === 0) return null;
  return (
    <div className="confetti-stage" aria-hidden="true" data-testid="confetti-burst">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece ${p.shape === "circle" ? "circle" : ""}`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
            "--rot-end": `${p.rotEnd}deg`,
          }}
        />
      ))}
    </div>
  );
}
