import Link from "next/link";
import { pipelineSummary } from "@/lib/career-ops";
import { canonStatus, scoreNum } from "@/lib/format";
import { cumulativeTiles } from "@/lib/funnel-tiles.mjs";
import { decisionBand } from "@/lib/decision-state.mjs";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string }[] = [
  { key: "EVALUATED", label: "Evaluated" },
  { key: "APPLIED", label: "Applied" },
  { key: "RESPONDED", label: "Responded" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "OFFER", label: "Offer" },
  { key: "HIRED", label: "Hired" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISCARDED", label: "Discarded" },
];

export default function Analytics() {
  const { applications } = pipelineSummary();
  const total = applications.length;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    n: applications.filter((a) => canonStatus(a.status).includes(s.key)).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  const scores = applications.map((a) => scoreNum(a.score)).filter((n) => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [
    { label: "4.5 – 5.0", test: (n: number) => n >= 4.5 },
    { label: "4.0 – 4.4", test: (n: number) => n >= 4 && n < 4.5 },
    { label: "3.0 – 3.9", test: (n: number) => n >= 3 && n < 4 },
    { label: "< 3.0", test: (n: number) => n < 3 },
  ].map((b) => ({ label: b.label, n: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.n));

  const companyCounts = new Map<string, number>();
  for (const a of applications) if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const topCompanies = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxCompany = Math.max(1, ...topCompanies.map((c) => c[1]));

  // CUMULATIVE, unlike the stage bars above: these two tiles are achievement
  // counters whose zero-state shows a coaching nudge, so a candidate who has
  // already advanced past a stage must not read 0 for it (an offer-holder was
  // told "Interviews follow replies — keep follow-ups warm"). Mirrors
  // everInterview/everOffer in stats.mjs's computeFunnel().
  const { interviews, offers } = cumulativeTiles(applications.map((a) => canonStatus(a.status)));
  const recommended = applications.filter((a) => decisionBand(a.score, scoreNum).key === "recommended").length;
  const holds = applications.filter((a) => decisionBand(a.score, scoreNum).key === "hold").length;
  const rejectedByFit = applications.filter((a) => decisionBand(a.score, scoreNum).key === "reject").length;
  const hasReached = (status: string, stage: string) => {
    const order = ["EVALUATED", "APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "HIRED"];
    const current = order.findIndex((s) => canonStatus(status).includes(s));
    return current >= order.indexOf(stage);
  };
  const appliedRows = applications.filter((a) => hasReached(a.status, "APPLIED"));
  const applied = appliedRows.length;
  const recommendedApplied = appliedRows.filter((a) => decisionBand(a.score, scoreNum).key === "recommended").length;
  const responded = applications.filter((a) => hasReached(a.status, "RESPONDED")).length;
  const rate = (n: number, d: number) => d ? `${Math.round((n / d) * 100)}%` : "—";
  const channels = new Map<string, { evaluated: number; recommended: number; applied: number; responses: number }>();
  for (const a of applications) {
    const name = a.via && a.via !== "—" ? a.via : "Unknown";
    const row = channels.get(name) ?? { evaluated: 0, recommended: 0, applied: 0, responses: 0 };
    row.evaluated++;
    if (decisionBand(a.score, scoreNum).key === "recommended") row.recommended++;
    if (hasReached(a.status, "APPLIED")) row.applied++;
    if (hasReached(a.status, "RESPONDED")) row.responses++;
    channels.set(name, row);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Analytics</h1>
      <p className="mt-1 text-sm text-muted">Across {total} tracked evaluation{total === 1 ? "" : "s"}.</p>

      {/* headline stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={total} label="evaluated" />
        <Stat value={avg ? avg.toFixed(2) : "—"} label="avg score" />
        <Stat
          value={interviews}
          label="interviews"
          hint={interviews === 0 ? "Interviews follow replies — keep follow-ups warm →" : undefined}
        />
        <Stat
          value={offers}
          label="offers"
          hint={offers === 0 ? "Offers follow interviews — keep the conversations going →" : undefined}
        />
      </div>

      <Section title="Pipeline by stage">
        {stageCounts.map((s) => (
          <Bar
            key={s.key}
            label={s.label}
            value={s.n}
            pct={(s.n / maxStage) * 100}
            total={total}
            tone={s.key === "OFFER" ? "positive" : "neutral"}
          />
        ))}
      </Section>

      <Section title="Decision quality">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard value={recommended} label="Recommended" detail="Score 4.0+ · eligible for approval" />
          <MetricCard value={holds} label="Hold" detail="Score 3.5–3.9 · do not apply by default" />
          <MetricCard value={rejectedByFit} label="Reject" detail="Below 3.5 · remove unless evidence changes" />
        </div>
      </Section>

      <Section title="Conversion">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard value={rate(recommendedApplied, recommended)} label="Recommended → applied" detail={`${recommendedApplied} recommended applications / ${recommended} recommended`} />
          <MetricCard value={rate(responded, applied)} label="Applied → response" detail={`${responded} responded / ${applied} applied`} />
          <MetricCard value={rate(interviews, applied)} label="Applied → interview" detail={`${interviews} interviewed / ${applied} applied`} />
        </div>
        <p className="mt-3 text-xs text-faint">Rates use the current tracker snapshot. Time-to-response is unavailable until response timestamps are recorded.</p>
      </Section>

      <Section title="Channel yield">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-faint"><tr><th className="px-4 py-2.5">Channel</th><th className="px-4 py-2.5">Evaluated</th><th className="px-4 py-2.5">Recommended</th><th className="px-4 py-2.5">Applied</th><th className="px-4 py-2.5">Responses</th></tr></thead>
            <tbody className="divide-y divide-border">{[...channels.entries()].sort((a,b) => b[1].evaluated-a[1].evaluated).map(([name, row]) => <tr key={name}><td className="px-4 py-3 font-medium">{name}</td><td className="px-4 py-3 tabular-nums">{row.evaluated}</td><td className="px-4 py-3 tabular-nums">{row.recommended}</td><td className="px-4 py-3 tabular-nums">{row.applied}</td><td className="px-4 py-3 tabular-nums">{row.responses}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title="Score distribution">
        {buckets.map((b) => (
          <Bar key={b.label} label={b.label} value={b.n} pct={(b.n / maxBucket) * 100} total={scores.length} />
        ))}
      </Section>

      <Section title="Top companies" id="companies">
        {topCompanies.map(([name, n]) => (
          <Bar key={name} label={name} value={n} pct={(n / maxCompany) * 100} />
        ))}
      </Section>
    </div>
  );
}

function MetricCard({ value, label, detail }: { value: number | string; label: string; detail: string }) {
  return <div className="rounded-xl border border-border bg-surface/40 p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-faint">{detail}</p></div>;
}

function Stat({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-faint">{label}</div>
      {hint && (
        <Link href="/" className="mt-2 block text-xs text-muted transition-colors hover:text-brand">
          {hint}
        </Link>
      )}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      <div className="mt-4 space-y-2.5">{children}</div>
    </section>
  );
}

function Bar({
  label,
  value,
  pct,
  total,
  tone = "neutral",
}: {
  label: string;
  value: number;
  pct: number;
  total?: number;
  tone?: "neutral" | "positive";
}) {
  const share = total && total > 0 ? Math.round((value / total) * 100) : null;
  const fill =
    tone === "positive"
      ? "bg-gradient-to-r from-emerald-500/60 to-emerald-500/30"
      : "bg-gradient-to-r from-foreground/25 to-foreground/10";
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-sm text-muted">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-surface">
        <div
          className={`h-full rounded-md ${fill}`}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right text-sm tabular-nums">
        {value}
        {share !== null && <span className="ml-1 text-xs text-faint">{share}%</span>}
      </div>
    </div>
  );
}
