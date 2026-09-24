import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isBoolean, isHttpUrl, isNonEmptyString } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await db.affiliateLink.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await req.json();
    if (!isNonEmptyString(b.label, 120) || !isHttpUrl(b.url)) {
      return NextResponse.json({ error: "label and a valid http(s) url are required" }, { status: 400 });
    }
    if (b.provider !== undefined && b.provider !== null && !isNonEmptyString(b.provider, 120)) {
      return NextResponse.json({ error: "provider must be a non-empty string when supplied" }, { status: 400 });
    }
    if (b.active !== undefined && !isBoolean(b.active)) {
      return NextResponse.json({ error: "active must be boolean" }, { status: 400 });
    }
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(await db.affiliateLink.create({
      data: {
        productId: id,
        label: b.label.trim(),
        url: b.url.trim(),
        provider: typeof b.provider === "string" ? b.provider.trim() : null,
        active: b.active === true,
      },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid affiliate link payload" }, { status: 400 });
  }
}
