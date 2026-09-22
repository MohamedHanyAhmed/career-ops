import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { withTrackerLock } from "@/lib/core/tracker-lock";

export const DECISION_EVENTS = [
  "override-approved", "override-revoked",
  "tailoring-approved", "tailoring-revoked",
  "application-approved", "application-revoked",
  "form-prepared", "form-reset",
] as const;
export type DecisionEvent = (typeof DECISION_EVENTS)[number];
export type DecisionState = {
  tailoringApproved: boolean;
  applicationApproved: boolean;
  formPrepared: boolean;
  overrideApproved: boolean;
  events: { timestamp: string; event: DecisionEvent; note: string }[];
};

const HEADER = "timestamp\tapplication\tevent\tactor\tnote\tcontext\tevent_id\n";
const filePath = () => path.join(careerOpsRoot(), "data", "application-decisions.tsv");
const clean = (value: string) => value.replace(/[\t\r\n]+/g, " ").trim().slice(0, 300);

function rows() {
  try {
    return fs.readFileSync(filePath(), "utf8").split(/\r?\n/).slice(1).filter(Boolean);
  } catch {
    return [];
  }
}

export function buildDecisionContext(input: { url?: string; score?: string; report?: string | null }): string {
  return crypto.createHash("sha256")
    .update(JSON.stringify({ url: input.url ?? "", score: input.score ?? "", report: input.report ?? "" }))
    .digest("hex")
    .slice(0, 24);
}

function actorName(): string {
  try {
    const parsed = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), "config", "profile.yml"), "utf8")) as { candidate?: { full_name?: unknown } };
    const name = parsed?.candidate?.full_name;
    if (typeof name === "string" && name.trim()) return clean(name);
  } catch { /* A missing profile is valid during onboarding. */ }
  return "candidate";
}

export function readDecisionState(application: string, context = ""): DecisionState {
  const events = rows().flatMap((line) => {
    const [timestamp, n, event, , note = "", eventContext = ""] = line.split("\t");
    if (n !== application || !DECISION_EVENTS.includes(event as DecisionEvent)) return [];
    // Legacy/unversioned approvals are deliberately stale once a context is
    // available. An approval belongs to the evidence the user actually saw.
    if (context && eventContext !== context) return [];
    return [{ timestamp, event: event as DecisionEvent, note }];
  });
  const active = (yes: DecisionEvent, no: DecisionEvent) => {
    const last = [...events].reverse().find((e) => e.event === yes || e.event === no);
    return last?.event === yes;
  };
  return {
    tailoringApproved: active("tailoring-approved", "tailoring-revoked"),
    applicationApproved: active("application-approved", "application-revoked"),
    formPrepared: active("form-prepared", "form-reset"),
    overrideApproved: active("override-approved", "override-revoked"),
    events,
  };
}

export async function recordDecision(application: string, event: DecisionEvent, note = "", context = "") {
  const file = filePath();
  return withTrackerLock(file, () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) fs.writeFileSync(file, HEADER, "utf8");
    const state = readDecisionState(application, context);
    const already = (
      (event === "override-approved" && state.overrideApproved) ||
      (event === "tailoring-approved" && state.tailoringApproved) ||
      (event === "application-approved" && state.applicationApproved) ||
      (event === "form-prepared" && state.formPrepared)
    );
    if (!already) {
      const id = crypto.randomUUID();
      fs.appendFileSync(file, `${new Date().toISOString()}\t${application}\t${event}\t${actorName()}\t${clean(note)}\t${clean(context)}\t${id}\n`, "utf8");
    }
    return readDecisionState(application, context);
  });
}
