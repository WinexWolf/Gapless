import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Settings as Cog, Activity as Act, Send, ChevronRight, FilePlus2, CalendarDays, Home, Sparkles } from "lucide-react";
import { http, errMsg, useApp } from "@/lib/api";

const EMPTY = { kind: "receivable", party: "", number: "", amount: "", due_date: "" };

export default function More() {
  const { bump } = useApp();
  const [text, setText] = useState("");
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState("");

  const parse = async () => {
    setBusy(true);
    try {
      const r = await http.post("/invoices/parse", { text });
      setF({ ...EMPTY, ...Object.fromEntries(Object.entries(r.data.fields).map(([k, v]) => [k, v ?? ""])) });
      setSrc(r.data.source);
      toast(r.data.source === "ai" ? "Fields filled from the text. Check them before adding." : "Filled what we could. Please check the fields.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const add = async () => {
    setBusy(true);
    try { await http.post("/invoices", { ...f, amount: Number(f.amount) }); toast.success("Invoice added to the forecast"); setF(EMPTY); setText(""); setSrc(""); bump(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const links = [["/", "Back to home", Home], ["/walkthrough", "Guided walkthrough", Sparkles], ["/digest", "Monday digest", CalendarDays], ["/activity", "Activity log", Act], ["/outbox", "Outbox", Send], ["/settings", "Settings", Cog]];

  return (
    <div className="page narrow" data-testid="more-page">
      <div className="page-head"><div><div className="eyebrow">More</div><h1 className="h1">Tools</h1></div></div>
      <section className="card list-links">
        {links.map(([to, label, Icon]) => (
          <Link key={to} to={to} className="list-link" data-testid={`more-link-${to === "/" ? "home" : to.slice(1)}`}><Icon size={18} /> <span>{label}</span><ChevronRight size={18} /></Link>
        ))}
      </section>
      <section className="card" data-testid="add-invoice">
        <h2 className="h3"><FilePlus2 size={18} /> Add invoice</h2>
        <p className="tiny muted">Paste invoice text to fill the form, or type the fields yourself. Adding an invoice changes the forecast.</p>
        <textarea className="input" rows={4} placeholder="e.g. Invoice INV-2001 from Garcia Patio, $1,850 due 2026-11-12" value={text} onChange={(e) => setText(e.target.value)} data-testid="invoice-text" />
        <button className="btn btn-ghost btn-sm" disabled={!text.trim() || busy} onClick={parse} data-testid="invoice-parse-btn">Fill from text</button>
        {src && <span className="tiny muted"> Parsed by {src === "ai" ? "AI" : "simple rules (fallback)"}</span>}
        <div className="form-grid">
          <label>Type<select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} data-testid="invoice-kind"><option value="receivable">Customer owes me</option><option value="payable">I owe a vendor</option></select></label>
          <label>Customer / vendor<input className="input" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} data-testid="invoice-party" /></label>
          <label>Invoice #<input className="input" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} data-testid="invoice-number" /></label>
          <label>Amount ($)<input className="input num" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} data-testid="invoice-amount" /></label>
          <label>Due date<input className="input" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} data-testid="invoice-due" /></label>
        </div>
        <button className="btn btn-primary" disabled={busy || !f.party || !f.amount || !f.due_date} onClick={add} data-testid="invoice-add-btn">Add invoice</button>
      </section>
    </div>
  );
}
