import React, { useEffect, useState } from "react";
import { UserButton } from "@clerk/react";
import { toast } from "sonner";
import { Building2, User, CheckCircle2 } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, errMsg } from "@/lib/api";

export default function Claim({ me, onClaimed }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    http.get("/auth/claimable").then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const claim = async (kind, id) => {
    setBusy(id);
    try {
      const r = await http.post("/auth/claim", { kind, id });
      toast.success(`You're linked as ${r.data.linked_name}`);
      onClaimed && onClaimed();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="portal-shell" data-testid="claim-page">
      <header className="portal-top">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless</div>
        <UserButton afterSignOutUrl="/" />
      </header>
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">Welcome{me?.name ? `, ${me.name.split(" ")[0]}` : ""}</div>
          <h1 className="h1">Who are you here as?</h1>
          <p className="muted">Pick the account you represent so the right messages reach you.</p>
        </div></div>

        {!data && <div className="card"><p className="muted">Loading accounts…</p></div>}

        {data && (
          <>
            <section className="card">
              <h2 className="h3"><User size={16} /> I'm a customer / client</h2>
              <p className="tiny muted">You receive invoices from Bay Remodel Co.</p>
              <div className="claim-grid">
                {data.clients.map((c) => (
                  <MotionButton key={c.id} className={`claim-opt ${c.taken ? "taken" : ""}`} disabled={c.taken || busy}
                    onClick={() => claim("client", c.id)} data-testid={`claim-client-${c.id}`}>
                    <span>{c.name}</span>
                    {c.taken ? <span className="tiny muted">Linked</span> : <CheckCircle2 size={16} className="claim-pick" />}
                  </MotionButton>
                ))}
              </div>
            </section>
            <section className="card">
              <h2 className="h3"><Building2 size={16} /> I'm a supplier</h2>
              <p className="tiny muted">You quote and supply materials to Bay Remodel Co.</p>
              <div className="claim-grid">
                {data.suppliers.map((s) => (
                  <MotionButton key={s.id} className={`claim-opt ${s.taken ? "taken" : ""}`} disabled={s.taken || busy}
                    onClick={() => claim("supplier", s.id)} data-testid={`claim-supplier-${s.id}`}>
                    <span>{s.name}</span>
                    {s.taken ? <span className="tiny muted">Linked</span> : <CheckCircle2 size={16} className="claim-pick" />}
                  </MotionButton>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
