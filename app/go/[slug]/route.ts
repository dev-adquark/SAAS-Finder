import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { absolute } from "@/lib/site";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return NextResponse.redirect(absolute("/products"), { status: 302 });

  const target = product.affiliateAvailable && product.affiliateUrl
    ? product.affiliateUrl
    : product.officialUrl;
  const url = new URL(target);
  url.searchParams.set("utm_source", "saasfinder");
  url.searchParams.set("utm_medium", product.affiliateAvailable ? "affiliate" : "referral");
  url.searchParams.set("utm_campaign", "product_review");
  return NextResponse.redirect(url.toString(), { status: 302 });
}
