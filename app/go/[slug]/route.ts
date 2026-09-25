import { after, NextResponse } from "next/server";
import { findProduct, loadCatalog } from "@/lib/catalog";
import { campaignFromSearchParams } from "@/lib/analytics";
import { resolveOutbound } from "@/lib/outbound";
import { recordEvent } from "@/lib/record-event";
import { absolute } from "@/lib/site";
import { isValidSlug, routes } from "@/lib/seo/routes";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = isValidSlug(slug) ? findProduct(await loadCatalog(), slug) : undefined;
  const target = product ? resolveOutbound(product) : null;
  if (!product || !target) return NextResponse.redirect(absolute(routes.products()), { status: 302, headers: NO_STORE });

  const campaign = campaignFromSearchParams(new URL(req.url).searchParams, product.slug);
  after(() =>
    recordEvent({
      event: "outbound_click",
      path: routes.go(product.slug),
      productSlug: product.slug,
      placement: campaign.placement,
      pageType: campaign.pageType,
      pageSlug: campaign.pageSlug,
      ctaType: campaign.ctaType,
      sponsorId: null,
      metadata: { destination: target.kind },
    }),
  );
  return NextResponse.redirect(target.url, { status: 302, headers: NO_STORE });
}
