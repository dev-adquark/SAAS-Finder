import type { Catalog, Product } from "@/lib/content/types";
import { alternativesFor, findCategory, guidesForProduct } from "@/lib/catalog";
import { routes } from "@/lib/seo/routes";
import { catStyle } from "@/components/identity";

// Approximate advance width per character (px) for each label style in .radnet (globals.css), with a
// safety margin so estimates err wide. Sub-labels use the 12px mobile floor, their largest size.
const CHAR = { body: 8.1, display: 11.6, catMono: 7.4, sub: 8.6 };
const LINE = { body: 16, display: 24 };
const MAX_LINE_CHARS = { node: 20, center: 18, cat: 22 };

/** Greedy word wrap into at most `max` lines; the last line is ellipsised if text remains. */
export function wrapLabel(text: string, perLine: number, max = 3): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= perLine || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  const rest = lines.slice(max - 1).join(" ");
  kept[max - 1] = rest.length > perLine ? `${rest.slice(0, Math.max(1, perLine - 1)).trimEnd()}…` : rest;
  return kept;
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box, gap = 10) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap * 2;

/**
 * Radial alternatives map: primary product at the centre, its curated alternatives around it,
 * and the category and best-for guides on an outer orbit. Only stored relationships; every
 * node links to its existing page. Node sizes follow their (wrapped) labels and positions are
 * resolved so no two nodes overlap, whatever the product and guide names.
 */
