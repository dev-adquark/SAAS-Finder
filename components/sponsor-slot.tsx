"use client";
import { useEffect, useState } from "react";
import { campaignQuery } from "@/lib/analytics";
import type { SponsorPageType, SponsorPlacement } from "@/lib/sponsors";

type Sponsor = { id: string; title: string; label: string; description: string | null };

// Sponsor slots are fetched at view time so inactive or expired sponsors never render from a
// cached page. They are visually and technically separate from editorial content.
export function SponsorSlot({ pageType, pageSlug, placement = "sidebar" }: { pageType: SponsorPageType; pageSlug: string; placement?: SponsorPlacement }) {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/sponsors?pageType=${pageType}&placement=${placement}`)
      .then((r) => (r.ok ? r.json() : { sponsor: null }))
      .then((d: { sponsor: Sponsor | null }) => live && setSponsor(d.sponsor?.id && d.sponsor.title && /sponsored/i.test(d.sponsor.label) ? d.sponsor : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pageType, placement]);
  if (!sponsor) return null;
  return (
    <aside className="sponsor" aria-label="Sponsored placement" data-sponsor-slot={placement}>
      <div className="sponsor-label">{sponsor.label}</div>
      <strong>{sponsor.title}</strong>
      {sponsor.description && <p className="muted small">{sponsor.description}</p>}
      <p className="muted small">Paid placement. It does not affect our editorial selections, rankings or scores.</p>
      <a className="btn secondary" href={`/sponsor/${sponsor.id}${campaignQuery({ pageType, pageSlug, placement })}`} target="_blank" rel="sponsored nofollow noopener">
        Visit sponsor ↗
      </a>
    </aside>
  );
}
