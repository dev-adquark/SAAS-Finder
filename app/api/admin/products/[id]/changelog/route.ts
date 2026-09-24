import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonEmptyString } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await db.changeLog.findMany({ where: { productId: id }, orderBy: { changedAt: "desc" } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    if (!isNonEmptyString(body.version, 100) || !isNonEmptyString(body.summary, 5000)) {
      return NextResponse.json({ error: "version and summary are required" }, { status: 400 });
    }
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(await db.changeLog.create({
      data: { productId: id, version: body.version.trim(), summary: body.summary.trim() },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid changelog payload" }, { status: 400 });
  }
}
