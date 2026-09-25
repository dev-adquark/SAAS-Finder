import { monogram } from "@/components/identity";

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/**
 * Generated product identity (decorative SVG): category-coloured geometric composition with the
 * product's initials. Deterministic per slug; never a vendor logo or brand asset.
 */
export function IdVisual({ name, slug }: { name: string; slug: string }) {
  const h = hash(slug);
  const rot = (h % 40) - 20;
  const variant = h % 3;
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
        <rect className="iv-a float-a" x="70" y="100" width="190" height="190" rx="26" />
        <path className="iv-c" d="M40 300 L320 60" strokeDasharray="3 6" />
        <text className="iv-t" x="165" y="232" textAnchor="middle">{monogram(name)}</text>
      </svg>
    </div>
  );
}
