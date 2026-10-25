import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Pencil, Send, RefreshCw, ExternalLink, ShieldCheck, X } from "lucide-react";
import { http, money, errMsg, useApp } from "@/lib/api";
import { Chip, StatusChip, Sheet, TYPE_CLASS, Loading } from "@/components/Common";
import GapBar from "@/components/GapBar";

function ActionCard({ a, onReview, reload }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(a.draft.subject);
  const [body, setBody] = useState(a.draft.body);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setSubject(a.draft.subject); setBody(a.draft.body); }, [a.draft.subject, a.draft.body]);

  const save = async () => {
    try { await http.put(`/actions/${a.id}`, { subject, body }); setEditing(false); toast.success("Draft saved"); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const regen = async () => {
    setBusy(true);
    try {
      const r = await http.post(`/actions/${a.id}/draft`, { regenerate: true, tone: a.draft.tone, language: a.draft.language });
      if (r.data.source !== "ai") toast("AI unavailable, using the standard template");
      reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const setLang = async (language) => {
    setBusy(true);
    try { await http.post(`/actions/${a.id}/draft`, { tone: a.draft.tone, language }); toast.success(language === "es" ? "Draft switched to Spanish. Their offer page will open in Spanish." : "Draft switched to English"); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const markPaid = async () => {
    try { await http.post(`/actions/${a.id}/mark-paid`); toast.success("Marked as paid (demo)"); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const sent = a.status !== "proposed";
  const sentBody = a.sent?.body || a.draft.body;

  return (
    <article className={`card action ${a.selected ? "" : "unselected"}`} data-testid={`action-card-${a.id}`}>
      <div className="action-head">
        <div className="rank num">#{a.rank}</div>
        <div className="action-title">
          <div className="chips">
            <Chip kind={TYPE_CLASS[a.type]} testid={`type-chip-${a.id}`}>{a.type_label}</Chip>
            <StatusChip status={a.status} testid={`status-chip-${a.id}`} />
          </div>
          <h3 className="h3">{a.counterparty}</h3>
          <div className="muted small">Invoice {a.invoice_number} · {money(a.invoice_amount)}</div>
        </div>
        <div className="action-amt">
          <div className="num big-amt">{money(a.cash_by_deadline)}</div>
          <div className="tiny muted">by Friday</div>
        </div>
      </div>
      <div className="stats">
        <div><span>Chance</span><b className="num">{Math.round(a.probability * 100)}%</b></div>
        <div><span>Expected</span><b className="num">{money(a.expected)}</b></div>
        <div><span>Cost</span><b className="num">{money(a.cost)}</b></div>
        <div><span>Friction</span><b className="num">{a.friction}</b></div>
      </div>
      <div className="draft">
        {!sent && (
          <div className="cust-lang">
            <span className="tiny muted">Customer reads</span>
            <div className="seg sm" role="group" aria-label={`Language for ${a.counterparty}`}>
              {["en", "es"].map((l) => <button key={l} className={a.draft.language === l ? "on" : ""} disabled={busy} onClick={() => setLang(l)} data-testid={`cust-lang-${l}-${a.id}`}>{l === "en" ? "English" : "Español"}</button>)}
            </div>
          </div>
        )}
        <div className="draft-meta tiny muted">
          {sent ? "Sent message (simulated)" : `Draft · ${a.draft.tone} · ${a.draft.language === "es" ? "Español" : "English"} · ${a.draft.source}`}
        </div>
        {editing ? (
          <div className="edit">
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" data-testid={`edit-subject-${a.id}`} />
            <textarea className="input" rows={9} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" data-testid={`edit-body-${a.id}`} />
            <div className="btn-row">
              <button className="btn btn-primary btn-sm" onClick={save} data-testid={`save-draft-${a.id}`}><Check size={16} /> Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={16} /> Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="draft-subject">{a.sent?.subject || a.draft.subject}</div>
            <pre className={`draft-body ${expanded ? "" : "clamp"}`} data-testid={`draft-body-${a.id}`}>{sentBody}</pre>
            <button className="link-btn" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "Show full message"}</button>
          </>
        )}
      </div>
      <div className="btn-row">
        {!sent && !editing && (
          <>
            <button className="btn btn-primary" onClick={() => onReview([a])} data-testid={`approve-btn-${a.id}`}><Send size={16} /> Approve &amp; send</button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)} data-testid={`edit-btn-${a.id}`}><Pencil size={16} /> Edit</button>
            <button className="btn btn-ghost" onClick={regen} disabled={busy} data-testid={`regen-btn-${a.id}`}><RefreshCw size={16} className={busy ? "spin" : ""} /> Regenerate</button>
          </>
        )}
        {sent && a.offer_token && (
          <a className="btn btn-ghost" href={`/o/${a.offer_token}`} target="_blank" rel="noreferrer" data-testid={`offer-link-${a.id}`}><ExternalLink size={16} /> Counterparty link</a>
        )}
        {sent && a.type !== "extension" && ["approved", "accepted", "countered"].includes(a.status) && (
          <button className="btn btn-ghost" onClick={markPaid} data-testid={`mark-paid-${a.id}`}>Mark as paid (demo)</button>
        )}
        {sent && <Link to="/threads" className="btn btn-ghost" data-testid={`thread-link-${a.id}`}>View thread</Link>}
      </div>
    </article>
  );
}

export default function Plan() {
  const { tick, bump } = useApp();
  const [p, setP] = useState(null);
  const [settings, setSettings] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    http.get("/plan").then((r) => setP(r.data)).catch((e) => toast.error(errMsg(e)));
    http.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  };
  useEffect(load, [tick]);

  const setPref = async (k, v) => {
    try { await http.put("/settings", { [k]: v }); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      if (review.length > 1) {
        const r = await http.post("/actions/approve-all", { origin_url: origin });
        toast.success(`${r.data.approved} messages approved and placed in the simulated outbox`);
      } else {
        await http.post(`/actions/${review[0].id}/approve`, { origin_url: origin });
        toast.success(`Approved. Message to ${review[0].counterparty} is in the simulated outbox`);
      }
      setReview(null);
      bump();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  if (!p) return <Loading />;
  const proposed = p.actions.filter((a) => a.status === "proposed" && a.selected);

  return (
    <div className="page" data-testid="plan-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Plan for {p.friday_label} payroll</div>
          <h1 className="h1">Cheapest actions first</h1>
          <p className="muted">Gap {money(p.gap)} · target {money(p.target)} (115%) · expected <b className="num" data-testid="expected-total">{money(p.expected_total)}</b></p>
        </div>
        <div className="head-actions">
          {settings && (
            <>
              <div className="seg" role="group" aria-label="Tone">
                {["friendly", "firm"].map((t) => (
                  <button key={t} className={settings.tone === t ? "on" : ""} onClick={() => setPref("tone", t)} data-testid={`tone-${t}`}>{t[0].toUpperCase() + t.slice(1)}</button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Language">
                {["en", "es"].map((l) => (
                  <button key={l} className={settings.language === l ? "on" : ""} onClick={() => setPref("language", l)} data-testid={`lang-${l}`}>{l.toUpperCase()}</button>
                ))}
              </div>
            </>
          )}
          {proposed.length > 0 && (
            <button className="btn btn-primary" onClick={() => setReview(proposed)} data-testid="approve-all-btn"><ShieldCheck size={18} /> Approve all ({proposed.length})</button>
          )}
        </div>
      </div>

      <div className="card slim"><GapBar gap={p.status.gap} secured={p.status.secured} pending={p.status.pending} covered={p.status.covered} /></div>

      <div className="actions-list">
        {p.actions.map((a) => <ActionCard key={a.id} a={a} onReview={setReview} reload={load} />)}
      </div>

      <div className="grid2">
        <section className="card" data-testid="why-order">
          <h2 className="h3">Why this order</h2>
          <p className="small muted">{p.rule}</p>
          <ol className="why">{p.why_order.map((w, i) => <li key={i} className="small">{w}</li>)}</ol>
          <p className="small">Running total: {money(p.expected_total)} expected vs {money(p.target)} needed, so all {p.actions.filter((a) => a.selected).length} actions are in.</p>
        </section>
        <section className="card" data-testid="alternatives">
          <h2 className="h3">Alternatives considered</h2>
          {p.alternatives.map((x) => (
            <div className="alt" key={x.id} data-testid={`alt-${x.id}`}>
              <div className="alt-top"><b>{x.label}</b><span className="num">{money(x.cash_by_deadline)} × {Math.round(x.probability * 100)}% = {money(x.expected)}</span></div>
              <div className="tiny muted">Cost {money(x.cost)} · friction {x.friction}. {x.why_not}</div>
            </div>
          ))}
        </section>
      </div>

      <Sheet open={!!review} onClose={() => setReview(null)} title={review && review.length > 1 ? `Review ${review.length} messages` : "Review before sending"} testid="review-sheet"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReview(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={busy} data-testid="confirm-approve-btn"><Send size={16} /> {busy ? "Sending…" : "Approve & send (simulated)"}</button>
          </>
        }>
        {review && review.map((a) => (
          <div className="review-item" key={a.id}>
            <div className="review-top"><Chip kind={TYPE_CLASS[a.type]}>{a.type_label}</Chip><b>{a.counterparty}</b><span className="num">{money(a.cash_by_deadline)}</span></div>
            <ul className="checks" data-testid={`checks-${a.id}`}>
              {a.checks.map((c, i) => <li key={i} className={c.ok ? "ok" : "bad"}>{c.ok ? <Check size={16} /> : <X size={16} />} {c.text}</li>)}
            </ul>
            {review.length === 1 && <pre className="draft-body">{a.draft.body}</pre>}
          </div>
        ))}
        <p className="tiny muted">Simulated outbox: nothing is actually sent. A private offer link is created for each counterparty.</p>
      </Sheet>
    </div>
  );
}
