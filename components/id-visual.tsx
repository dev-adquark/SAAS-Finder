import { monogram } from "@/components/identity";
import { IdVisualLogo } from "@/components/id-visual-logo";
import { LOGOS } from "@/lib/content/logos";
import type { LogoRef } from "@/lib/content/types";
import { logoSrc } from "@/lib/logos/logo-dev";

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/**
 * Product identity (decorative SVG; the product name is the page heading): category-coloured
 * geometric composition around the company logo (Logo.dev for the official domain, else the vendor
 * icon on file in lib/content/logos), otherwise the product's initials. Deterministic per slug.
 */
export function IdVisual({ name, slug, logo }: { name: string; slug: string; logo?: LogoRef | null }) {
  const h = hash(slug);
  const rot = (h % 40) - 20;
  const variant = h % 3;
  const local = LOGOS[slug];
  const showLocal = !!local && local.px >= 110; // the centre tile renders at ~120px
  return (
    <div className="id-visual" aria-hidden="true">
      <svg viewBox="0 0 360 360">
        <g className="orbit-g">
          <circle className="iv-d" cx="180" cy="180" r="168" />
          <circle cx="180" cy="12" r="6" className="iv-b" />
          <circle cx="348" cy="180" r="4" className="iv-a" />
        </g>
        <circle className="iv-c" cx="180" cy="180" r="132" />
        {variant === 0 && <rect className="iv-b float-b" x="196" y="64" width="112" height="112" rx="14" transform={`rotate(${rot} 252 120)`} />}
        {variant === 1 && <polygon className="iv-b float-b" points="250,54 316,176 184,176" />}
        {variant === 2 && <circle className="iv-b float-b" cx="262" cy="110" r="58" />}
        <IdVisualLogo remote={logo ? logoSrc(logo.base, 120) : null} local={showLocal ? local.src : null} letters={monogram(name)} between={<path className="iv-c" d="M40 300 L320 60" strokeDasharray="3 6" />} />
      </svg>
    </div>
  );
}
