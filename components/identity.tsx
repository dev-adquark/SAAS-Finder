import type { CSSProperties } from "react";

// Visual identity helpers. Products get a monogram tile tinted with their *category* accent —
// never a vendor logo or brand colour, which we don't claim to reproduce.

export const catStyle = (categorySlug: string): CSSProperties => ({ ["--cat" as string]: `var(--cat-${categorySlug}, var(--primary))` });

export function monogram(name: string): string {
  const words = name.replace(/\.com$/i, "").split(/[\s.-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Monogram({ name, categorySlug, size = "" }: { name: string; categorySlug: string; size?: "" | "sm" | "lg" }) {
  return (
    <span className={`mono ${size}`} style={catStyle(categorySlug)} aria-hidden="true">
      {monogram(name)}
    </span>
  );
}
