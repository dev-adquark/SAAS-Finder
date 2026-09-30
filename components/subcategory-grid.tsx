"use client";
import { useState, type ReactNode } from "react";
import { CardSlider } from "@/components/card-slider";

export type SubcategoryItem = { subcategory: string; node: ReactNode };

/**
 * Refinement sidebar over a server-rendered card grid: real subcategories already present on the
 * products in this category (never invented), not a second fake taxonomy layer. SSR/no-JS shows
 * every card; the sidebar only filters after hydration.
 *
 * `icon` is the parent category's own icon, reused on every row (including "All"): subcategories are
 * free text with no real per-item icon set of their own, so a different icon per row would mean
 * guessing one — the honest option is showing which category every row still belongs to.
 */
export function SubcategoryGrid({ items, label, icon }: { items: SubcategoryItem[]; label: string; icon?: ReactNode }) {
  const subcats = [...new Set(items.map((i) => i.subcategory))];
  const [active, setActive] = useState<string | null>(null);
  const visible = active ? items.filter((i) => i.subcategory === active) : items;
  const cardsLabel = label.replace(/^Filter /, "").replace(/ by type$/, "");
  if (subcats.length < 2) return <CardSlider label={`${cardsLabel} tools`}>{items.map((i) => i.node)}</CardSlider>;
  return (
    <div className="subcat-explorer">
      <nav className="subcat-list" aria-label={label}>
        <button type="button" className={`subcat-item${active === null ? " active" : ""}`} onClick={() => setActive(null)}>
          <span className="subcat-label">{icon}All</span> <span className="subcat-count">{items.length}</span>
        </button>
        {subcats.map((s) => (
          <button type="button" key={s} className={`subcat-item${active === s ? " active" : ""}`} onClick={() => setActive(s)}>
            <span className="subcat-label">{icon}{s}</span> <span className="subcat-count">{items.filter((i) => i.subcategory === s).length}</span>
          </button>
        ))}
      </nav>
      <CardSlider label={`${active ?? cardsLabel} tools`} resetKey={active ?? "all"}>{visible.map((i) => i.node)}</CardSlider>
    </div>
  );
}
