import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonEmptyString, parseOptionalDate } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await db.contentRefresh.findMany({ where: { productId: id }, orderBy: { dueAt: "asc" } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    if (!isNonEmptyString(body.reason, 1000)) return NextResponse.json({ error: "reason is required" }, { status: 400 });
    const dueAt = parseOptionalDate(body.dueAt);
    if (dueAt === undefined || dueAt === null) return NextResponse.json({ error: "valid dueAt is required" }, { status: 400 });

    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(await db.contentRefresh.create({
      data: { productId: id, reason: body.reason.trim(), dueAt },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid refresh payload" }, { status: 400 });
  }
}
