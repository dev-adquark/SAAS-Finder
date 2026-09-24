import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isBoolean, isHttpUrl, isNonEmptyString, parseOptionalDate } from "@/lib/validation";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.sponsorSlot.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    if (!isNonEmptyString(b.name, 200)) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (b.label !== undefined && !isNonEmptyString(b.label, 100)) return NextResponse.json({ error: "label must be non-empty" }, { status: 400 });
    if (b.placement !== undefined && !isNonEmptyString(b.placement, 100)) return NextResponse.json({ error: "placement must be non-empty" }, { status: 400 });
    if (b.url !== undefined && b.url !== null && b.url !== "" && !isHttpUrl(b.url)) {
      return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
    }
    if (b.active !== undefined && !isBoolean(b.active)) return NextResponse.json({ error: "active must be boolean" }, { status: 400 });

    const startsAt = parseOptionalDate(b.startsAt);
    const endsAt = parseOptionalDate(b.endsAt);
    if (startsAt === undefined || endsAt === undefined) return NextResponse.json({ error: "invalid sponsor dates" }, { status: 400 });
    if (startsAt && endsAt && startsAt > endsAt) return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 400 });

    return NextResponse.json(await db.sponsorSlot.create({
      data: {
        name: b.name.trim(),
        label: typeof b.label === "string" ? b.label.trim() : "Sponsored",
        placement: typeof b.placement === "string" ? b.placement.trim() : "default",
        active: b.active === true,
        url: typeof b.url === "string" && b.url.trim() ? b.url.trim() : null,
        startsAt,
        endsAt,
      },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid sponsor payload" }, { status: 400 });
  }
}
