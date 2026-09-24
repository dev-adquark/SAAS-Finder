import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isContentStatus, isHttpUrl, isRatingOrNull, slugify } from "@/lib/validation";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.product.findMany({ include: { category: true, faqs: true, snapshots: true, links: true, alternativesFrom: true }, orderBy: { updatedAt: "desc" } }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    const name = String(body.name ?? "").trim();
    const categoryName = String(body.category ?? "").trim();
    if (!slug || !name || !categoryName || !isHttpUrl(body.officialUrl)) {
      return NextResponse.json({ error: "slug, name, category and a valid officialUrl are required" }, { status: 400 });
    }
    if (body.pricingUrl !== undefined && body.pricingUrl !== null && !isHttpUrl(body.pricingUrl)) {
      return NextResponse.json({ error: "pricingUrl must be a valid http(s) URL" }, { status: 400 });
    }
    if (body.rating !== undefined && !isRatingOrNull(body.rating)) return NextResponse.json({ error: "rating must be between 0 and 5" }, { status: 400 });
    if (body.status !== undefined && !isContentStatus(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    const categorySlug = slugify(categoryName);
    if (!categorySlug) return NextResponse.json({ error: "invalid category" }, { status: 400 });

    const category = await db.category.upsert({
      where: { slug: categorySlug },
      update: { name: categoryName },
      create: { name: categoryName, slug: categorySlug },
    });
    const product = await db.product.create({
      data: {
        slug, name, categoryId: category.id,
        tagline: typeof body.tagline === "string" ? body.tagline : "",
        description: typeof body.description === "string" ? body.description : "",
        subcategory: typeof body.subcategory === "string" ? body.subcategory : null,
        rating: typeof body.rating === "number" ? body.rating : null,
        officialUrl: body.officialUrl,
        pricingUrl: body.pricingUrl ?? null,
        bestFor: body.bestFor ?? [], features: body.features ?? [], pros: body.pros ?? [], cons: body.cons ?? [],
        tags: body.tags ?? [], comparison: body.comparison ?? {}, status: body.status ?? "DRAFT",
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid product payload or duplicate slug" }, { status: 400 });
  }
}
