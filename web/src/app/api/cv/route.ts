import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

function cvPath() {
  return path.join(careerOpsRoot(), "cv.md");
}

const MAX_CV_BYTES = 200_000;

export async function GET() {
  const file = cvPath();
  try {
    const revisions = fs.readdirSync(path.dirname(file))
      .filter((name) => name.startsWith("cv.md.bak-") && fs.statSync(path.join(path.dirname(file), name)).isFile())
      .sort().reverse().slice(0, 20)
      .map((name) => ({ name, createdAt: name.slice("cv.md.bak-".length).replace(/-(\d{3})Z$/, ".$1Z") }));
    return NextResponse.json({ content: fs.readFileSync(file, "utf8"), exists: true, revisions });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT" && !fs.existsSync(file)) {
      return NextResponse.json({ content: "", exists: false, revisions: [] });
    }
    return NextResponse.json({ error: "CV could not be read. Check the file and folder permissions." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let body: { revision?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const revision = String(body.revision ?? "");
  if (!/^cv\.md\.bak-[A-Za-z0-9.-]+$/.test(revision)) return NextResponse.json({ error: "invalid revision" }, { status: 400 });
  const dir = path.dirname(cvPath());
  const source = path.join(dir, revision);
  if (path.dirname(source) !== dir) return NextResponse.json({ error: "invalid revision" }, { status: 400 });
  try {
    const restored = fs.readFileSync(source, "utf8");
    atomicWriteWithBackup(cvPath(), restored);
    return NextResponse.json({ ok: true, content: restored });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return NextResponse.json({ error: "revision not found" }, { status: 404 });
    return NextResponse.json({ error: "revision could not be read" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV is too large (over 200KB)" }, { status: 413 });
  }
  // DATA_CONTRACT: cv.md is user-layer and gitignored (no git recovery). Never
  // blind-overwrite — snapshot the prior CV to a .bak first, write atomically.
  try {
    const bak = atomicWriteWithBackup(cvPath(), body.content);
    return NextResponse.json({ ok: true, backedUp: !!bak });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
