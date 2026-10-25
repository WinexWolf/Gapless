import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { http, ftime, errMsg, useApp } from "@/lib/api";
import { Chip, Empty, Loading } from "@/components/Common";

export default function Outbox() {
  const { tick } = useApp();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState({});
  useEffect(() => { http.get("/outbox").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [tick]);
  if (!d) return <Loading />;
  return (
    <div className="page narrow" data-testid="outbox-page">
      <div className="page-head"><div><div className="eyebrow">Outbox</div><h1 className="h1">Simulated outbox</h1></div></div>
      <div className="notice strong" data-testid="outbox-label">Simulated outbox: nothing is actually sent.</div>
      {d.items.length === 0 && <Empty title="No messages yet">Approved messages appear here.</Empty>}
      {d.items.map((m) => (
        <article className="card outbox-item" key={m.id} data-testid="outbox-item">
          <div className="chips"><Chip kind="chip-line">{m.scope === "buy" ? "Buying" : "Payroll"}</Chip><Chip kind="chip-amber">Simulated</Chip>{m.language === "es" && <Chip kind="chip-teal" testid="outbox-lang-es">Español</Chip>}<span className="tiny muted">{ftime(m.ts)}</span></div>
          <div className="small"><b>To:</b> {m.counterparty} &lt;{m.to}&gt;</div>
          <div className="draft-subject">{m.subject}</div>
          <pre className={`draft-body ${open[m.id] ? "" : "clamp"}`}>{m.body}</pre>
          <div className="btn-row">
            <button className="link-btn" onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>{open[m.id] ? "Show less" : "Show full message"}</button>
            {m.link && <a className="btn btn-ghost btn-sm" href={m.link.replace(/^https?:\/\/[^/]+/, "")} target="_blank" rel="noreferrer" data-testid="outbox-offer-link"><ExternalLink size={14} /> {m.language === "es" ? "Open Spanish offer page" : "Open counterparty link"}</a>}
          </div>
        </article>
      ))}
    </div>
  );
}
