import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
const isUrl = (v: unknown) => { try { const u = new URL(String(v)); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
export async function GET(req: Request) { if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return NextResponse.json(await db.sponsorSlot.findMany({ orderBy: { createdAt: "desc" } })); }
export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const b = await req.json(); const name = String(b.name ?? "").trim(); if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (b.url && !isUrl(b.url)) return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
    const startsAt = b.startsAt ? new Date(b.startsAt) : null; const endsAt = b.endsAt ? new Date(b.endsAt) : null;
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) return NextResponse.json({ error: "invalid sponsor dates" }, { status: 400 });
    if (startsAt && endsAt && startsAt > endsAt) return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 400 });
    return NextResponse.json(await db.sponsorSlot.create({ data: { name, label: String(b.label ?? "Sponsored"), placement: String(b.placement ?? "default"), active: Boolean(b.active), url: b.url ?? null, startsAt, endsAt } }), { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid sponsor payload" }, { status: 400 }); }
}