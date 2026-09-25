import type { CSSProperties } from "react";

// Visual identity. Products get a generated tile: category gradient, an abstract geometric motif
// chosen deterministically from the product slug, and initials. Never a vendor logo or brand
// colour, which we don't license or claim to reproduce.

export const catStyle = (categorySlug: string): CSSProperties => ({
  ["--cat" as string]: `var(--cat-${categorySlug}, var(--primary))`,
  ["--cat-2" as string]: `var(--cat2-${categorySlug}, var(--secondary))`,
});

export function monogram(name: string): string {
  const words = name.replace(/\.com$/i, "").split(/[\s.-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Six abstract motifs; purely decorative. */
function Motif({ seed }: { seed: number }) {
  const r = (seed % 5) * 9;
  switch (seed % 6) {
    case 0: return <g><circle cx="78" cy="22" r="26" /><circle cx="78" cy="22" r="14" /></g>;
    case 1: return <g transform={`rotate(${r} 50 50)`}><path d="M60 -5 L110 45 L110 105 Z" /><path d="M-10 70 L40 110 L-10 110 Z" /></g>;
    case 2: return <g>{[0, 1, 2, 3].map((i) => <circle key={i} cx={20 + i * 22} cy={82 - i * 6} r="6" />)}</g>;
    case 3: return <g transform={`rotate(${r} 50 50)`}><rect x="54" y="-14" width="44" height="44" rx="10" /><rect x="-6" y="66" width="30" height="30" rx="8" /></g>;
    case 4: return <g><path d="M-5 70 Q 30 40 60 70 T 110 60" fill="none" strokeWidth="7" /><path d="M-5 90 Q 30 60 60 90 T 110 80" fill="none" strokeWidth="7" /></g>;
    default: return <g><polygon points="72,-6 104,18 92,52 52,52 40,18" /><circle cx="18" cy="84" r="10" /></g>;
  }
}

export function Monogram({ name, categorySlug, size = "", slug }: { name: string; categorySlug: string; size?: "" | "sm" | "lg" | "xl"; slug?: string }) {
  const seed = hash(slug ?? name);
  return (
    <span className={`mono ${size}`} style={catStyle(categorySlug)} aria-hidden="true">
      <svg className="mono-motif" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Motif seed={seed} />
      </svg>
      <span className="mono-letters">{monogram(name)}</span>
    </span>
  );
}
