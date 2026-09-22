import { NextResponse } from "next/server";
import { DECISION_EVENTS, buildDecisionContext, readDecisionState, recordDecision, type DecisionEvent } from "@/lib/core/decision-log";
import { findApplication, readReport } from "@/lib/career-ops";

export const runtime = "nodejs";

function currentContext(n: string) {
  const app = findApplication(n);
  const report = readReport(n);
  return { app, context: buildDecisionContext({ url: app?.url, score: app?.score, report: report?.content }) };
}

export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("n") ?? "";
  if (!/^\d+$/.test(n)) return NextResponse.json({ error: "valid application number required" }, { status: 400 });
  const { app, context } = currentContext(n);
  if (!app) return NextResponse.json({ error: "application not found" }, { status: 404 });
  return NextResponse.json(readDecisionState(n, context));
}

export async function POST(req: Request) {
  let body: { n?: string; event?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const n = String(body.n ?? "").trim();
  const { app, context } = currentContext(n);
  if (!/^\d+$/.test(n) || !app) return NextResponse.json({ error: "application not found" }, { status: 404 });
  if (!DECISION_EVENTS.includes(body.event as DecisionEvent)) return NextResponse.json({ error: "invalid decision event" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, state: await recordDecision(n, body.event as DecisionEvent, body.note, context) });
  } catch {
    return NextResponse.json({ error: "could not record approval" }, { status: 500 });
  }
}
