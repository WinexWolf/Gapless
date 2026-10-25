import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { useBilling } from "@/lib/billing";
import { errMsg } from "@/lib/api";
import { MotionButton } from "@/components/MotionButton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const { refresh, openPaywall } = useBilling();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const sessionId = params.get("session_id");
  const canceled = params.get("cancelled") === "1";
  useEffect(() => {
    if (canceled) { setWaiting(false); return; }
    if (!sessionId) { setError("No checkout was supplied. Open monthly access to start a test checkout."); setWaiting(false); return; }
    let live = true, timeout;
    let count = 0;
    setWaiting(true); setError("");
    const poll = async () => {
      try {
        const s = await refresh(sessionId);
        if (!live) return;
        setResult(s);
        if (s.active || ++count >= 6) setWaiting(false);
        else timeout = setTimeout(poll, 2000);
      } catch (e) { if (live) { setError(errMsg(e)); setWaiting(false); } }
    };
    poll();
    return () => { live = false; clearTimeout(timeout); };
  }, [sessionId, canceled, refresh, attempt]);
  return <div className="page narrow" data-testid="billing-return-page"><section className="card billing-return-card">
    <span className="chip chip-teal">STRIPE TEST CHECKOUT</span>
    <div className="paywall-icon">{result?.active ? <CheckCircle2 size={30} /> : <CreditCard size={30} />}</div>
    <h1 className="h1" data-testid="billing-return-status">{canceled ? "Checkout canceled." : result?.active ? "You're in. Let's close that gap." : waiting ? "Confirming with Stripe…" : "Access not confirmed yet."}</h1>
    {waiting && <Skeleton className="billing-skeleton" data-testid="billing-return-loading" />}
    <p className="muted" data-testid="billing-return-detail">{canceled ? "Nothing was charged and checkout hasn't unlocked access. You can keep previewing or try again." : result?.active ? `Monthly demo access is active in this browser. Your test period runs through ${result.period_end}. No real money moved.` : "We only unlock access after Stripe confirms a paid test subscription. You can check again safely."}</p>
    {error && <p className="inline-error" role="alert" data-testid="billing-return-error">{error}</p>}
    <div className="btn-row"><MotionButton asChild className="btn btn-primary" data-testid="billing-return-dashboard"><Link to="/dashboard">Back to dashboard</Link></MotionButton>
      {!result?.active && <MotionButton className="btn btn-ghost" disabled={waiting} onClick={() => canceled || !sessionId ? openPaywall() : setAttempt(x => x+1)} data-testid="billing-return-retry"><RefreshCw size={16} />{canceled || !sessionId ? "Open monthly access" : "Check again"}</MotionButton>}
    </div>
  </section></div>;

}
