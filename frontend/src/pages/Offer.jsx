import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Lock } from "lucide-react";
import { http, money, fdate, errMsg } from "@/lib/api";
import { Loading } from "@/components/Common";

const S = {
  en: {
    from: "Offer from", invoice: "Invoice", amount: "Amount", due: "Due", offer: "The offer", accept: "Accept", counter: "Counter", decline: "Decline",
    percent: "Percent", days: "Days", note: "Note (optional)", send: "Send counter", pay: "Pay now", paid: "Payment received. Thank you!",
    accepted: "Accepted. Thank you!", declined: "You declined this offer.", countered: "Counter sent. Maria will review it.",
    optout: "Prefer not to get these messages? Reply STOP to the email and we won't contact you about this again.",
    test: "Stripe TEST mode · use card 4242 4242 4242 4242, any future date, any CVC", checking: "Confirming payment…",
    collect: (o) => `Please pay ${money(o.amount_due)} for this invoice.`,
    early_pay: (o) => `Pay ${money(o.amount_due)} instead of the full amount (${o.discount_pct}% off) if paid by ${fdate(o.expires)}.`,
    split: (o) => `Split in two: ${money(o.first)} now and ${money(o.second)} on ${fdate(o.second_date)}.`,
    extension: (o) => `Move the due date to ${fdate(o.new_due)} (net+10) for a ${o.fee_pct}% fee (${money(o.fee)}).`,
    history: "History", private: "Private link · shows only this offer",
  },
  es: {
    from: "Oferta de", invoice: "Factura", amount: "Monto", due: "Vence", offer: "La oferta", accept: "Aceptar", counter: "Contraoferta", decline: "Rechazar",
    percent: "Porcentaje", days: "Días", note: "Nota (opcional)", send: "Enviar contraoferta", pay: "Pagar ahora", paid: "Pago recibido. ¡Gracias!",
    accepted: "Aceptado. ¡Gracias!", declined: "Rechazó esta oferta.", countered: "Contraoferta enviada. Maria la revisará.",
    optout: "¿Prefiere no recibir estos mensajes? Responda STOP al correo y no volveremos a escribirle sobre esto.",
    test: "Stripe modo PRUEBA · tarjeta 4242 4242 4242 4242, cualquier fecha futura y CVC", checking: "Confirmando pago…",
    collect: (o) => `Por favor pague ${money(o.amount_due)} por esta factura.`,
    early_pay: (o) => `Pague ${money(o.amount_due)} en lugar del total (${o.discount_pct}% de descuento) antes del ${fdate(o.expires, "es")}.`,
    split: (o) => `Dividir en dos: ${money(o.first)} ahora y ${money(o.second)} el ${fdate(o.second_date, "es")}.`,
    extension: (o) => `Mover el vencimiento al ${fdate(o.new_due, "es")} (neto+10) con un cargo de ${o.fee_pct}% (${money(o.fee)}).`,
    history: "Historial", private: "Enlace privado · solo muestra esta oferta",
  },
};

