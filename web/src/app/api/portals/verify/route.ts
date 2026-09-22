import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Orchestrates the core's verify-portals.mjs (#1016) — the SAME ATS-slug
// validator the CLI uses. Catches the silent 404s that quietly drop a company
// from every future scan (= lost offers). We parse its console output; we do NOT
// reimplement the validation.
const STATUS: Record<string, "live" | "empty" | "broken" | "skipped"> = {
  "✅": "live",
  "🟡": "empty",
  "❌": "broken",
  "➖": "skipped",
};

export async function GET() {
  const root = careerOpsRoot();
  const verifyPortals = rootScript("verify-portals");
  if (!fs.existsSync(verifyPortals)) {
    return Response.json({ available: false, configured: false, companies: [] });
  }
  if (!fs.existsSync(path.join(root, "portals.yml"))) {
    return Response.json({ available: true, configured: false, companies: [] });
  }

  const stdout = await new Promise<string>((resolve) => {
    execFile(
      "node",
      [verifyPortals],
      { cwd: root, timeout: 110_000, maxBuffer: 4 * 1024 * 1024 },
      (_e, out, err) => resolve((out || "") + (err || "")),
    );
  });

  let boardNames = new Set<string>();
  try {
    const config = yaml.load(fs.readFileSync(path.join(root, "portals.yml"), "utf8")) as Record<string, unknown>;
    const boards = Array.isArray(config?.job_boards) ? config.job_boards : [];
    boardNames = new Set(boards.flatMap((entry) => {
      const row = entry as Record<string, unknown>;
      return typeof row.name === "string" ? [row.name] : [];
    }));
  } catch { /* The configured=false branch above already handles missing config. */ }

  const companies: { name: string; status: string; detail: string; kind: "company" | "source"; failureKind?: string; repairable: boolean }[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^\s*(✅|🟡|❌|➖)\s+(.+?)\s+—\s+(.*)$/);
    if (m) {
      const name = m[2].trim();
      const detail = m[3].trim();
      const failureKind = detail.match(/\((slug not found|auth blocked|network error|server error|unresolved)\)/)?.[1];
      const rawStatus = STATUS[m[1]] ?? "unknown";
      const status = rawStatus === "broken" && failureKind === "auth blocked"
        ? "blocked"
        : rawStatus === "broken" && (failureKind === "network error" || failureKind === "server error")
          ? "unavailable"
          : rawStatus;
      companies.push({
        name,
        status,
        detail,
        kind: boardNames.has(name) ? "source" : "company",
        failureKind,
        repairable: failureKind === "slug not found",
      });
    }
  }
  const failures = companies.filter((row) => ["broken", "blocked", "unavailable"].includes(row.status));
  const grouped = failures.reduce<Record<string, number>>((acc, row) => {
    const key = row.failureKind || "unresolved";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const systemic = failures.length >= 3 && Object.values(grouped).some((count) => count / failures.length >= 0.6);
  return Response.json({ available: true, configured: true, companies, diagnosis: { systemic, grouped } });
}
