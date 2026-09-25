import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSponsorPageType, isSponsorPlacement, pickSponsor, sponsorDisplayLabel } from "@/lib/sponsors";

// Public, read-only feed of the single sponsor slot that may render for a page type + placement.
// Evaluated per request so inactive or expired sponsors disappear immediately.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pageType = url.searchParams.get("pageType");
  const placement = url.searchParams.get("placement");
  if (!isSponsorPageType(pageType) || !isSponsorPlacement(placement)) return NextResponse.json({ sponsor: null }, { status: 400 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ sponsor: null });
  try {
    const slots = await db.sponsorSlot.findMany({ where: { active: true, pageType, placement }, take: 20 });
    const s = pickSponsor(slots, pageType, placement);
    return NextResponse.json(
      { sponsor: s ? { id: s.id, title: s.title, label: sponsorDisplayLabel(s.label), description: s.description } : null },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ sponsor: null });
  }
}
