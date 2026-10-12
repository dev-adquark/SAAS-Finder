"use client";
import Link from "next/link";
import type { AffiliateConfig, LogoRef } from "@/lib/content/types";
import { routes } from "@/lib/seo/routes";
import { Monogram, catStyle } from "@/components/identity";
import { IconCheck, IconStar, CategoryIcon } from "@/components/icons";
import { AffiliateCta } from "@/components/cta";
import { TabExplorer } from "@/components/tab-explorer";
import { SubcategoryGrid } from "@/components/subcategory-grid";

export type DiscoverProduct = {
  slug: string;
  name: string;
  subcategory: string;
  categorySlug: string;
  logo: LogoRef | null;
  affiliate: AffiliateConfig | null;
  rating: number | null;
  pricingLabel: string;
  pricingTone: string;
  sourcesCount: number;
  features: string[];
};
export type DiscoverCategory = { slug: string; name: string; description: string; products: DiscoverProduct[] };

/**
 * "Explore by category": the heaviest single section of the homepage (tabs over every category,
 * subcategory filters, card sliders — ~60% of the page's served weight, measured). Client-only
 * (loaded via next/dynamic with ssr:false in app/page.tsx — see the comment there for why): the data
 * shape here is plain, serializable product summaries rather than pre-rendered server markup, so this
 * section's cost is paid once JS loads instead of duplicated into the initial HTML/hydration payload.
 */
export function DiscoverExplorer({ categories }: { categories: DiscoverCategory[] }) {
  return (
    <TabExplorer
      label="Browse products by category"
      items={categories.map((cat) => ({ id: `discover-${cat.slug}`, label: cat.name, sub: `${cat.products.length} tools`, icon: <CategoryIcon slug={cat.slug} size={18} /> }))}
      panels={categories.map((cat) => (
        <div key={cat.slug} className="discover-panel">
          <div className="discover-panel-intro">
            <p>{cat.description}</p>
            <Link className="explore" href={routes.category(cat.slug)}>Explore all {cat.products.length} {cat.name} tools <span className="arrow-right" aria-hidden="true">→</span></Link>
          </div>
          <SubcategoryGrid
            items={cat.products.map((p) => ({ subcategory: p.subcategory, node: <DiscoverCard key={p.slug} p={p} catSlug={cat.slug} /> }))}
            label={`Filter ${cat.name} by type`}
            icon={<CategoryIcon slug={cat.slug} size={15} />}
          />
        </div>
      ))}
    />
  );
}

function DiscoverCard({ p, catSlug }: { p: DiscoverProduct; catSlug: string }) {
  return (
    <article className="discover-tile" style={catStyle(p.categorySlug)}>
      <div className="discover-tile-head">
        <Monogram name={p.name} slug={p.slug} logo={p.logo} categorySlug={p.categorySlug} />
        <div>
          <h3><Link href={routes.product(p.slug)}>{p.name}</Link></h3>
          <span className="tiny muted">{p.subcategory}</span>
        </div>
      </div>
      <span className="chip-row">
        {typeof p.rating === "number" ? (
          <span className="rating" title="FindMy.tech editorial score — see methodology">
            <IconStar className="star" size={15} fill="currentColor" /> {p.rating.toFixed(1)} <span className="muted tiny">/5 editorial</span>
          </span>
        ) : (
          <span className="status neutral">Not yet scored</span>
        )}
        <span className={`status ${p.pricingTone}`}>{p.pricingLabel}</span>
        {p.sourcesCount > 0 && <span className="status neutral">{p.sourcesCount} sources</span>}
      </span>
      {p.features.length > 0 && (
        <ul className="discover-features">
          {p.features.slice(0, 3).map((f) => (
            <li key={f}><IconCheck size={14} /> {f}</li>
          ))}
        </ul>
      )}
      <div className="discover-tile-actions">
        <AffiliateCta product={{ slug: p.slug, name: p.name, affiliate: p.affiliate }} ctaType="button" placement={`discover-${catSlug}`} pageType="home" pageSlug="/" label={`Visit ${p.name}`} />
        <Link className="discover-review-link" href={routes.product(p.slug)}>Read review <span className="arrow-right" aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
