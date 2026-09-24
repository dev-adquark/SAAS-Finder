import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isHttpUrl, isNonEmptyString, isSnapshotType, parseOptionalDate } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.pricingSnapshot.findMany({
    where: { productId: (await params).id },
    orderBy: { capturedAt: "desc" },
  }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = (await params).id;
    const b = await req.json();
    if (!isNonEmptyString(b.summary, 5000)) return NextResponse.json({ error: "summary is required" }, { status: 400 });
    if (b.snapshotType !== undefined && !isSnapshotType(b.snapshotType)) {
      return NextResponse.json({ error: "invalid snapshotType" }, { status: 400 });
    }
    if (b.sourceUrl !== undefined && b.sourceUrl !== null && b.sourceUrl !== "" && !isHttpUrl(b.sourceUrl)) {
      return NextResponse.json({ error: "sourceUrl must be a valid http(s) URL" }, { status: 400 });
    }
    const capturedAt = parseOptionalDate(b.capturedAt);
    if (capturedAt === undefined) return NextResponse.json({ error: "invalid capturedAt" }, { status: 400 });

    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(await db.pricingSnapshot.create({
      data: {
        productId: id,
        summary: b.summary.trim(),
        sourceUrl: typeof b.sourceUrl === "string" && b.sourceUrl.trim() ? b.sourceUrl.trim() : null,
        snapshotType: b.snapshotType ?? "PRICING",
        ...(capturedAt ? { capturedAt } : {}),
      },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid snapshot payload" }, { status: 400 });
  }
}
