import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { http, errMsg } from "@/lib/api";
import { PaywallSheet } from "@/components/PaywallSheet";

const BillingContext = createContext(null);
export const useBilling = () => useContext(BillingContext);
export const BillingProvider = ({ children }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const refresh = useCallback(async (sessionId) => {
    setError("");
    try {
      const r = await http.get("/billing/status", { params: sessionId ? { session_id: sessionId } : {} });
      setStatus(r.data);
      return r.data;
    } catch (e) { setError(errMsg(e)); throw e; }
  }, []);
  const openPaywall = useCallback((lang = "en") => { setLanguage(lang); setOpen(true); }, []);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);
  useEffect(() => {
    const id = http.interceptors.response.use((r) => r, (e) => {
      if (e.response?.status === 402) openPaywall();
      return Promise.reject(e);
    });
    return () => http.interceptors.response.eject(id);
  }, [openPaywall]);
  return <BillingContext.Provider value={{ status, error, refresh, openPaywall }}>
    {children}
    <PaywallSheet open={open} onOpenChange={setOpen} language={language} />
  </BillingContext.Provider>;
};
