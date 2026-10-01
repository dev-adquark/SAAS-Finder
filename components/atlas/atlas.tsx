import type { CSSProperties } from "react";
import type { Catalog, Product } from "@/lib/content/types";
import { productsInCategory } from "@/lib/catalog";
import { LOGOS } from "@/lib/content/logos";
import { logoSrc } from "@/lib/logos/logo-dev";
import { LogoImage } from "@/components/logo-image";
import { routes } from "@/lib/seo/routes";
import { catStyle, monogram } from "@/components/identity";
import { AtlasMotion } from "@/components/atlas/atlas-motion";

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Tiles per category ribbon: a curated selection keeps the map readable as the catalog grows. */
const PER_ROW = 3;

/**
 * The most prominent products of a category, from the site's own editorial data: how often a product
 * is compared head to head, picked in a best-for guide or listed as another product's alternative
 * (editorial score breaks ties). Two products sharing a company logo (same official domain) never
 * both appear, so no logo repeats on the map.
 */
export function atlasSelection(c: Catalog, categorySlug: string, limit = PER_ROW): Product[] {
  const refs = (slug: string) =>
    c.pairs.filter((p) => p.productA === slug || p.productB === slug).length * 2 +
    c.useCases.filter((u) => u.products.some((x) => x.slug === slug)).length +
    c.products.filter((o) => o.alternatives.some((a) => a.slug === slug)).length;
  const ranked = productsInCategory(c, categorySlug)
    .map((p) => ({ p, score: refs(p.slug), rating: p.review.rating ?? 0 }))
    .sort((a, b) => b.score - a.score || b.rating - a.rating || a.p.name.localeCompare(b.p.name));
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const { p } of ranked) {
    const brand = p.logo?.domain ?? p.slug;
    if (seen.has(brand)) continue;
    seen.add(brand);
    out.push(p);
    if (out.length === limit) break;
  }
  return out;
}

/** Tile face: the company logo on a small white badge (upright), else the initials as before. */
function TileFace({ p }: { p: Product }) {
  const initials = <span>{monogram(p.name)}</span>;
  const local = LOGOS[p.slug];
  const staticBadge = local ? (
    <span className="atlas-logo">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
      <img src={local.src} alt="" width={40} height={40} loading="lazy" decoding="async" />
    </span>
  ) : initials;
  if (!p.logo) return staticBadge;
  return <LogoImage src={logoSrc(p.logo.base, 40)} alt="" px={40} className="atlas-logo" fallback={staticBadge} />;
}

/**
 * "The SaaS Atlas" hero installation (CSS 3D). Each category is a ribbon on a tilted plane; each
 * ribbon carries a curated selection of its most prominent products (see atlasSelection) as tiles
 * showing the company logo (a real link to its review). Lines connect curated comparison pairs
 * between shown tiles; pins mark products with evidence-verified pricing. Tile heights are decorative.
 */
export function Atlas({ c }: { c: Catalog }) {
  const rows = c.categories;
  const shown = new Map(rows.map((cat) => [cat.slug, atlasSelection(c, cat.slug)]));
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((cat, r) => {
    const items = shown.get(cat.slug)!;
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
          <defs>
            <linearGradient id="atlas-spectrum" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
              <stop offset="0" stopColor="#2f5bff" /><stop offset="0.35" stopColor="#0c8f8a" /><stop offset="0.65" stopColor="#e8583a" /><stop offset="1" stopColor="#6d45e6" />
            </linearGradient>
          </defs>
          {lines.map((l, i) => {
            const mx = (l.a.x + l.b.x) / 2;
            const my = Math.min(l.a.y, l.b.y) - 6 - (i % 3) * 2;
            const d = `M${l.a.x} ${l.a.y} Q ${mx} ${my} ${l.b.x} ${l.b.y}`;
            return (
              <g key={l.slug}>
                <path d={d} style={{ ["--i" as string]: i } as CSSProperties} />
                <path className="pulse" d={d} pathLength={200} style={{ ["--i" as string]: i } as CSSProperties} />
              </g>
            );
          })}
        </svg>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Tools on the atlas">
          {rows.flatMap((cat) =>
            shown.get(cat.slug)!.map((p) => {
              const at = pos.get(p.slug)!;
              const z = 12 + (hash(p.slug) % 18);
              return (
                <li key={p.slug} className="atlas-tile" style={{ ...catStyle(p.categorySlug), left: `${at.x}%`, top: `${at.y}%`, ["--z" as string]: `${z}px`, ["--i" as string]: t++ } as CSSProperties}>
                  <span className="shadow" aria-hidden="true" />
                  <a href={routes.product(p.slug)} aria-label={`${p.name} review`}><TileFace p={p} /></a>
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
