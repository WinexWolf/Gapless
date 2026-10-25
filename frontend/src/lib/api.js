import axios from "axios";
import { createContext, useContext } from "react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const http = axios.create({ baseURL: API, timeout: 30000, withCredentials: true });

// Attach the Clerk session token (when signed in) to every API request so the
// backend can enforce roles. Public endpoints simply ignore the missing header.
http.interceptors.request.use(async (config) => {
  try {
    const clerk = typeof window !== "undefined" ? window.Clerk : null;
    if (clerk && clerk.session) {
      const token = await clerk.session.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) { /* not signed in yet */ }
  return config;
});

export const money = (x) => {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return "—";
  const n = Number(x);
  const a = Math.abs(n);
  const whole = Math.abs(a - Math.round(a)) < 0.005;
  const s = a.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `${n < 0 ? "-" : ""}$${s}`;
};

export const fdate = (iso, lang = "en") => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric" });
};

export const ftime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
};

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(", ");
  return e?.message || "Something went wrong";
};

export const AppCtx = createContext({ tick: 0, bump: () => {} });
export const useApp = () => useContext(AppCtx);
