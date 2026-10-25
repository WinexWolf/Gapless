import React, { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { GlassDialog } from "@/components/GlassDialog";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MotionButton } from "@/components/MotionButton";
import { Skeleton } from "@/components/ui/skeleton";

export const PaydayImage = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true, objectUrl;
    setFile(null); setUrl(""); setError("");
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    http.get("/summary/image.png", { params: { theme }, responseType: "blob" }).then(({ data }) => {
      if (!alive) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
      setFile(new File([data], "gapless-payroll-covered.png", { type: "image/png" }));
    }).catch(async e => {
      let msg = errMsg(e);
      if (e.response?.data instanceof Blob) { try { msg = JSON.parse(await e.response.data.text()).detail; } catch (_) {} }
      if (alive) setError(msg);
    });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, retry]);
  const share = async () => {
    try { await navigator.share({ files: [file], title: "Payroll covered · Gapless" }); }
    catch (e) { if (e.name !== "AbortError") toast.error("Couldn't open sharing. Download the PNG and attach it to your message instead."); }
  };
  const canShare = file && navigator.canShare?.({ files: [file] });
  return <>
    <MotionButton className="btn btn-primary" onClick={() => setOpen(true)} data-testid="payroll-covered-share-button"><Download size={17} /> Payday image</MotionButton>
    <GlassDialog open={open} onOpenChange={setOpen} testId="payday-image-dialog">
      <div className="glass-sheet-head"><div className="sec-head"><span className="eyebrow">A little peace of mind</span><MotionButton className="icon-btn" onClick={() => setOpen(false)} aria-label="Close share image" data-testid="payday-image-close"><X /></MotionButton></div>
        <DialogTitle className="h2" data-testid="payday-image-title">Friday looks good.</DialogTitle><DialogDescription className="muted" data-testid="payday-image-description">Save a snapshot, or send it to your crew. Customer names and invoice details stay out of the image.</DialogDescription>
      </div>
      <div className="glass-sheet-body image-preview-body">
        {url ? <img className="payday-image-preview" src={url} alt="Payroll covered summary with projected payroll, cash to spare and cost to close the gap. Demo data." data-testid="payroll-covered-share-preview" /> : error ? <div role="alert" className="inline-error" data-testid="payday-image-error">{error}<MotionButton className="btn btn-ghost" onClick={() => setRetry(x=>x+1)} data-testid="payday-image-retry">Try again</MotionButton></div> : <Skeleton className="image-skeleton" data-testid="payday-image-loading" />}
      </div>
      <div className="glass-sheet-foot">
        {url && <MotionButton asChild className="btn btn-primary" data-testid="payroll-covered-download-png-button"><a href={url} download="gapless-payroll-covered.png"><Download size={17} />Download PNG</a></MotionButton>}
        {canShare && <MotionButton className="btn btn-ghost" onClick={share} data-testid="payroll-covered-native-share-button"><Share2 size={17} />Share image</MotionButton>}
        <p className="tiny muted" data-testid="payday-image-note">1080 × 1350 PNG · Demo forecast, not a payment receipt</p>
      </div>
    </GlassDialog>
  </>;
};
