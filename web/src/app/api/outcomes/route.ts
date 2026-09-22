import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { careerOpsRoot, findApplication } from "@/lib/career-ops";
import { parseCliJson } from "@/lib/status-cli.mjs";

export const runtime = "nodejs";
const run = promisify(execFile);
const TYPES = new Set(["interview_progress", "offer_received", "hired", "offer_declined", "rejected", "no_response", "interview_only"]);

export async function POST(req: Request) {
  let body: { n?: string; type?: string; stage?: string; feedback?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const n = String(body.n ?? "").trim();
  const type = String(body.type ?? "").trim();
  if (!/^\d+$/.test(n) || !findApplication(n)) return NextResponse.json({ error: "application not found" }, { status: 404 });
  if (!TYPES.has(type)) return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
  const script = path.join(careerOpsRoot(), "outcome.mjs");
  if (!fs.existsSync(script)) {
    return NextResponse.json(
      { error: "outcome recording needs the career-ops scripts; this root has data only", code: "core-script-missing" },
      { status: 503 },
    );
  }
  const args = [script, n, type, "--json"];
  const add = (flag: string, value: unknown) => {
    const clean = typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 2000) : "";
    if (clean) args.push(flag, clean);
  };
  add("--stage", body.stage);
  add("--feedback", body.feedback);
  add("--note", body.note);
  try {
    const { stdout } = await run(process.execPath, args, { cwd: careerOpsRoot(), timeout: 30_000, windowsHide: true, maxBuffer: 1_000_000 });
    const result = parseCliJson(stdout);
    if (!result) return NextResponse.json({ error: "outcome was recorded but returned no usable result" }, { status: 500 });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string; killed?: boolean; code?: number | string };
    const parsed = parseCliJson(e.stdout || "");
    if (e.stderr?.trim()) console.error(`/api/outcomes: outcome.mjs failed: ${e.stderr.trim()}`);
    if (e.killed) {
      return NextResponse.json(
        { error: "outcome recording timed out; the change may or may not have been applied" },
        { status: 504, headers: { "Retry-After": "5" } },
      );
    }
    const status = e.code === 2 ? 404 : e.code === 3 ? 409 : 500;
    const message = typeof parsed?.error === "string" ? parsed.error : "outcome could not be recorded";
    return NextResponse.json({ error: message.slice(0, 500) }, { status });
  }
}
