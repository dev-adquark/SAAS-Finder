import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isContentStatus, isHttpUrl, isRatingOrNull, isPlainObject, isNonEmptyString, slugify } from "@/lib/validation";

const jsonFields = ["bestFor", "features", "pros", "cons", "tags", "comparison"] as const;

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.product.findMany({ include: { category: true, faqs: true, snapshots: true, links: true, alternativesFrom: true }, orderBy: { updatedAt: "desc" } }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid JSON object" }, { status: 400 });
    if (!isNonEmptyString(body.slug, 120) || !isNonEmptyString(body.name, 200) || !isNonEmptyString(body.category, 120) || !isHttpUrl(body.officialUrl)) return NextResponse.json({ error: "slug, name, category and a valid officialUrl are required" }, { status: 400 });
    const slug = slugify(body.slug);
    const categoryName = body.category.trim();
    if (!slug) return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    if (body.pricingUrl !== undefined && body.pricingUrl !== null && !isHttpUrl(body.pricingUrl)) return NextResponse.json({ error: "pricingUrl must be a valid http(s) URL" }, { status: 400 });
    if (body.rating !== undefined && !isRatingOrNull(body.rating)) return NextResponse.json({ error: "rating must be between 0 and 5" }, { status: 400 });
    if (body.status !== undefined && !isContentStatus(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    for (const key of jsonFields) if (body[key] !== undefined && body[key] !== null && !Array.isArray(body[key]) && !isPlainObject(body[key])) return NextResponse.json({ error: `${key} must be an array or object` }, { status: 400 });
    const categorySlug = slugify(categoryName);
    const category = await db.category.upsert({ where: { slug: categorySlug }, update: { name: categoryName }, create: { name: categoryName, slug: categorySlug } });
    const product = await db.product.create({ data: {
      slug, name: body.name.trim(), categoryId: category.id,
      tagline: typeof body.tagline === "string" ? body.tagline.trim() : "",
      description: typeof body.description === "string" ? body.description.trim() : "",
      subcategory: typeof body.subcategory === "string" ? body.subcategory.trim() || null : null,
      rating: typeof body.rating === "number" ? body.rating : null,
      officialUrl: body.officialUrl.trim(), pricingUrl: body.pricingUrl ?? null,
      bestFor: body.bestFor ?? [], features: body.features ?? [], pros: body.pros ?? [], cons: body.cons ?? [], tags: body.tags ?? [], comparison: body.comparison ?? {}, status: body.status ?? "DRAFT",
    } });
    return NextResponse.json(product, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid product payload or duplicate slug" }, { status: 400 }); }
}
