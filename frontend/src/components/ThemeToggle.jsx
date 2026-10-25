import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme, toggleTheme } from "@/lib/theme";
import { MotionButton } from "@/components/MotionButton";

export default function ThemeToggle({ compact = false, language = "en" }) {
  const dark = useTheme() === "dark";
  const label = language === "es" ? (dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro") : (dark ? "Switch to light mode" : "Switch to dark mode");
  return <MotionButton type="button" onClick={toggleTheme} className={`theme-toggle ${compact ? "compact" : ""}`} aria-label={label} title={label} data-testid="theme-toggle">
    {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    {!compact && <span className="theme-toggle-label">{language === "es" ? (dark ? "Claro" : "Oscuro") : (dark ? "Light" : "Dark")}</span>}
  </MotionButton>;
}
