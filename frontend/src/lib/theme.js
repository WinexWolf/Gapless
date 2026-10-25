import { useEffect, useSyncExternalStore } from "react";
const KEY = "gapless-theme";
const CHANGE = "gapless-theme-change";
export const currentTheme = () => {
  try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark") return v; } catch (_) {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
const subscribe = (callback) => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(CHANGE, callback); window.addEventListener("storage", callback); media.addEventListener("change", callback);
  return () => { window.removeEventListener(CHANGE, callback); window.removeEventListener("storage", callback); media.removeEventListener("change", callback); };
};
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, () => "light");
export const toggleTheme = () => {
  try { localStorage.setItem(KEY, currentTheme() === "dark" ? "light" : "dark"); } catch (_) {}
  window.dispatchEvent(new Event(CHANGE));
};
export const ThemeSync = () => {
  const theme = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const icon = document.getElementById("gapless-favicon");
    if (icon) icon.href = `/favicon-${theme}.svg`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0A1E1C" : "#F2F6F5";
  }, [theme]);
  return null;
};
