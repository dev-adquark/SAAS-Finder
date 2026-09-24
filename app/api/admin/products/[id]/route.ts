import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isContentStatus, isHttpUrl, isRatingOrNull, slugify } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id }, include: { category: true, faqs: true, snapshots: true, links: true, changelog: true, refreshes: true } });
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of ["slug","name","tagline","description","subcategory","rating","officialUrl","pricingUrl","bestFor","features","pros","cons","tags","comparison","status"]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (data.rating !== undefined && !isRatingOrNull(data.rating)) return NextResponse.json({ error: "rating must be between 0 and 5" }, { status: 400 });
  if (data.status !== undefined && !isContentStatus(data.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  if (data.officialUrl !== undefined && !isHttpUrl(data.officialUrl)) return NextResponse.json({ error: "officialUrl must be a valid http(s) URL" }, { status: 400 });
  if (data.pricingUrl !== undefined && data.pricingUrl !== null && !isHttpUrl(data.pricingUrl)) return NextResponse.json({ error: "pricingUrl must be a valid http(s) URL" }, { status: 400 });
  if (body.category !== undefined) {
    const categoryName = String(body.category).trim();
    const categorySlug = slugify(categoryName);
    if (!categorySlug) return NextResponse.json({ error: "invalid category" }, { status: 400 });
    const category = await db.category.upsert({ where: { slug: categorySlug }, update: { name: categoryName }, create: { name: categoryName, slug: categorySlug } });
    data.categoryId = category.id;
  }
  try {
    return NextResponse.json(await db.product.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "Product not found or update failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await db.product.delete({ where: { id: (await params).id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}
