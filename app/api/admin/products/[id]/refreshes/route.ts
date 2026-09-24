import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

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
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const dueAt = body.dueAt ? new Date(body.dueAt) : new Date();
    if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });
    if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: "invalid dueAt" }, { status: 400 });
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(await db.contentRefresh.create({ data: { productId: id, reason, dueAt } }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid refresh payload" }, { status: 400 });
  }
}
