import Link from "next/link";
import { guidesInCategory, loadCatalog, pairsInCategory, productsInCategory } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryIcon } from "@/components/icons";
import { Monogram, catStyle } from "@/components/identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "SaaS categories",
  description: "Browse SaaS software by category, with reviews, best-for guides, alternatives and side-by-side comparisons in each hub.",
  path: routes.categories(),
});

export default async function Categories() {
  const c = await loadCatalog();
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("SaaS categories", routes.categories(), c.categories.map((x) => ({ name: x.name, path: routes.category(x.slug) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Categories", path: routes.categories() }]} />
        <span className="eyebrow" style={{ marginTop: 18 }}>Category hubs</span>
        <h1 style={{ marginTop: 12 }}>Browse software by category</h1>
        <p className="lead">{c.categories.length} hubs, each with reviews, best-for guides, alternatives and head-to-head comparisons.</p>
        <div className="bento section-gap reveal-stagger">
          {c.categories.map((x) => {
            const items = productsInCategory(c, x.slug);
            return (
              <Link className="card catcard" key={x.slug} href={routes.category(x.slug)} style={catStyle(x.slug)}>
                <span className="cat-ic"><CategoryIcon slug={x.slug} size={26} /></span>
                <h2 style={{ fontSize: "1.3rem", margin: "4px 0 0" }}>{x.name}</h2>
                <p>{x.description}</p>
                <span className="chip-row"><span className="tag">{items.length} reviews</span><span className="tag">{guidesInCategory(c, x.slug).length} guides</span><span className="tag">{pairsInCategory(c, x.slug).length} comparisons</span></span>
                <span className="picks" style={{ display: "flex" }}>{items.map((p) => <Monogram key={p.slug} name={p.name} categorySlug={p.categorySlug} size="sm" />)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
