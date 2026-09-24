import Link from "next/link";
import { db } from "@/lib/db";

export async function SponsorSlot() {
  if (!process.env.DATABASE_URL) return null;

  const now = new Date();
  const sponsor = await db.sponsorSlot.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!sponsor) return null;

  return (
    <aside className="sponsor">
      <div className="sponsor-label">{sponsor.label || "Sponsored"}</div>
      <strong>{sponsor.name}</strong>
      <p className="muted">
        Sponsored placement is commercially separate from editorial ratings and methodology.
      </p>
      {sponsor.url && (
        <Link
          className="btn secondary"
          href={sponsor.url}
          target="_blank"
          rel="nofollow sponsored noopener"
        >
          View sponsor ↗
        </Link>
      )}
    </aside>
  );
}
