import type { Catalog, Product } from "@/lib/content/types";
import { alternativesFor, findCategory, guidesForProduct } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";
import { monogram } from "@/components/identity";

/**
 * Alternatives network: product → curated alternatives → category → best-for guides.
 * Every node and edge is a stored relationship; every node is a link to its page.
 */
export function AltNetwork({ c, product, compact = false }: { c: Catalog; product: Product; compact?: boolean }) {
  const alts = alternativesFor(c, product).slice(0, 4).map((a) => a.product);
  const category = findCategory(c, product.categorySlug);
  const guides = guidesForProduct(c, product.slug).slice(0, compact ? 2 : 3);
  const W = 960;
  const rowH = 70;
  const rows = Math.max(alts.length, guides.length, 3);
  const H = rows * rowH + 40;
  const mid = H / 2;
  const col = compact ? [90, 360, 620, 860] : [100, 370, 630, 860];
  const y = (i: number, n: number) => mid + (i - (n - 1) / 2) * rowH;
  const node = (x: number, yy: number, w: number, label: string, href: string, kind: string, key: string) => (
    <a key={key} href={href} className={`net-node net-${kind}`}>
      <rect x={x - w / 2} y={yy - 22} width={w} height="44" rx="14" />
      <text x={x} y={yy + 5} textAnchor="middle">{label.length > 24 ? `${label.slice(0, 23)}…` : label}</text>
    </a>
  );
  return (
    <svg className="altnet" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${product.name}: ${alts.length} curated alternatives, ${category?.name} category and ${guides.length} best-for guides`}>
      <defs>
        <linearGradient id={`g-${product.slug}`} x1="0" x2="1"><stop offset="0" stopColor="var(--cat)" /><stop offset="1" stopColor="var(--cat-2)" /></linearGradient>
      </defs>
      {alts.map((a, i) => <path key={`e1${a.slug}`} className="net-edge" d={`M${col[0] + 70} ${mid} C ${col[0] + 150} ${mid}, ${col[1] - 150} ${y(i, alts.length)}, ${col[1] - 95} ${y(i, alts.length)}`} />)}
      {alts.map((a, i) => <path key={`e2${a.slug}`} className="net-edge" d={`M${col[1] + 95} ${y(i, alts.length)} C ${col[1] + 170} ${y(i, alts.length)}, ${col[2] - 150} ${mid}, ${col[2] - 80} ${mid}`} />)}
      {guides.map((g, i) => <path key={`e3${g.slug}`} className="net-edge alt" d={`M${col[2] + 80} ${mid} C ${col[2] + 130} ${mid}, ${col[3] - 150} ${y(i, guides.length)}, ${col[3] - 100} ${y(i, guides.length)}`} />)}
      <a href={routes.product(product.slug)} className="net-node net-primary">
        <rect x={col[0] - 80} y={mid - 30} width="160" height="60" rx="18" fill={`url(#g-${product.slug})`} />
        <text x={col[0]} y={mid + 6} textAnchor="middle">{product.name}</text>
      </a>
      {alts.map((a, i) => node(col[1], y(i, alts.length), 190, `${monogram(a.name)} · ${a.name}`, routes.product(a.slug), "alt", a.slug))}
      {category && node(col[2], mid, 160, category.name, routes.category(category.slug), "cat", "cat")}
      {guides.map((g, i) => node(col[3], y(i, guides.length), 200, g.title.replace(/^Best /, ""), routes.best(g.slug), "guide", g.slug))}
      <g className="net-legend" aria-hidden="true">
        <text x={col[0]} y="18" textAnchor="middle">Product</text>
        <text x={col[1]} y="18" textAnchor="middle">Alternatives</text>
        <text x={col[2]} y="18" textAnchor="middle">Category</text>
        <text x={col[3]} y="18" textAnchor="middle">Best-for guides</text>
      </g>
    </svg>
  );
}
