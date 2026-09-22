import { Radar } from "lucide-react";
import { PortalsView } from "@/components/portals-view";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";

export const dynamic = "force-dynamic";

export default function PortalsPage() {
  let inventory: { companies: { name: string; url: string }[]; boards: { name: string; url: string }[]; searches: { name: string; query: string }[] } = { companies: [], boards: [], searches: [] };
  try {
    const parsed = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), "portals.yml"), "utf8")) as Record<string, unknown>;
    const companies = Array.isArray(parsed?.tracked_companies) ? parsed.tracked_companies : [];
    const boards = Array.isArray(parsed?.job_boards) ? parsed.job_boards : [];
    const searches = Array.isArray(parsed?.search_queries) ? parsed.search_queries : [];
    inventory = {
      companies: companies.flatMap((x) => {
        const c = x as Record<string, unknown>;
        return c.enabled !== false && typeof c.name === "string" ? [{ name: c.name, url: typeof c.careers_url === "string" ? c.careers_url : "" }] : [];
      }),
      boards: boards.flatMap((x) => {
        const b = x as Record<string, unknown>;
        return b.enabled !== false && typeof b.name === "string" ? [{ name: b.name, url: typeof b.careers_url === "string" ? b.careers_url : "" }] : [];
      }),
      searches: searches.flatMap((x) => {
        const q = x as Record<string, unknown>;
        return q.enabled !== false && typeof q.name === "string" ? [{ name: q.name, query: typeof q.query === "string" ? q.query : "" }] : [];
      }),
    };
  } catch { /* Empty inventory is rendered explicitly. */ }
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Radar className="size-6 text-brand" />
        <h1 className="font-display text-2xl tracking-tight text-landing">Portals</h1>
      </div>
      <p className="mt-1.5 max-w-xl text-sm text-muted">
        The companies career-ops watches for new roles. Run a health check to catch company boards that have quietly
        broken — a broken link means that company silently disappears from every future scan.
      </p>
      <p className="mt-1.5 text-xs text-faint">
        Backed by <code className="text-muted">portals.yml</code> — edit it directly or ask the assistant.
      </p>
      <div className="mt-6">
        <PortalsView inventory={inventory} />
      </div>
    </div>
  );
}
