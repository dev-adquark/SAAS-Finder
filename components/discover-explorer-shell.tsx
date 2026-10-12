"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import type { DiscoverCategory } from "@/components/discover-explorer";

const DiscoverExplorer = dynamic(() => import("@/components/discover-explorer").then((m) => m.DiscoverExplorer), { ssr: false, loading: () => null });

/**
 * Client-only boundary for DiscoverExplorer (see that file's comment for why). A no-JS/pre-hydration
 * visitor still gets real, crawlable navigation — one link per category — instead of nothing; it's
 * replaced by the full tabbed explorer once JS loads. This costs full-catalog SSR of the category
 * explorer specifically; product and category pages (the canonical SEO destination for the full
 * per-product listings this section otherwise duplicated) are unaffected — this is homepage discovery
 * UI, not those pages' content.
 */
export function DiscoverExplorerShell({ categories }: { categories: DiscoverCategory[] }) {
  return (
    <>
      {/* Only ever rendered by browsers that don't run JS at all — never flashes for everyone else
          while the chunk above loads, and never shows alongside it once mounted. */}
      <noscript>
        <nav className="discover-fallback" aria-label="Browse products by category">
          {categories.map((cat) => (
            <Link key={cat.slug} href={routes.category(cat.slug)}>{cat.name} <span className="tiny muted">{cat.products.length}</span></Link>
          ))}
        </nav>
      </noscript>
      <DiscoverExplorer categories={categories} />
    </>
  );
}
