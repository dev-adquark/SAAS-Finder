import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isContentStatus, isHttpUrl, isRatingOrNull, isPlainObject, isNonEmptyString, slugify } from "@/lib/validation";

const textFields = ["slug", "name", "tagline", "description", "subcategory"] as const;
const jsonFields = ["bestFor", "features", "pros", "cons", "tags", "comparison"] as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id }, include: { category: true, faqs: true, snapshots: true, links: true, changelog: true, refreshes: true } });
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid JSON object" }, { status: 400 });
    const data: Record<string, unknown> = {};
    for (const key of textFields) if (body[key] !== undefined) {
      if (!isNonEmptyString(body[key], key === "description" ? 10000 : 500)) return NextResponse.json({ error: `${key} must be a non-empty string` }, { status: 400 });
      data[key] = key === "slug" ? slugify(body[key]) : body[key].trim();
    }
    if (data.slug === "") return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    if (body.rating !== undefined && !isRatingOrNull(body.rating)) return NextResponse.json({ error: "rating must be between 0 and 5" }, { status: 400 });
    if (body.status !== undefined && !isContentStatus(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    if (body.officialUrl !== undefined && !isHttpUrl(body.officialUrl)) return NextResponse.json({ error: "officialUrl must be a valid http(s) URL" }, { status: 400 });
    if (body.pricingUrl !== undefined && body.pricingUrl !== null && !isHttpUrl(body.pricingUrl)) return NextResponse.json({ error: "pricingUrl must be a valid http(s) URL" }, { status: 400 });
    for (const key of jsonFields) if (body[key] !== undefined && body[key] !== null && !Array.isArray(body[key]) && !isPlainObject(body[key])) return NextResponse.json({ error: `${key} must be an array or object` }, { status: 400 });
    for (const key of jsonFields) if (body[key] !== undefined) data[key] = body[key];
    if (body.rating !== undefined) data.rating = body.rating;
    if (body.status !== undefined) data.status = body.status;
    if (body.officialUrl !== undefined) data.officialUrl = body.officialUrl.trim();
    if (body.pricingUrl !== undefined) data.pricingUrl = body.pricingUrl === null ? null : body.pricingUrl.trim();
    if (body.category !== undefined) {
      if (!isNonEmptyString(body.category, 120)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
      const categoryName = body.category.trim();
      const categorySlug = slugify(categoryName);
      const category = await db.category.upsert({ where: { slug: categorySlug }, update: { name: categoryName }, create: { name: categoryName, slug: categorySlug } });
      data.categoryId = category.id;
    }
    return NextResponse.json(await db.product.update({ where: { id }, data }));
  } catch {
    return NextResponse.json({ error: "Product not found or update failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await db.product.delete({ where: { id: (await params).id } }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Product not found" }, { status: 404 }); }
}
