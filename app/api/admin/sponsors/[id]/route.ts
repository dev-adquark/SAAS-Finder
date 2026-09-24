import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const validUrl = (value: unknown) => {
  if (value === null || value === undefined || value === "") return true;
  try { const url = new URL(String(value)); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sponsor = await db.sponsorSlot.findUnique({ where: { id: (await params).id } });
  return sponsor ? NextResponse.json(sponsor) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) { if (typeof b.name !== "string" || !b.name.trim()) return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 }); data.name = b.name.trim(); }
    if (b.label !== undefined) { if (typeof b.label !== "string" || !b.label.trim()) return NextResponse.json({ error: "label must be a non-empty string" }, { status: 400 }); data.label = b.label.trim(); }
    if (b.placement !== undefined) { if (typeof b.placement !== "string" || !b.placement.trim()) return NextResponse.json({ error: "placement must be a non-empty string" }, { status: 400 }); data.placement = b.placement.trim(); }
    if (b.active !== undefined) { if (typeof b.active !== "boolean") return NextResponse.json({ error: "active must be boolean" }, { status: 400 }); data.active = b.active; }
    if (b.url !== undefined) { if (!validUrl(b.url)) return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 }); data.url = b.url ? String(b.url).trim() : null; }
    const startsAt = b.startsAt === null || b.startsAt === undefined ? undefined : new Date(b.startsAt);
    const endsAt = b.endsAt === null || b.endsAt === undefined ? undefined : new Date(b.endsAt);
    if (startsAt && Number.isNaN(startsAt.getTime()) || endsAt && Number.isNaN(endsAt.getTime())) return NextResponse.json({ error: "invalid sponsor dates" }, { status: 400 });
    if (startsAt) data.startsAt = startsAt;
    if (endsAt) data.endsAt = endsAt;
    if (startsAt && endsAt && startsAt > endsAt) return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 400 });
    return NextResponse.json(await db.sponsorSlot.update({ where: { id }, data }));
  } catch { return NextResponse.json({ error: "Sponsor not found or update failed" }, { status: 404 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await db.sponsorSlot.delete({ where: { id: (await params).id } }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Sponsor not found" }, { status: 404 }); }
}
