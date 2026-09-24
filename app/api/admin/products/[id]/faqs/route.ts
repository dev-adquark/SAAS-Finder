import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonEmptyString, isNonNegativeInteger } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await db.faq.findMany({ where: { productId: id }, orderBy: { sortOrder: "asc" } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    if (!isNonEmptyString(b.question, 500) || !isNonEmptyString(b.answer, 5000)) {
      return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
    }
    if (b.sortOrder !== undefined && !isNonNegativeInteger(b.sortOrder)) {
      return NextResponse.json({ error: "sortOrder must be a non-negative integer" }, { status: 400 });
    }
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(await db.faq.create({
      data: { productId: id, question: b.question.trim(), answer: b.answer.trim(), sortOrder: b.sortOrder ?? 0 },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid FAQ payload" }, { status: 400 });
  }
}
