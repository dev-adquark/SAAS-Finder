import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const allowedEvents = new Set([
  "affiliate_click",
  "cta_click",
  "sponsor_click",
  "cpl_submit",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body?.event !== "string" || !allowedEvents.has(body.event)) {
      return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
    }

    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
    const productSlug = typeof body.productSlug === "string" ? body.productSlug.slice(0, 200) : null;
    const placement = typeof body.placement === "string" ? body.placement.slice(0, 200) : null;
    const metadata = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;

    if (process.env.DATABASE_URL) {
      await db.analyticsEvent.create({
        data: { event: body.event, path, productSlug, placement, metadata },
      });
    } else {
      console.info("[analytics]", JSON.stringify({ event: body.event, path, productSlug, placement, metadata }));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
