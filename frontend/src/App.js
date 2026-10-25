import React, { useCallback, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { BillingProvider } from "@/lib/billing";
import { ThemeSync } from "@/lib/theme";
import BillingReturn from "@/pages/BillingReturn";
import { Toaster } from "@/components/ui/sonner";
import { LayoutDashboard, ListChecks, ShoppingCart, MessagesSquare, Menu, Sparkles } from "lucide-react";
import { AppCtx } from "@/lib/api";
import { ModeProvider } from "@/lib/mode";
import ModePill from "@/components/ModePill";
import DemoControls from "@/components/DemoControls";
import Dashboard from "@/pages/Dashboard";
import Plan from "@/pages/Plan";
import Threads from "@/pages/Threads";
import Buy from "@/pages/Buy";
import Walkthrough from "@/pages/Walkthrough";
import More from "@/pages/More";
import Settings from "@/pages/Settings";
import Activity from "@/pages/Activity";
import Outbox from "@/pages/Outbox";
import Offer from "@/pages/Offer";
import Landing from "@/pages/Landing";
import Digest from "@/pages/Digest";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/plan", label: "Plan", icon: ListChecks, id: "plan" },
  { to: "/buy", label: "Buy", icon: ShoppingCart, id: "buy" },
  { to: "/threads", label: "Threads", icon: MessagesSquare, id: "threads" },
  { to: "/walkthrough", label: "Demo", icon: Sparkles, id: "walkthrough" },
  { to: "/more", label: "More", icon: Menu, id: "more" },
];

export function Footer() {
  return <footer className="footer" data-testid="footer">Gapless</footer>;
}

function Shell() {
  return (
    <ModeProvider>
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-in">
          <Link to="/" className="brand" data-testid="brand">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless
          </Link>
          <nav className="top-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className="top-link" data-testid={`nav-${n.id}`}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="g-top-right">
            <ModePill compact />
            <ThemeToggle compact />
            <div className="biz-pill" data-testid="biz-pill">Bay Remodel Co.</div>
          </div>
        </div>
      </header>
      <main className="g-main">
        <Routes>
          <Route path="/billing/return" element={<BillingReturn />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/digest" element={<Digest />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/threads" element={<Threads />} />
          <Route path="/buy" element={<Buy />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
          <Route path="/more" element={<More />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/outbox" element={<Outbox />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
        <Footer />
      </main>
      <nav className="g-bottom" aria-label="Main mobile">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className="bottom-link" data-testid={`bnav-${n.id}`}>
            <n.icon size={20} aria-hidden="true" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <DemoControls />
    </div>
    </ModeProvider>
  );
}

export default function App() {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return (
    <MotionConfig reducedMotion="user">
    <AppCtx.Provider value={{ tick, bump }}>
      <ThemeSync />
      <BrowserRouter>
        <BillingProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/o/:token" element={<Offer />} />
          <Route path="*" element={<Shell />} />
        </Routes>
        </BillingProvider>
      </BrowserRouter>
      <Toaster position="top-center" visibleToasts={3} closeButton />
    </AppCtx.Provider>
    </MotionConfig>
  );
}
