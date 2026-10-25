import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { toast } from "sonner";
import { Loader2, MailCheck, User, Building2, AlertCircle } from "lucide-react";
import { MotionButton } from "@/components/MotionButton";
import { http, errMsg } from "@/lib/api";

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | accepting | error
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setState("loading");
    http.get(`/invite/${token}`).then((r) => { setInfo(r.data); setState("ready"); })
      .catch((e) => { setErr(errMsg(e)); setState("error"); });
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const accept = async () => {
    setState("accepting");
    try {
      await http.post(`/invite/${token}/accept`, {});
      toast.success("You're linked — welcome!");
      navigate("/app", { replace: true });
    } catch (e) { setErr(errMsg(e)); setState("error"); }
  };

  const Icon = info?.kind === "supplier" ? Building2 : User;
  return (
    <div className="portal-shell" data-testid="invite-page">
      <header className="portal-top">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Gapless</div>
        <UserButton afterSignOutUrl="/" />
      </header>
      <div className="page narrow">
        <div className="page-head"><div>
          <div className="eyebrow">Invitation</div>
          <h1 className="h1">Join your portal</h1>
          <p className="muted">Bay Remodel Co. invited you to Gapless.</p>
        </div></div>

        {state === "loading" && <div className="card"><p className="muted"><Loader2 className="spin" size={16} /> Checking your invite…</p></div>}
        {state === "error" && (
          <div className="card" data-testid="invite-error">
            <p className="muted"><AlertCircle size={16} /> {err}</p>
            <MotionButton className="btn btn-ghost btn-sm" onClick={load} data-testid="invite-retry">Try again</MotionButton>
          </div>
        )}
        {info && state !== "error" && (
          <section className="card" data-testid="invite-card">
            <div className="approval-head">
              <span className="wt-badge wt-badge-payroll"><Icon size={13} /> {info.kind === "supplier" ? "Supplier" : "Client"}</span>
              {info.status === "accepted" && <span className="chip chip-green">Already accepted</span>}
            </div>
            <div className="approval-title" data-testid="invite-name">{info.linked_name}</div>
            <p className="tiny muted">Accept to see what Bay Remodel Co. needs from you and respond right here.</p>
            <MotionButton className="btn btn-primary btn-lg" disabled={state === "accepting"} onClick={accept} data-testid="invite-accept-btn">
              {state === "accepting" ? <Loader2 className="spin" size={18} /> : <MailCheck size={18} />} Accept invitation
            </MotionButton>
          </section>
        )}
      </div>
    </div>
  );
}
