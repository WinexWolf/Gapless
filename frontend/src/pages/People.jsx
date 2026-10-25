import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, ShieldCheck, User, Building2, UserPlus, Link2, Copy, Check, Mail } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, errMsg, ftime } from "@/lib/api";

const ROLE = {
  owner_admin: { label: "Owner", Icon: ShieldCheck, cls: "chip-green" },
  client: { label: "Client", Icon: User, cls: "chip-teal" },
  supplier: { label: "Supplier", Icon: Building2, cls: "chip-line" },
  pending: { label: "Not linked yet", Icon: Users, cls: "chip-amber" },
};

function InviteSection() {
  const [claimable, setClaimable] = useState(null);
  const [invites, setInvites] = useState([]);
  const [kind, setKind] = useState("client");
  const [cid, setCid] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadInvites = useCallback(() => { http.get("/invites").then((r) => setInvites(r.data.invites || [])).catch(() => {}); }, []);
  useEffect(() => {
    http.get("/auth/claimable").then((r) => setClaimable(r.data)).catch((e) => toast.error(errMsg(e)));
    loadInvites();
  }, [loadInvites]);

  const pool = (claimable?.[kind === "client" ? "clients" : "suppliers"]) || [];

  const create = async () => {
    if (!cid) { toast.error("Pick who you're inviting first"); return; }
    setBusy(true); setResult(null); setCopied(false);
    try {
      const r = await http.post("/invites", { kind, id: cid, email: email.trim() || null, origin_url: window.location.origin });
      setResult(r.data);
      toast.success(r.data.emailed ? `Invite emailed to ${email.trim()}` : "Invite link ready to share");
      setEmail("");
      loadInvites();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error("Couldn't copy — select and copy the link manually"); }
  };

  return (
    <section className="card" data-testid="invite-section">
      <h2 className="h3"><UserPlus size={16} /> Invite someone</h2>
      <p className="tiny muted">Send a real client or supplier straight into their portal. Email the link or copy it to share yourself.</p>
      <div className="set-row"><b>Role</b>
        <div className="seg" role="group" aria-label="Invite role">
          <button className={kind === "client" ? "on" : ""} onClick={() => { setKind("client"); setCid(""); }} data-testid="invite-kind-client">Client</button>
          <button className={kind === "supplier" ? "on" : ""} onClick={() => { setKind("supplier"); setCid(""); }} data-testid="invite-kind-supplier">Supplier</button>
        </div>
      </div>
      <label className="field"><span>Who are you inviting?</span>
        <select className="input" value={cid} onChange={(e) => setCid(e.target.value)} data-testid="invite-counterparty">
          <option value="">Select a {kind}…</option>
          {pool.map((c) => <option key={c.id} value={c.id}>{c.name}{c.taken ? " (already linked)" : ""}</option>)}
        </select>
      </label>
      <label className="field"><span>Their email (optional — we'll send the link)</span>
        <input className="input" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" />
      </label>
      <MotionButton className="btn btn-primary" disabled={busy || !cid} onClick={create} data-testid="invite-create-btn"><Link2 size={16} /> Create invite link</MotionButton>

      {result && (
        <div className="invite-result-box" data-testid="invite-result" style={{ marginTop: 12 }}>
          <div className="tiny muted">Invite link for {result.linked_name} {result.emailed && <span className="chip chip-green"><Mail size={11} /> Emailed</span>}</div>
          <div className="invite-link-row">
            <code className="invite-link" data-testid="invite-link">{result.url}</code>
            <MotionButton className="btn btn-ghost btn-sm" onClick={copy} data-testid="invite-copy-btn">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</MotionButton>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="tiny muted" style={{ marginBottom: 6 }}>Recent invites</div>
          <div className="portal-list">
            {invites.slice(0, 6).map((iv) => (
              <div className="portal-row" key={iv.token} data-testid={`invite-row-${iv.token}`}>
                <div><b>{iv.linked_name}</b><div className="tiny muted">{iv.kind} · {ftime(iv.created_at)}</div></div>
                <span className={`chip ${iv.status === "accepted" ? "chip-green" : "chip-amber"}`}>{iv.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function People() {
  const [people, setPeople] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { http.get("/auth/people").then((r) => setPeople(r.data.people || [])).catch((e) => setErr(errMsg(e))); }, []);
  return (
    <div className="page narrow" data-testid="people-page">
      <div className="page-head"><div><div className="eyebrow">Accounts</div><h1 className="h1">People</h1><p className="muted">Everyone who has signed in and which client or supplier they represent.</p></div></div>

      <InviteSection />

      {err && <div className="card"><p className="muted">{err}</p></div>}
      {!people && !err && <div className="card"><p className="muted">Loading…</p></div>}
      {people && people.length === 0 && <div className="card"><p className="muted" data-testid="people-empty">No one else has signed in yet.</p></div>}
      <div className="portal-list">
        {(people || []).map((p) => {
          const meta = ROLE[p.role] || ROLE.pending;
          const Icon = meta.Icon;
          return (
            <div className="card people-row" key={p.user_id} data-testid={`people-${p.user_id}`}>
              <div><b>{p.name || p.email}</b><div className="tiny muted">{p.email}</div></div>
              <div className="people-right">
                {p.linked_name && <span className="tiny muted">{p.linked_name}</span>}
                <span className={`chip ${meta.cls}`}><Icon size={12} /> {meta.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
