import React, { useEffect, useState } from "react";
import { Users, ShieldCheck, User, Building2 } from "lucide-react";
import { http, errMsg } from "@/lib/api";

const ROLE = {
  owner_admin: { label: "Owner", Icon: ShieldCheck, cls: "chip-green" },
  client: { label: "Client", Icon: User, cls: "chip-teal" },
  supplier: { label: "Supplier", Icon: Building2, cls: "chip-line" },
  pending: { label: "Not linked yet", Icon: Users, cls: "chip-amber" },
};

export default function People() {
  const [people, setPeople] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { http.get("/auth/people").then((r) => setPeople(r.data.people || [])).catch((e) => setErr(errMsg(e))); }, []);
  return (
    <div className="page narrow" data-testid="people-page">
      <div className="page-head"><div><div className="eyebrow">Accounts</div><h1 className="h1">People</h1><p className="muted">Everyone who has signed in and which client or supplier they represent.</p></div></div>
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
