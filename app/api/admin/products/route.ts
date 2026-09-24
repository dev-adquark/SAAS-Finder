import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const isUrl = (value: unknown) => { try { const u = new URL(String(value)); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const statuses = new Set(["DRAFT","REVIEW","PUBLISHED","ARCHIVED"]);

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.product.findMany({ include: { category: true, faqs: true, snapshots: true, links: true, alternativesFrom: true }, orderBy: { updatedAt: "desc" } }));
}
export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.slug || !body.name || !body.category || !isUrl(body.officialUrl)) return NextResponse.json({ error: "slug, name, category and a valid officialUrl are required" }, { status: 400 });
    if (body.pricingUrl && !isUrl(body.pricingUrl)) return NextResponse.json({ error: "pricingUrl must be a valid http(s) URL" }, { status: 400 });
    if (body.status !== undefined && !statuses.has(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
    const categorySlug = String(body.category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!categorySlug) return NextResponse.json({ error: "invalid category" }, { status: 400 });
    const category = await db.category.upsert({ where: { slug: categorySlug }, update: { name: String(body.category) }, create: { name: String(body.category), slug: categorySlug } });
    const product = await db.product.create({ data: {
      slug: String(body.slug).trim(), name: String(body.name).trim(), categoryId: category.id,
      tagline: body.tagline ?? "", description: body.description ?? "", subcategory: body.subcategory ?? null,
      rating: body.rating ?? null, officialUrl: body.officialUrl, pricingUrl: body.pricingUrl ?? null,
      bestFor: body.bestFor ?? [], features: body.features ?? [], pros: body.pros ?? [], cons: body.cons ?? [],
      tags: body.tags ?? [], comparison: body.comparison ?? {}, status: body.status ?? "DRAFT",
    }});
    return NextResponse.json(product, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid product payload or duplicate slug" }, { status: 400 }); }
}