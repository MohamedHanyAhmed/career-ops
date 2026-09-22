"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Radar, Wrench, ExternalLink, Search } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";

type Company = { name: string; status: string; detail: string; kind?: "company" | "source"; failureKind?: string; repairable?: boolean };
type Result = { available: boolean; configured: boolean; companies: Company[]; diagnosis?: { systemic: boolean; grouped: Record<string, number> } };

const TONE: Record<string, { dot: string; label: string; chip: string }> = {
  live: { dot: "bg-emerald-500", label: "live", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  empty: { dot: "bg-amber-500", label: "live · empty", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  broken: { dot: "bg-red-500", label: "broken", chip: "bg-red-500/15 text-red-700 dark:text-red-400" },
  blocked: { dot: "bg-violet-500", label: "access blocked", chip: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  unavailable: { dot: "bg-orange-500", label: "temporarily unavailable", chip: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  skipped: { dot: "bg-zinc-400", label: "no ATS", chip: "bg-surface-hover text-muted" },
};
const ORDER: Record<string, number> = { broken: 0, blocked: 1, unavailable: 2, empty: 3, live: 4, skipped: 5 };

export function PortalsView({ inventory }: { inventory: { companies: { name: string; url: string }[]; boards: { name: string; url: string }[]; searches: { name: string; query: string }[] } }) {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const { jobs, startJob } = useJobs();

  // map the agentic "fix-portal" workers to the company they're repairing
  const fixByCompany = useMemo(() => {
    const m = new Map<string, (typeof jobs)[number]>();
    for (const j of jobs) {
      if (j.kind !== "fix-portal" || !j.input) continue;
      const ex = m.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) m.set(j.input, j);
    }
    return m;
  }, [jobs]);

  function check() {
    setLoading(true);
    fetch("/api/portals/verify")
      .then((r) => r.json())
      .then(setRes)
      .catch(() => setRes({ available: false, configured: false, companies: [], diagnosis: { systemic: false, grouped: {} } }))
      .finally(() => setLoading(false));
  }

  const companies = res?.companies ?? [];
  const broken = companies.filter((c) => c.status === "broken");
  const blocked = companies.filter((c) => c.status === "blocked");
  const unavailable = companies.filter((c) => c.status === "unavailable");
  const liveN = companies.filter((c) => c.status === "live" || c.status === "empty").length;
  const sorted = [...companies].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Automated job boards</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{inventory.boards.length}</p>
          <p className="text-xs text-faint">public sources fetched automatically</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Direct ATS scanning</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{inventory.companies.length}</p>
          <p className="text-xs text-faint">company boards fetched automatically</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Regional search coverage</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{inventory.searches.length}</p>
          <p className="text-xs text-faint">search recipes; results still require verification</p>
        </div>
      </div>

      <details open className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface/30">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Configured channels and boards</summary>
        <div className="grid gap-5 border-t border-border p-4 md:grid-cols-3">
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Radar className="size-3.5" /> Automated boards</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {inventory.boards.map((b) => <li key={b.name} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{b.name}</span>{b.url && <a href={b.url} target="_blank" rel="noreferrer" aria-label={`Open ${b.name}`} className="text-faint hover:text-brand"><ExternalLink className="size-3.5" /></a>}</li>)}
              {inventory.boards.length === 0 && <li className="text-muted">No automated boards configured.</li>}
            </ul>
          </section>
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Radar className="size-3.5" /> Direct boards</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {inventory.companies.map((c) => <li key={c.name} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{c.name}</span>{c.url && <a href={c.url} target="_blank" rel="noreferrer" aria-label={`Open ${c.name} careers`} className="text-faint hover:text-brand"><ExternalLink className="size-3.5" /></a>}</li>)}
              {inventory.companies.length === 0 && <li className="text-muted">No direct boards configured.</li>}
            </ul>
          </section>
          <section>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><Search className="size-3.5" /> Search channels</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {inventory.searches.map((q) => <li key={q.name} title={q.query} className="rounded-lg bg-surface/50 px-2.5 py-2">{q.name}</li>)}
              {inventory.searches.length === 0 && <li className="text-muted">No search channels configured.</li>}
            </ul>
            <p className="mt-2 text-xs text-faint">Search recipes are fallbacks. LinkedIn and WUZZUF are also covered by the automated board providers shown separately.</p>
          </section>
        </div>
      </details>
      <div className="flex items-center gap-3">
        <button
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          Check source health
        </button>
        {loading && <span className="text-xs text-faint">Probing company boards and direct job sources… (~30–60s)</span>}
      </div>

      {res && !res.available && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
          <code className="text-foreground">verify-portals.mjs</code> not found — this needs a complete career-ops
          checkout (the web orchestrates the core&apos;s validator).
        </p>
      )}
      {res && res.available && !res.configured && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
          No <code className="text-foreground">portals.yml</code> yet — ask the assistant to set up the companies to scan.
        </p>
      )}

      {res && res.configured && (
        <div className="mt-5">
          <p className="text-sm text-muted">
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{liveN}</span> live ·{" "}
            <span className="tabular-nums text-red-600 dark:text-red-400">{broken.length}</span> broken ·{" "}
            <span className="tabular-nums text-violet-600 dark:text-violet-400">{blocked.length}</span> blocked ·{" "}
            <span className="tabular-nums text-orange-600 dark:text-orange-400">{unavailable.length}</span> unavailable ·{" "}
            <span className="tabular-nums">{companies.length}</span> tracked
          </p>
          {broken.length + blocked.length + unavailable.length > 0 && (
            <div className={cn("mt-3 rounded-xl border px-4 py-3 text-sm", res.diagnosis?.systemic ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/30 bg-red-500/10")}>
              <span className="font-medium text-red-700 dark:text-red-400">
                {res.diagnosis?.systemic ? "Shared health-check failure detected" : `${broken.length + blocked.length + unavailable.length} ${(broken.length + blocked.length + unavailable.length) === 1 ? "source needs" : "sources need"} attention`}
              </span>{" "}
              <span className="text-muted">
                {res.diagnosis?.systemic
                  ? "Most failures have the same cause. Check connectivity or the shared runtime before repairing individual company links."
                  : "Only confirmed missing ATS slugs can be repaired automatically; blocks, outages, and parser failures need a source-level fix."}
              </span>
            </div>
          )}
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/40">
            {sorted.map((c) => {
              const t = TONE[c.status] ?? TONE.skipped;
              return (
                <li key={c.name} className="flex items-center gap-3 px-4 py-2.5">
                  <CompanyLogo name={c.name} size={20} />
                  <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />
                  <span className="shrink-0 text-sm font-medium">{c.name}</span>
                  {c.kind === "source" && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">job source</span>}
                  <span className="truncate font-mono text-xs text-faint">{c.detail}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {c.status === "broken" && c.repairable && !res.diagnosis?.systemic && <FixAffordance company={c.name} job={fixByCompany.get(c.name)} onFix={() => startJob({ title: `Fix · ${c.name}`, subtitle: "repair portal slug", kind: "fix-portal", input: c.name, page: "/portals" })} />}
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", t.chip)}>{t.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FixAffordance({ company, job, onFix }: { company: string; job?: Job; onFix: () => void }) {
  if (job?.status === "running")
    return (
      <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
        <Loader2 className="size-3 animate-spin" /> Fixing…
      </Link>
    );
  if (job?.status === "done")
    return (
      <Link href={`/jobs/${job.id}`} className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        repaired · re-check
      </Link>
    );
  return (
    <button
      onClick={onFix}
      title={`Have the agent repair ${company}'s portal slug`}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-brand/40 hover:text-brand"
    >
      <Wrench className="size-3" /> Fix
    </button>
  );
}
