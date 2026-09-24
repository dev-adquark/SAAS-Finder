import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isBoolean, isHttpUrl, isNonEmptyString, parseOptionalDate } from "@/lib/validation";

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
    const current = await db.sponsorSlot.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
      if (!isNonEmptyString(b.name, 200)) return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
      data.name = b.name.trim();
    }
    if (b.label !== undefined) {
      if (!isNonEmptyString(b.label, 100)) return NextResponse.json({ error: "label must be non-empty" }, { status: 400 });
      data.label = b.label.trim();
    }
    if (b.placement !== undefined) {
      if (!isNonEmptyString(b.placement, 100)) return NextResponse.json({ error: "placement must be non-empty" }, { status: 400 });
      data.placement = b.placement.trim();
    }
    if (b.active !== undefined) {
      if (!isBoolean(b.active)) return NextResponse.json({ error: "active must be boolean" }, { status: 400 });
      data.active = b.active;
    }
    if (b.url !== undefined) {
      if (b.url !== null && b.url !== "" && !isHttpUrl(b.url)) return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
      data.url = typeof b.url === "string" && b.url.trim() ? b.url.trim() : null;
    }

    const startsAt = b.startsAt === undefined ? current.startsAt : parseOptionalDate(b.startsAt);
    const endsAt = b.endsAt === undefined ? current.endsAt : parseOptionalDate(b.endsAt);
    if (startsAt === undefined || endsAt === undefined) return NextResponse.json({ error: "invalid sponsor dates" }, { status: 400 });
    if (startsAt && endsAt && startsAt > endsAt) return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 400 });
    if (b.startsAt !== undefined) data.startsAt = startsAt;
    if (b.endsAt !== undefined) data.endsAt = endsAt;

    return NextResponse.json(await db.sponsorSlot.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "Invalid sponsor update" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await db.sponsorSlot.delete({ where: { id: (await params).id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });
  }
}
