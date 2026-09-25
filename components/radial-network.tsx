import type { Catalog, Product } from "@/lib/content/types";
import { alternativesFor, findCategory, guidesForProduct } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";
import { catStyle } from "@/components/identity";

/**
 * Radial alternatives map: primary product at the centre, its curated alternatives around it,
 * and the category and best-for guides on an outer orbit. Only stored relationships; every
 * node links to its existing page.
 */
export function RadialNetwork({ c, product }: { c: Catalog; product: Product }) {
  const alts = alternativesFor(c, product).slice(0, 6).map((a) => a.product);
  const category = findCategory(c, product.categorySlug);
  const guides = guidesForProduct(c, product.slug).slice(0, 2);
  const cx = 360;
  const cy = 250;
  const R1 = 165;
  const R2 = 232;
  const at = (i: number, n: number, r: number, offset = -Math.PI / 2) => {
    const a = offset + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.78 };
  };
  // Outer ring sits midway between alternative spokes so nodes never overlap.
  const outerOffset = -Math.PI / 2 + Math.PI / Math.max(alts.length, 1);
  const outer = [...(category ? [{ label: category.name, sub: "Category", href: routes.category(category.slug), kind: "cat" }] : []), ...guides.map((g) => ({ label: `For ${g.audience.toLowerCase()}`, sub: "Best-for guide", href: routes.best(g.slug), kind: "guide" }))];
  return (
    <svg className="radnet" viewBox="0 0 720 500" role="img" aria-label={`${product.name} and ${alts.length} curated alternatives`} style={catStyle(product.categorySlug)}>
      <ellipse className="orbit" cx={cx} cy={cy} rx={R1} ry={R1 * 0.78} />
      <ellipse className="orbit" cx={cx} cy={cy} rx={R2} ry={R2 * 0.78} />
      {alts.map((a, i) => { const p = at(i, alts.length, R1); return <path key={`s${a.slug}`} className="spoke" d={`M${cx} ${cy} L${p.x} ${p.y}`} />; })}
      {outer.map((o, i) => { const p = at(i, outer.length, R2, outerOffset); return <path key={`o${o.href}`} className="spoke" style={{ opacity: 0.45 }} d={`M${cx} ${cy} L${p.x} ${p.y}`} />; })}
      <a href={routes.product(product.slug)} className="rn-node rn-center">
        <rect x={cx - 78} y={cy - 26} width="156" height="52" rx="26" />
        <text x={cx} y={cy + 7} textAnchor="middle">{product.name}</text>
      </a>
      {alts.map((a, i) => {
        const p = at(i, alts.length, R1);
        const w = Math.max(96, a.name.length * 8.5 + 28);
        return (
          <a key={a.slug} href={routes.product(a.slug)} className="rn-node">
            <rect x={p.x - w / 2} y={p.y - 22} width={w} height="44" rx="22" />
            <text x={p.x} y={p.y - 2} textAnchor="middle">{a.name}</text>
            <text className="rn-sub" x={p.x} y={p.y + 13} textAnchor="middle">Alternative</text>
          </a>
        );
      })}
      {outer.map((o, i) => {
        const p = at(i, outer.length, R2, outerOffset);
        const w = Math.max(120, o.label.length * 7.6 + 30);
        return (
          <a key={o.href} href={o.href} className={`rn-node ${o.kind === "cat" ? "rn-cat" : ""}`}>
            <rect x={p.x - w / 2} y={p.y - 22} width={w} height="44" rx="8" />
            <text x={p.x} y={p.y - 2} textAnchor="middle">{o.label}</text>
            <text className="rn-sub" x={p.x} y={p.y + 13} textAnchor="middle">{o.sub}</text>
          </a>
        );
      })}
    </svg>
  );
}