export default function Offer() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState("en");
  const [showCounter, setShowCounter] = useState(false);
  const [pct, setPct] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const t = S[lang];

  const load = useCallback(() => http.get(`/offers/${token}`).then((r) => { setO(r.data); return r.data; }).catch((e) => setErr(errMsg(e))), [token]);
  useEffect(() => { load().then((d) => d && setLang(d.language || "en")); }, [load]);

  useEffect(() => {
    const sid = sp.get("session_id");
    if (!sid) return;
    let n = 0;
    let stop = false;
    setChecking(true);
    const poll = async () => {
      try {
        const r = await http.get(`/payments/status`, { params: { session_id: sid } });
        if (r.data.payment_status === "paid" || n >= 10 || stop) { setChecking(false); load(); return; }
      } catch (e) { setChecking(false); return; }
      n += 1;
      setTimeout(poll, 2000);
    };
    poll();
    return () => { stop = true; };
  }, [sp, load]);

  const act = async (path, body) => {
    setBusy(true);
    try {
      const r = await http.post(`/offers/${token}/${path}`, body || {});
      setO(r.data);
      if (r.data.guardrail?.blocked) toast.error(r.data.guardrail.reason);
      setShowCounter(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const pay = async () => {
    setBusy(true);
    try {
      const r = await http.post("/payments/checkout", { token, origin_url: window.location.origin });
      window.location.href = r.data.url;
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  if (err) return <div className="offer-wrap"><div className="card"><h2 className="h3">Offer not found</h2><p className="muted">{err}</p></div></div>;
  if (!o) return <div className="offer-wrap"><Loading /></div>;
  const usesPct = ["early_pay", "extension"].includes(o.offer.type);

  return (
    <div className="offer-wrap" data-testid="offer-page">
      <div className="offer-top">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>{o.business}</div>
        <div className="seg" role="group" aria-label="Language">
          {["en", "es"].map((l) => <button key={l} className={lang === l ? "on" : ""} onClick={() => setLang(l)} data-testid={`offer-lang-${l}`}>{l.toUpperCase()}</button>)}
        </div>
      </div>
      <section className="card">
        <div className="eyebrow"><Lock size={12} /> {t.private}</div>
        <h1 className="h2">{t.from} {o.business}</h1>
        <p className="muted">To: {o.counterparty}</p>
        <div className="offer-inv">
          <div><span>{t.invoice}</span><b>{o.invoice.number}</b></div>
          <div><span>{t.amount}</span><b className="num">{money(o.invoice.amount)}</b></div>
          <div><span>{t.due}</span><b>{fdate(o.invoice.due_date, lang)}</b></div>
        </div>
        <div className="offer-box" data-testid="offer-terms">
          <div className="eyebrow">{t.offer} · {o.offer.type_label}</div>
          <p className="offer-text">{t[o.offer.type](o.offer)}</p>
        </div>

        {checking && <p className="muted" data-testid="payment-checking">{t.checking}</p>}
        {o.status === "paid" && <div className="banner banner-green" data-testid="offer-paid"><CheckCircle2 size={20} /> {t.paid}</div>}
        {o.status === "declined" && <div className="banner banner-red" data-testid="offer-declined">{t.declined}</div>}
        {o.status === "countered" && <div className="banner banner-amber" data-testid="offer-countered">{t.countered}</div>}
        {o.status === "accepted" && (
          <div className="accepted-box" data-testid="offer-accepted">
            <div className="banner banner-green"><CheckCircle2 size={20} /> {t.accepted}</div>
            {o.payable && (
              <>
                <button className="btn btn-primary btn-lg" onClick={pay} disabled={busy} data-testid="pay-now-btn"><CreditCard size={18} /> {t.pay} · {money(o.offer.amount_due)}</button>
                <p className="tiny muted">{t.test}</p>
              </>
            )}
          </div>
        )}
        {o.status === "open" && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => act("accept")} disabled={busy} data-testid="offer-accept-btn">{t.accept}</button>
            <button className="btn btn-ghost" onClick={() => setShowCounter(!showCounter)} data-testid="offer-counter-btn">{t.counter}</button>
            <button className="btn btn-ghost danger" onClick={() => act("decline")} disabled={busy} data-testid="offer-decline-btn">{t.decline}</button>
          </div>
        )}
        {showCounter && o.status === "open" && (
          <div className="counter-form" data-testid="counter-form">
            {usesPct && <label>{t.percent}<input className="input" type="number" step="0.25" min="0" value={pct} onChange={(e) => setPct(e.target.value)} data-testid="counter-percent" /></label>}
            {o.offer.type !== "early_pay" && <label>{t.days}<input className="input" type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} data-testid="counter-days" /></label>}
            <label className="full">{t.note}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} data-testid="counter-note" /></label>
            <button className="btn btn-primary" disabled={busy} onClick={() => act("counter", { percent: pct === "" ? null : Number(pct), days: days === "" ? null : Number(days), note })} data-testid="counter-submit">{t.send}</button>
          </div>
        )}
        {o.history.length > 0 && (
          <div className="offer-hist">
            <div className="eyebrow">{t.history}</div>
            {o.history.map((h, i) => <div key={i} className="small"><b>{h.actor}:</b> {h.text}</div>)}
          </div>
        )}
        <p className="tiny muted optout" data-testid="offer-optout">{t.optout}</p>
      </section>
      <footer className="footer" data-testid="footer">Demo: synthetic data</footer>
    </div>
  );
}
