import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { http, errMsg, useApp } from "@/lib/api";
import { useMode } from "@/lib/mode";

export default function DemoControls() {
  const { bump, tick } = useApp();
  const { isDemo } = useMode();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(true);
  const [last, setLast] = useState("");
  const screen = loc.pathname.startsWith("/buy") ? "buy" : "payroll";

  useEffect(() => {
    http.get("/settings").then((r) => setAi(!!r.data.supplier_has_ai)).catch(() => {});
  }, [tick]);

  if (!isDemo || loc.pathname.startsWith("/walkthrough")) return null;

  const next = async () => {
    setBusy(true);
    try {
      const r = await http.post("/demo/simulate-next", { screen });
      setLast(r.data.message);
      r.data.ok ? toast.success(r.data.message) : toast(r.data.message);
      bump();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await http.post("/demo/reset");
      setLast("Demo reset to the start.");
      toast.success("Demo reset");
      bump();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleAi = async () => {
    const v = !ai;
    setAi(v);
    try {
      await http.put("/settings", { supplier_has_ai: v });
      bump();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className={`demo-panel ${open ? "open" : ""}`} data-testid="demo-controls">
      {open && (
        <div className="demo-body">
          <div className="demo-title">
            <span>Demo controls</span>
            <button className="icon-btn light" onClick={() => setOpen(false)} aria-label="Close demo controls" data-testid="demo-close"><X size={18} /></button>
          </div>
          <p className="demo-hint">Next advances {screen === "buy" ? "one step of the buying agent" : "one counterparty response"}.</p>
          <label className="demo-toggle">
            <span>Supplier has an AI agent</span>
            <button role="switch" aria-checked={ai} className={`switch ${ai ? "on" : ""}`} onClick={toggleAi} data-testid="demo-ai-toggle"><span /></button>
          </label>
          <button className="btn btn-ghost-light" onClick={reset} disabled={busy} data-testid="demo-reset"><RotateCcw size={16} /> Reset demo</button>
          {last && <div className="demo-last" data-testid="demo-last">{last}</div>}
        </div>
      )}
      <div className="demo-bar">
        {!open && (
          <button className="icon-btn light" onClick={() => setOpen(true)} aria-label="Open demo controls" data-testid="demo-open"><SlidersHorizontal size={18} /></button>
        )}
        <button className="btn demo-next" onClick={next} disabled={busy} data-testid="demo-next">
          {busy ? "Working…" : "Next"} <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
