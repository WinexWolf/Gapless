import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { http, useApp } from "@/lib/api";

const ModeCtx = createContext({ mode: "demo", isDemo: true, setMode: () => {}, loaded: false });
export const useMode = () => useContext(ModeCtx);

export const ModeProvider = ({ children }) => {
  const { bump, tick } = useApp();
  const [mode, setModeState] = useState("demo");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    http.get("/settings")
      .then((r) => setModeState(r.data.mode === "real" ? "real" : "demo"))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [tick]);

  const setMode = useCallback(async (m) => {
    const next = m === "real" ? "real" : "demo";
    setModeState(next);
    try {
      await http.put("/settings", { mode: next });
      bump();
    } catch (e) {
      /* keep optimistic value; settings page surfaces errors */
    }
  }, [bump]);

  return (
    <ModeCtx.Provider value={{ mode, isDemo: mode === "demo", setMode, loaded }}>
      {children}
    </ModeCtx.Provider>
  );
};
