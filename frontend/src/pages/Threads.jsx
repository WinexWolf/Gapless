import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, Bot, User } from "lucide-react";
import { http, money, fdate, ftime, errMsg, useApp } from "@/lib/api";
import { Chip, StatusChip, Structured, TYPE_CLASS, Empty, Loading } from "@/components/Common";

const KIND = { reminder: "Reminder", offer: "Offer", counter: "Counter", accepted: "Accepted", declined: "Declined", paid: "Paid", guardrail: "Rule check", approved: "Approved", reply: "Reply" };

export default function Threads() {
  const { tick, bump } = useApp();
  const [d, setD] = useState(null);
  const [rem, setRem] = useState([]);
  useEffect(() => {
    http.get("/threads").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
    http.get("/reminders").then((r) => setRem(r.data.items)).catch(() => {});
  }, [tick]);
  const remAct = async (r, path, msg) => {
    try { await http.post(`/reminders/${r.id}/${path}`); toast.success(msg); bump(); } catch (e) { toast.error(errMsg(e)); }
  };

  const decide = async (t, accept) => {
    try { await http.post(`/actions/${t.action_id}/counter-decision`, { accept }); toast.success(accept ? "Counter approved" : "Counter declined"); bump(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const markPaid = async (t) => {
    try { await http.post(`/actions/${t.action_id}/mark-paid`); toast.success("Marked as paid (demo)"); bump(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  if (!d) return <Loading />;
  return (
    <div className="page" data-testid="threads-page">
      <div className="page-head"><div><div className="eyebrow">Conversations</div><h1 className="h1">Threads</h1><p className="muted">Offer → counter → accepted or declined → paid. Press Next in Demo controls to simulate a reply.</p></div></div>
      {d.threads.length === 0 && <Empty title="No threads yet" testid="threads-empty">Approve an action on the <Link to="/plan">Plan</Link> to start a conversation.</Empty>}
      {d.threads.map((t) => (
        <section className="card thread" key={t.id} data-testid={`thread-${t.action_id}`}>
          <div className="thread-head">
            <div>
              <div className="chips">
                <Chip kind={TYPE_CLASS[t.type]}>{t.type_label}</Chip>
                <Chip kind={t.badge.includes("Agent <-> Agent") ? "chip-deep" : "chip-line"} testid={`badge-${t.action_id}`}>
                  {t.badge.includes("Agent <-> Agent") ? <Bot size={13} /> : <User size={13} />} {t.badge.replace("<->", "↔")}
                </Chip>
                <StatusChip status={t.status} testid={`thread-status-${t.action_id}`} />
              </div>
              <h3 className="h3">{t.counterparty}</h3>
            </div>
            <div className="num big-amt">{money(t.cash)}</div>
          </div>
          <ol className="timeline">
            {t.messages.map((m) => (
              <li key={m.id} className={`tl tl-${m.side}`}>
                <div className="tl-meta"><b>{m.actor}</b><Chip kind={m.kind === "guardrail" ? "chip-amber" : m.kind === "paid" || m.kind === "accepted" ? "chip-green" : m.kind === "declined" ? "chip-red" : "chip-line"}>{KIND[m.kind] || m.kind}</Chip><span className="tiny muted">{ftime(m.ts)}</span></div>
                <pre className="tl-text">{m.text}</pre>
                <Structured data={m.structured} />
              </li>
            ))}
          </ol>
          {rem.filter((r) => r.action_id === t.action_id).map((r) => (
            <div className="reminder" key={r.id} data-testid={`reminder-${t.action_id}`}>
              <div className="chips"><Chip kind="chip-teal">Scheduled reminder</Chip><Chip kind={r.status === "sent" ? "chip-green" : r.status === "approved" ? "chip-amber" : "chip-line"} testid="reminder-status">{r.status === "draft" ? "Needs your approval" : r.status === "approved" ? `Approved · goes out ${fdate(r.send_on)}` : r.status === "cancelled" ? "Not needed: paid early" : "Sent (simulated)"}</Chip></div>
              <div className="small"><b>{money(r.amount)}</b> second payment due {fdate(r.due_date)} · reminder on {fdate(r.send_on)}</div>
              <div className="draft-subject">{r.subject}</div>
              <pre className="draft-body small">{r.body}</pre>
              <div className="btn-row">
                {r.status === "draft" && <button className="btn btn-primary btn-sm" onClick={() => remAct(r, "approve", "Reminder approved")} data-testid="approve-reminder-btn">Approve reminder</button>}
                {r.status === "approved" && <button className="btn btn-ghost btn-sm" onClick={() => remAct(r, "send", "Reminder placed in the simulated outbox")} data-testid="send-reminder-btn">Send now (demo)</button>}
              </div>
            </div>
          ))}
          <div className="btn-row">
            {t.status === "countered" && t.pending_counter && (
              <>
                <button className="btn btn-primary" onClick={() => decide(t, true)} data-testid={`accept-counter-${t.action_id}`}>Approve counter</button>
                <button className="btn btn-ghost" onClick={() => decide(t, false)} data-testid={`decline-counter-${t.action_id}`}>Decline counter</button>
              </>
            )}
            {t.type !== "extension" && ["approved", "accepted", "countered"].includes(t.status) && (
              <button className="btn btn-ghost" onClick={() => markPaid(t)} data-testid={`thread-mark-paid-${t.action_id}`}>Mark as paid (demo)</button>
            )}
            {t.type === "split" && t.status === "paid" && !t.second_paid && (
              <button className="btn btn-ghost" onClick={async () => { try { await http.post(`/actions/${t.action_id}/mark-second-paid`); toast.success("Second payment received"); bump(); } catch (e) { toast.error(errMsg(e)); } }} data-testid={`mark-second-paid-${t.action_id}`}>Mark 2nd payment received (demo)</button>
            )}
            {t.type === "split" && t.second_paid && <Chip kind="chip-green" testid="second-paid-chip">Both payments received ✓</Chip>}
            {t.token && <a className="btn btn-ghost" href={`/o/${t.token}`} target="_blank" rel="noreferrer" data-testid={`thread-offer-link-${t.action_id}`}><ExternalLink size={16} /> Counterparty page</a>}
          </div>
        </section>
      ))}
    </div>
  );
}
