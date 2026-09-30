"use client";
import { useState, type ReactNode } from "react";

export type SubcategoryItem = { subcategory: string; node: ReactNode };

/**
 * Refinement sidebar over a server-rendered card grid: real subcategories already present on the
 * products in this category (never invented), not a second fake taxonomy layer. SSR/no-JS shows
 * every card; the sidebar only filters after hydration.
 */
export function SubcategoryGrid({ items, label }: { items: SubcategoryItem[]; label: string }) {
  const subcats = [...new Set(items.map((i) => i.subcategory))];
  const [active, setActive] = useState<string | null>(null);
  const visible = active ? items.filter((i) => i.subcategory === active) : items;
  if (subcats.length < 2) return <div className="discover-grid">{items.map((i) => i.node)}</div>;
  return (
    <div className="subcat-explorer">
      <nav className="subcat-list" aria-label={label}>
        <button type="button" className={`subcat-item${active === null ? " active" : ""}`} onClick={() => setActive(null)}>
          All <span className="subcat-count">{items.length}</span>
        </button>
        {subcats.map((s) => (
          <button type="button" key={s} className={`subcat-item${active === s ? " active" : ""}`} onClick={() => setActive(s)}>
            {s} <span className="subcat-count">{items.filter((i) => i.subcategory === s).length}</span>
          </button>
        ))}
      </nav>
      <div className="discover-grid">{visible.map((i) => i.node)}</div>
    </div>
  );
}
