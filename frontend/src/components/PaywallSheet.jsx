import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CreditCard, LockKeyhole, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GlassDialog } from "@/components/GlassDialog";
import { MotionButton } from "@/components/MotionButton";
import { useBilling } from "@/lib/billing";
import { http, errMsg } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export const PaywallSheet = ({ open, onOpenChange, language }) => {
  const { status, error, refresh } = useBilling();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const abort = useRef(null);
  const es = language === "es";
  useEffect(() => {
    if (open) { setMessage(""); setConfirmCancel(false); refresh().catch(() => {}); }
    return () => { abort.current?.abort(); setBusy(false); };
  }, [open, refresh]);
  const checkout = async () => {
    setBusy(true); setMessage("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const r = await http.post("/billing/checkout", { origin_url: window.location.origin, lookup_key: status.lookup_key }, { signal: controller.signal });
      if (!controller.signal.aborted) window.location.assign(r.data.url);
    } catch (e) { if (e.code !== "ERR_CANCELED") setMessage(errMsg(e)); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true); setMessage("");
    try { await http.post("/billing/cancel"); await refresh(); setConfirmCancel(false); toast.success(es ? "Renovación de prueba cancelada" : "Test renewal canceled"); }
    catch (e) { setMessage(errMsg(e)); }
    finally { setBusy(false); }
  };
  return <GlassDialog open={open} onOpenChange={onOpenChange} testId="paywall-sheet">
    <div className="glass-sheet-head">
      <div className="sec-head">
        <span className="chip chip-teal" data-testid="paywall-test-badge"><CreditCard size={14} /> {es ? "SOLO MODO DE PRUEBA" : "TEST MODE ONLY"}</span>
        <MotionButton className="icon-btn" aria-label={es ? "Cerrar" : "Close access panel"} onClick={() => onOpenChange(false)} data-testid="paywall-close-button"><X /></MotionButton>
      </div>
      <div className="paywall-icon"><LockKeyhole size={28} /></div>
      <DialogTitle className="h1" data-testid="paywall-title">{status?.active ? (es ? "Tu acceso está activo." : "Your access is active.") : (es ? "De ver el plan a hacerlo." : "From seeing the plan to making it happen.")}</DialogTitle>
      <DialogDescription className="muted" data-testid="paywall-description">{es ? "Acceso mensual a la demo. Explora cómo Gapless ayuda a cuidar tu nómina." : "Monthly demo access. Try the full journey to a calmer payday."}</DialogDescription>
    </div>
    <div className="glass-sheet-body">
      {!status && !error ? <Skeleton className="billing-skeleton" data-testid="paywall-loading" /> : <>
        <div className="paywall-price" data-testid="paywall-price"><b>{status?.price_label || "$19 USD"}</b><span>{es ? "/ mes" : "/ month"}</span></div>
        <p className="tiny muted" data-testid="paywall-sample-price">{es ? "Precio de ejemplo editable · impuestos de prueba calculados al pagar" : "Editable sample price · test tax calculated at checkout"}</p>
        <ul className="paywall-benefits" data-testid="paywall-benefits">
          {(es ? ["Aprueba planes y simula respuestas", "Prueba al agente de compras de principio a fin", "Explora ofertas, límites y decisiones"] : ["Approve plans and simulate replies", "Try the buying agent from request to delivery", "Explore offers, guardrails and decisions"]).map((s, i) => <li key={s} data-testid={`paywall-benefit-${i}`}><Check size={18} />{s}</li>)}
        </ul>
        <div className="paywall-safety" data-testid="paywall-safety"><ShieldCheck size={19} /><p>{es ? "No se cobra dinero real. Usa una tarjeta de prueba. La previsión y las imágenes para compartir siguen siendo gratuitas." : "No real money is charged. Use a test card. Forecast previews and share images stay free."}</p></div>
        <p className="tiny muted" data-testid="paywall-browser-note">{es ? "El acceso se guarda en este navegador, sin cuenta. Si borras las cookies, pierdes el acceso a esta demo." : "Access belongs to this browser, with no account. Clearing cookies loses access to this demo."}</p>
        {status?.active && <div className="banner banner-green" data-testid="paywall-active-status">{status.cancel_at_period_end ? (es ? "Termina el " : "Ends on ") : (es ? "Próxima renovación de prueba: " : "Next test renewal: ")}{status.period_end}</div>}
      </>}
      {(message || error) && <p className="inline-error" role="alert" data-testid="paywall-error">{message || error}</p>}
      {confirmCancel && <div className="paywall-safety" data-testid="paywall-cancel-confirm"><p>{es ? "¿Cancelar la renovación? Conservas el acceso hasta el fin del período." : "Cancel test renewal? You keep access until the period ends."}</p><MotionButton className="btn btn-ghost" disabled={busy} onClick={cancel} data-testid="paywall-confirm-cancel">{es ? "Confirmar" : "Confirm cancellation"}</MotionButton></div>}
    </div>
    <div className="glass-sheet-foot">
      {status?.active ? <>
        <MotionButton className="btn btn-primary" onClick={() => onOpenChange(false)} data-testid="paywall-done-button">{es ? "Seguir explorando" : "Keep exploring"}<ArrowRight size={18} /></MotionButton>
        {!status.cancel_at_period_end && <MotionButton className="btn btn-ghost" disabled={busy} onClick={() => setConfirmCancel(!confirmCancel)} data-testid="paywall-cancel-button">{es ? "Cancelar renovación de prueba" : "Cancel test renewal"}</MotionButton>}
      </> : <MotionButton className="btn btn-primary" disabled={busy || !status?.checkout_ready || !!error} onClick={checkout} data-testid="paywall-continue-to-stripe-button">{busy ? <RefreshCw className="spin" size={17} /> : <LockKeyhole size={17} />}{busy ? (es ? "Abriendo pago…" : "Opening checkout…") : (es ? "Continuar a Stripe" : "Continue to Stripe")}<ArrowRight size={18} /></MotionButton>}
      <MotionButton className="btn btn-ghost" onClick={() => refresh().catch(() => {})} data-testid="paywall-refresh-button"><RefreshCw size={16} />{es ? "Actualizar acceso" : "Refresh access"}</MotionButton>
      <p className="tiny muted" data-testid="paywall-checkout-trust">{es ? "Pago seguro con Stripe · Puedes cancelar la renovación de prueba" : "Secure checkout by Stripe · Cancel test renewal anytime"}</p>
    </div>
  </GlassDialog>;
};
