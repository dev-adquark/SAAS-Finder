"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type SearchItem = { slug: string; href: string; name: string; category: string; categorySlug: string; tagline: string; keywords: string; mono: string };

/**
 * Progressive enhancement: the full list is server-rendered (see the <noscript>-free SSR grid);
 * typing or picking a category only filters it. Honours `?q=` from the homepage search form.
 */
type Props = { items: SearchItem[]; categories: { slug: string; name: string }[]; initialQuery?: string };

/** Reads `?q=` (from the homepage search form). Render inside <Suspense>; the fallback is the full list. */
export function SearchProductsFromUrl(props: Omit<Props, "initialQuery">) {
  const q = (useSearchParams().get("q") ?? "").slice(0, 100);
  return <SearchProducts key={q} {...props} initialQuery={q} />;
}

export function SearchProducts({ items, categories, initialQuery = "" }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState("all");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => (cat === "all" || p.categorySlug === cat) && (!needle || `${p.name} ${p.category} ${p.tagline} ${p.keywords}`.toLowerCase().includes(needle)));
  }, [items, q, cat]);
  return (
    <>
      <div className="searchbar">
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <input id="product-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, categories or use cases…" />
      </div>
      <div className="filters" role="group" aria-label="Filter by category">
        {[{ slug: "all", name: "All" }, ...categories].map((c) => (
          <button key={c.slug} type="button" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</button>
        ))}
      </div>
      <p className="small muted" aria-live="polite">{list.length} of {items.length} reviews</p>
      <div className="grid four">
        {list.map((p) => (
          <Link className="card pcard accent-top" key={p.slug} href={p.href} style={{ ["--cat" as string]: `var(--cat-${p.categorySlug}, var(--primary))` }}>
            <div className="pcard-head">
              <span className="mono" aria-hidden="true">{p.mono}</span>
              <div><h2 style={{ fontSize: "1.1rem", margin: 0 }}>{p.name}</h2><div className="sub">{p.category}</div></div>
            </div>
            <p>{p.tagline}</p>
          </Link>
        ))}
      </div>
      {!list.length && <div className="empty">No matching products. Try a category or press ⌘K to search everything.</div>}
    </>
  );
}