export function RadialNetwork({ c, product }: { c: Catalog; product: Product }) {
  const alts = alternativesFor(c, product).slice(0, 6).map((a) => a.product);
  const category = findCategory(c, product.categorySlug);
  const guides = guidesForProduct(c, product.slug).slice(0, 2);
  const cx = 360;
  const cy = 250;
  const squash = 0.78;
  const at = (i: number, n: number, r: number, offset = -Math.PI / 2) => {
    const a = offset + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash };
  };

  const centerLines = wrapLabel(product.name, MAX_LINE_CHARS.center);
  const centerW = Math.max(156, Math.max(...centerLines.map((l) => l.length)) * CHAR.display + 44);
  const centerH = Math.max(52, centerLines.length * LINE.display + 24);
  const center: Box = { x: cx, y: cy, w: centerW, h: centerH };

  const altNodes = alts.map((a) => {
    const lines = wrapLabel(a.name, MAX_LINE_CHARS.node);
    const w = Math.max(96, Math.max(...lines.map((l) => l.length)) * CHAR.body + 30, "Alternative".length * CHAR.sub + 30);
    return { a, lines, w, h: lines.length * LINE.body + 30 };
  });
  // Widen the inner orbit until alternatives clear each other and the centre.
  let R1 = 165;
  for (let tries = 0; tries < 30; tries++) {
    const boxes = altNodes.map((n, i) => ({ ...at(i, altNodes.length, R1), w: n.w, h: n.h }));
    if (!boxes.some((b, i) => overlaps(b, center) || boxes.some((o, j) => j > i && overlaps(b, o)))) break;
    R1 += 10;
  }
  const altPlaced = altNodes.map((n, i) => ({ ...n, ...at(i, altNodes.length, R1) }));

  // Outer ring: category and guides. Preferred angle sits midway between alternative spokes; if that
  // spot collides, take the nearest free angle on the ring (then on a slightly wider ring).
  const outerDefs = [
    ...(category ? [{ label: category.name, sub: "Category", href: routes.category(category.slug), kind: "cat" as const }] : []),
    ...guides.map((g) => ({ label: `For ${g.audience.toLowerCase()}`, sub: "Best-for guide", href: routes.best(g.slug), kind: "guide" as const })),
  ];
  const R2base = Math.max(232, R1 + 67);
  const outerOffset = -Math.PI / 2 + Math.PI / Math.max(alts.length, 1);
  const placed: Box[] = [center, ...altPlaced.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }))];
  const outerPlaced = outerDefs.map((o, i) => {
    const cat = o.kind === "cat";
    const lines = wrapLabel(o.label, cat ? MAX_LINE_CHARS.cat : MAX_LINE_CHARS.node);
    const w = Math.max(120, Math.max(...lines.map((l) => l.length)) * (cat ? CHAR.catMono : CHAR.body) + 32, o.sub.length * CHAR.sub + 32);
    const h = lines.length * LINE.body + 30;
    const preferred = outerOffset + (i / Math.max(outerDefs.length, 1)) * Math.PI * 2;
    let spot = { x: 0, y: 0, r: R2base };
    search: for (const r of [R2base, R2base + 30, R2base + 60, R2base + 100]) {
      for (let step = 0; step <= 36; step++) {
        for (const sign of step ? [1, -1] : [1]) {
          const a = preferred + sign * step * (Math.PI / 36);
          const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash };
          if (!placed.some((b) => overlaps({ ...p, w, h }, b))) {
            spot = { ...p, r };
            break search;
          }
        }
      }
      const a = preferred;
      spot = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash, r };
    }
    placed.push({ x: spot.x, y: spot.y, w, h });
    return { ...o, lines, w, h, x: spot.x, y: spot.y };
  });
  const R2 = Math.max(R2base, ...outerPlaced.map((o) => Math.hypot(o.x - cx, (o.y - cy) / squash)));

  // Fit the drawing: every node plus both orbits, with a small margin.
  const pad = 12;
  const minX = Math.min(cx - R2, ...placed.map((b) => b.x - b.w / 2)) - pad;
  const maxX = Math.max(cx + R2, ...placed.map((b) => b.x + b.w / 2)) + pad;
  const minY = Math.min(cy - R2 * squash, ...placed.map((b) => b.y - b.h / 2)) - pad;
  const maxY = Math.max(cy + R2 * squash, ...placed.map((b) => b.y + b.h / 2)) + pad;
  const vb = `${Math.floor(minX)} ${Math.floor(minY)} ${Math.ceil(maxX - minX)} ${Math.ceil(maxY - minY)}`;

  /** Label lines centred on the node, followed by the small sub-label. */
  const labelBlock = (x: number, y: number, lines: string[], sub: string | null, lh: number) => {
    const total = lines.length * lh + (sub ? 14 : 0);
    const top = y - total / 2 + lh * 0.72;
    return (
      <>
        <text x={x} y={top} textAnchor="middle">
          {lines.map((l, k) => <tspan key={k} x={x} dy={k ? lh : 0}>{l}</tspan>)}
        </text>
        {sub && <text className="rn-sub" x={x} y={top + (lines.length - 1) * lh + 17} textAnchor="middle">{sub}</text>}
      </>
    );
  };

  return (
    <svg className="radnet" viewBox={vb} role="img" aria-label={`${product.name} and ${alts.length} curated alternatives`} style={catStyle(product.categorySlug)}>
      <ellipse className="orbit" cx={cx} cy={cy} rx={R1} ry={R1 * squash} />
      <ellipse className="orbit" cx={cx} cy={cy} rx={R2} ry={R2 * squash} />
      {altPlaced.map((n) => <path key={`s${n.a.slug}`} className="spoke" d={`M${cx} ${cy} L${n.x} ${n.y}`} />)}
      {outerPlaced.map((o) => <path key={`o${o.href}`} className="spoke" style={{ opacity: 0.45 }} d={`M${cx} ${cy} L${o.x} ${o.y}`} />)}
      <defs>
        <linearGradient id="rn-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ink)" /><stop offset="1" stopColor="var(--cat)" />
        </linearGradient>
      </defs>
      <ellipse className="halo" cx={cx} cy={cy} rx={centerW / 2 + 6} ry={centerH / 2 + 6} />
      <ellipse className="halo h2" cx={cx} cy={cy} rx={centerW / 2 + 6} ry={centerH / 2 + 6} />
      {altPlaced.map((n, i) => {
        const out = i % 2 === 0;
        return (
          <circle key={`g${n.a.slug}`} className={`signal${out ? "" : " alt"}`} r="3.5" aria-hidden="true">
            <animateMotion dur={`${3.2 + (i % 3) * 0.7}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" path={out ? `M${cx} ${cy} L${n.x} ${n.y}` : `M${n.x} ${n.y} L${cx} ${cy}`} />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur={`${3.2 + (i % 3) * 0.7}s`} begin={`${i * 0.45}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
      <a href={routes.product(product.slug)} className="rn-node rn-center">
        <title>{product.name}</title>
        <rect x={cx - centerW / 2} y={cy - centerH / 2} width={centerW} height={centerH} rx={Math.min(26, centerH / 2)} />
        {labelBlock(cx, cy, centerLines, null, LINE.display)}
      </a>
      {altPlaced.map((n) => (
        <a key={n.a.slug} href={routes.product(n.a.slug)} className="rn-node">
          <title>{n.a.name}</title>
          <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx={Math.min(22, n.h / 2)} />
          {labelBlock(n.x, n.y, n.lines, "Alternative", LINE.body)}
        </a>
      ))}
      {outerPlaced.map((o) => (
        <a key={o.href} href={o.href} className={`rn-node ${o.kind === "cat" ? "rn-cat" : ""}`}>
          <title>{o.label}</title>
          <rect x={o.x - o.w / 2} y={o.y - o.h / 2} width={o.w} height={o.h} rx="8" />
          {labelBlock(o.x, o.y, o.lines, o.sub, LINE.body)}
        </a>
      ))}
    </svg>
  );
}
