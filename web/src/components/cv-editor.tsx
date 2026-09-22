"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Loader2, History, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export function CvEditor() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revisions, setRevisions] = useState<{ name: string; createdAt: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setExists(d.exists ?? false);
        setRevisions(Array.isArray(d.revisions) ? d.revisions : []);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDirty(false);
        setExists(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        const refreshed = await fetch("/api/cv").then((r) => r.json());
        setRevisions(Array.isArray(refreshed.revisions) ? refreshed.revisions : []);
      } else setError((await res.json().catch(() => ({}))).error || "Could not save CV");
    } catch { setError("Could not save CV");
    } finally {
      setSaving(false);
    }
  }

  async function restore(name: string) {
    if (!window.confirm("Restore this CV revision? The current CV will be backed up first.")) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/cv", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: name }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not restore revision");
      setContent(body.content ?? ""); setDirty(false); setSaved(true);
      const refreshed = await fetch("/api/cv").then((r) => r.json());
      setRevisions(Array.isArray(refreshed.revisions) ? refreshed.revisions : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restore revision"); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-landing">CV editor</h1>
          <p className="mt-1 text-sm text-muted">
            Edit <code className="text-foreground">cv.md</code> with live preview.
            {!exists && loaded && <span className="ml-1 text-faint">No cv.md yet — start typing to create it.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors max-sm:min-h-[44px]",
            dirty
              ? "bg-brand text-brand-foreground hover:bg-brand-200"
              : "border border-border bg-surface text-muted",
          )}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {!loaded ? (
        <div className="mt-6 text-sm text-muted">Loading…</div>
      ) : (
        <>
        {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertCircle className="size-4" />{error}</p>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            spellCheck={false}
            placeholder="# Your Name&#10;&#10;## Summary&#10;..."
            className="min-h-[60vh] w-full resize-none rounded-2xl border border-border bg-surface/50 p-4 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-brand/40"
          />
          <article className="report-prose min-h-[60vh] overflow-auto rounded-2xl border border-border bg-surface/30 p-5">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-muted">Preview appears here.</p>
            )}
          </article>
        </div>
        <details className="mt-4 rounded-2xl border border-border bg-surface/30">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium"><History className="size-4" /> Revision history <span className="text-faint">({revisions.length})</span></summary>
          <div className="border-t border-border p-3">
            {revisions.length === 0 ? <p className="text-sm text-muted">A revision appears after your first overwrite.</p> : <ul className="space-y-2">{revisions.map((r) => <li key={r.name} className="flex items-center justify-between gap-3 rounded-lg bg-surface/50 px-3 py-2"><span className="truncate font-mono text-xs text-muted">{r.createdAt}</span><button type="button" disabled={saving} onClick={() => restore(r.name)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:border-brand/40 hover:text-brand"><RotateCcw className="size-3.5" /> Restore</button></li>)}</ul>}
          </div>
        </details>
        </>
      )}
    </div>
  );
}
