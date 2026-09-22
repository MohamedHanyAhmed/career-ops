"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Loader2 } from "lucide-react";

const OUTCOMES = [
  ["interview_progress", "Interview progressing"],
  ["interview_only", "Interview ended"],
  ["offer_received", "Offer received"],
  ["hired", "Accepted / hired"],
  ["offer_declined", "Offer declined"],
  ["rejected", "Rejected"],
  ["no_response", "No response"],
] as const;

export function OutcomeRecorder({ n }: { n: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("interview_progress");
  const [stage, setStage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted hover:border-brand/40 hover:text-brand"><MessageSquareText className="size-3.5" /> Record outcome</button>;
  async function save() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/outcomes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, type, stage, feedback }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Outcome could not be recorded");
      setOpen(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Outcome could not be recorded"); }
    finally { setBusy(false); }
  }
  return <div className="w-full rounded-xl border border-brand/25 bg-brand-soft/40 p-3">
    <p className="text-sm font-medium">What happened?</p>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <select value={type} onChange={(e) => setType(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-surface px-3 text-sm">{OUTCOMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Stage, e.g. final interview" className="min-h-[40px] rounded-md border border-border bg-surface px-3 text-sm" />
    </div>
    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Paste recruiter feedback or record what you learned. Leave blank if none was given." className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
    <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={save} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground disabled:opacity-50">{busy && <Loader2 className="size-3.5 animate-spin" />} Save outcome</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-[38px] rounded-md border border-border px-3 text-xs text-muted">Cancel</button></div>
    {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
