"use client";
import { useEffect, useState } from "react";
import { campaignQuery } from "@/lib/analytics";
import type { SponsorPageType, SponsorPlacement } from "@/lib/sponsors";

type Sponsor = { id: string; title: string; label: string; description: string | null; logoUrl: string | null; ctaLabel: string | null };

// Sponsor slots are fetched at view time so inactive or expired sponsors never render from a
// cached page. They are visually and technically separate from editorial content.
export function SponsorSlot({ pageType, pageSlug, placement = "sidebar" }: { pageType: SponsorPageType; pageSlug: string; placement?: SponsorPlacement }) {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [logoOk, setLogoOk] = useState(true);
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
    <aside className={`sponsor sponsor-${placement}`} aria-label="Sponsored placement" data-sponsor-slot={placement}>
      <div className="sponsor-label">{sponsor.label}</div>
      <div className="sponsor-head">
        {sponsor.logoUrl && logoOk && (
          // eslint-disable-next-line @next/next/no-img-element -- external, admin-supplied sponsor logo; not part of the optimized product-image pipeline.
          <img className="sponsor-logo" src={sponsor.logoUrl} alt={`${sponsor.title} logo`} loading="lazy" onError={() => setLogoOk(false)} />
        )}
        <strong className="sponsor-title">{sponsor.title}</strong>
      </div>
      {sponsor.description && <p className="sponsor-desc">{sponsor.description}</p>}
      <p className="sponsor-disclosure">Paid placement. It does not affect our editorial selections, rankings or scores.</p>
      <a className="btn primary sponsor-cta" href={`/sponsor/${sponsor.id}${campaignQuery({ pageType, pageSlug, placement })}`} target="_blank" rel="sponsored nofollow noopener">
        {sponsor.ctaLabel?.trim() || "Visit sponsor"} <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}
