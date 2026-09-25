import type { CSSProperties } from "react";
import type { Catalog } from "@/lib/content/types";
import { productsInCategory } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";
import { catStyle, monogram } from "@/components/identity";
import { AtlasMotion } from "@/components/atlas/atlas-motion";

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/**
 * "The SaaS Atlas" hero installation (CSS 3D). Each category is a ribbon on a tilted plane; each
 * product is a tile on its category's ribbon (a real link to its review). Lines connect curated
 * comparison pairs; pins mark products with evidence-verified pricing. Tile heights are decorative.
 */
export function Atlas({ c }: { c: Catalog }) {
  const rows = c.categories;
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((cat, r) => {
    const items = productsInCategory(c, cat.slug);
    const y = 12 + (r * 76) / Math.max(rows.length - 1, 1);
    items.forEach((p, i) => pos.set(p.slug, { x: 22 + (i + 0.5) * (70 / Math.max(items.length, 1)), y }));
  });
  const lines = c.pairs
    .map((pair) => ({ a: pos.get(pair.productA), b: pos.get(pair.productB), slug: pair.slug }))
    .filter((l): l is { a: { x: number; y: number }; b: { x: number; y: number }; slug: string } => Boolean(l.a && l.b));
  const verified = c.products.filter((p) => p.pricing.length > 0).length;
  let t = 0;
  return (
    <div className="atlas" data-atlas>
      <p className="atlas-caption" aria-hidden="true"><b>{c.products.length}</b>tools mapped</p>
      <div className="atlas-stage">
        <div className="atlas-plane" />
        {rows.map((cat, r) => (
          <div key={cat.slug} className="atlas-ribbon" style={{ ...catStyle(cat.slug), top: `calc(${12 + (r * 76) / Math.max(rows.length - 1, 1)}% - 8%)`, ["--i" as string]: r } as CSSProperties} aria-hidden="true">
            <span>{String(r + 1).padStart(2, "0")} · {cat.name}</span>
          </div>
        ))}
        <svg className="atlas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((l, i) => {
            const mx = (l.a.x + l.b.x) / 2;
            const my = Math.min(l.a.y, l.b.y) - 6 - (i % 3) * 2;
            return <path key={l.slug} d={`M${l.a.x} ${l.a.y} Q ${mx} ${my} ${l.b.x} ${l.b.y}`} style={{ ["--i" as string]: i } as CSSProperties} />;
          })}
        </svg>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Tools on the atlas">
          {rows.flatMap((cat) =>
            productsInCategory(c, cat.slug).map((p) => {
              const at = pos.get(p.slug)!;
              const z = 12 + (hash(p.slug) % 18);
              return (
                <li key={p.slug} className="atlas-tile" style={{ ...catStyle(p.categorySlug), left: `${at.x}%`, top: `${at.y}%`, ["--z" as string]: `${z}px`, ["--i" as string]: t++ } as CSSProperties}>
                  <span className="shadow" aria-hidden="true" />
                  <a href={routes.product(p.slug)} aria-label={`${p.name} review`}><span>{monogram(p.name)}</span></a>
                  {p.pricing.length > 0 && <span className="pin" aria-hidden="true">✓</span>}
                </li>
              );
            }),
          )}
        </ul>
      </div>
      <div className="atlas-legend" aria-hidden="true">
        {rows.map((cat) => <span key={cat.slug} style={catStyle(cat.slug)}><i style={{ background: "var(--cat)" }} />{cat.name}</span>)}
        <span><i className="line-key" />{lines.length} comparisons</span>
        <span><i className="pin-key" />{verified} pricing verified</span>
      </div>
      <AtlasMotion />
    </div>
  );
}
