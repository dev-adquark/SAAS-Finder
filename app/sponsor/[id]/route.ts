import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignFromSearchParams } from "@/lib/analytics";
import { recordEvent } from "@/lib/record-event";
import { isRenderableSponsor } from "@/lib/sponsors";
import { absolute } from "@/lib/site";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

// Sponsor clicks are tracked separately from affiliate/outbound clicks. The destination is always
// the stored sponsor URL, and only while the slot is still renderable (active, in date, complete).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = NextResponse.redirect(absolute("/"), { status: 302, headers: NO_STORE });
  if (!process.env.DATABASE_URL || !/^[a-z0-9]{8,40}$/.test(id)) return home;
  let slot;
  try {
    slot = await db.sponsorSlot.findUnique({ where: { id } });
  } catch {
    return home;
  }
  if (!slot || !isRenderableSponsor(slot) || !slot.url) return home;
  const campaign = campaignFromSearchParams(new URL(req.url).searchParams, null);
  after(() =>
    recordEvent({
      event: "sponsor_click",
      path: `/sponsor/${slot.id}`,
      productSlug: null,
      placement: slot.placement,
      pageType: campaign.pageType ?? slot.pageType,
      pageSlug: campaign.pageSlug,
      ctaType: null,
      sponsorId: slot.id,
      metadata: slot.campaign ? { campaign: slot.campaign.slice(0, 120) } : null,
    }),
  );
  return NextResponse.redirect(slot.url, { status: 302, headers: NO_STORE });
}
