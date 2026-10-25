import React, { useEffect } from "react";
import { X } from "lucide-react";

export const TYPE_CLASS = { collect: "chip-teal", split: "chip-amber", early_pay: "chip-green", extension: "chip-deep" };

export const STATUS_LABEL = {
  proposed: "Draft", approved: "Sent · waiting", accepted: "Accepted", countered: "Countered",
  declined: "Declined", paid: "Paid ✓", secured: "Secured ✓", open: "Open",
};

export function Chip({ children, kind = "chip-line", testid }) {
  return <span className={`chip ${kind}`} data-testid={testid}>{children}</span>;
}

export function StatusChip({ status, testid }) {
  const k = ["paid", "secured"].includes(status) ? "chip-green" : status === "declined" ? "chip-red" : status === "proposed" ? "chip-line" : "chip-amber";
  return <Chip kind={k} testid={testid}>{STATUS_LABEL[status] || status}</Chip>;
}

export function Sheet({ open, onClose, title, children, footer, testid }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose} data-testid={testid}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3 className="h3">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="sheet-close"><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Structured({ data }) {
  if (!data) return null;
  const fmt = (v) => {
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? Object.values(x).filter((y) => y !== "").join(" · ") : String(x))).join("\n");
    if (typeof v === "number") return v.toLocaleString("en-US");
    return String(v);
  };
  return (
    <div className="json-card" data-testid="structured-offer">
      <div className="json-head">structured offer · {data.type}</div>
      {Object.entries(data).filter(([k]) => k !== "type").map(([k, v]) => (
        <div className="json-row" key={k}>
          <span className="json-k">{k}</span>
          <span className="json-v num">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, children, testid }) {
  return (
    <div className="card empty" data-testid={testid}>
      <h3 className="h3">{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}

export function Loading() {
  return <div className="card loading" data-testid="loading"><div className="skel" /><div className="skel short" /></div>;
}
