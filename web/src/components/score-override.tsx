"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

export function ScoreOverride({ n }: { n: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function approve() {
    if (reason.trim().length < 10) { setError("Add a concrete reason (at least 10 characters)."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, event: "override-approved", note: reason }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Override could not be recorded");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Override could not be recorded"); setBusy(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-400"><AlertTriangle className="size-3.5" /> Override 4.0 threshold</button>;
  return <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-xs font-medium text-amber-800 dark:text-amber-300">This role is below the apply threshold. Record why new evidence justifies proceeding.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for override…" className="min-h-[40px] flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-amber-500/50" /><button type="button" disabled={busy} onClick={approve} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 text-xs font-medium text-white disabled:opacity-50">{busy && <Loader2 className="size-3.5 animate-spin" />} Confirm override</button></div>{error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}</div>;
}
