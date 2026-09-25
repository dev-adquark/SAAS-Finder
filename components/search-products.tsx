"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

export type SearchItem = { slug: string; href: string; name: string; category: string; tagline: string; keywords: string };

/** Progressive enhancement: the full list is server-rendered; typing only filters it. */
export function SearchProducts({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((p) => `${p.name} ${p.category} ${p.tagline} ${p.keywords}`.toLowerCase().includes(needle)) : items;
  }, [items, q]);
  return (
    <>
      <div className="searchbar">
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <input id="product-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, categories or use cases…" />
      </div>
      <div className="grid">
        {list.map((p) => (
          <Link className="card" key={p.slug} href={p.href}>
            <span className="tag">{p.category}</span>
            <h2 className="product-title">{p.name}</h2>
            <p className="product-desc">{p.tagline}</p>
          </Link>
        ))}
      </div>
      {!list.length && <div className="empty">No matching products.</div>}
    </>
  );
}
