import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.product.findMany({
    include: { category: true, faqs: true, snapshots: true, links: true, alternativesFrom: true },
    orderBy: { updatedAt: "desc" },
  }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.slug || !body.name || !body.category || !body.officialUrl) {
    return NextResponse.json({ error: "slug, name, category and officialUrl are required" }, { status: 400 });
  }

  const categorySlug = String(body.category).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const category = await db.category.upsert({
    where: { slug: categorySlug },
    update: { name: String(body.category) },
    create: { name: String(body.category), slug: categorySlug },
  });

  const product = await db.product.create({
    data: {
      slug: body.slug,
      name: body.name,
      categoryId: category.id,
      tagline: body.tagline ?? "",
      description: body.description ?? "",
      subcategory: body.subcategory ?? null,
      rating: body.rating ?? null,
      officialUrl: body.officialUrl,
      pricingUrl: body.pricingUrl ?? null,
      bestFor: body.bestFor ?? [],
      features: body.features ?? [],
      pros: body.pros ?? [],
      cons: body.cons ?? [],
      tags: body.tags ?? [],
      comparison: body.comparison ?? {},
      status: body.status ?? "DRAFT",
    },
  });

  return NextResponse.json(product, { status: 201 });
}
