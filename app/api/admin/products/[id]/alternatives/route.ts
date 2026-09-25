import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonNegativeInteger, isNonEmptyString } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await db.alternative.findMany({ where: { productId: id }, include: { alternative: true }, orderBy: { sortOrder: "asc" } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    if (!isNonEmptyString(body.alternativeId, 100)) return NextResponse.json({ error: "alternativeId is required" }, { status: 400 });
    if (body.alternativeId.trim() === id) return NextResponse.json({ error: "A product cannot be its own alternative" }, { status: 400 });
    if (body.sortOrder !== undefined && !isNonNegativeInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder must be a non-negative integer" }, { status: 400 });
    const target = await db.product.findUnique({ where: { id: body.alternativeId.trim() }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "alternative product not found" }, { status: 404 });
    const source = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!source) return NextResponse.json({ error: "product not found" }, { status: 404 });
    return NextResponse.json(await db.alternative.create({ data: { productId: id, alternativeId: target.id, sortOrder: body.sortOrder ?? 0 } }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Alternative already exists or payload is invalid" }, { status: 409 });
  }
}
