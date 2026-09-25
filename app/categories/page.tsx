import Link from "next/link";
import { loadCatalog, productsInCategory, guidesInCategory } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
        <span className="eyebrow">Category hubs</span>
        <h1>Browse software by category</h1>
        <div className="grid">
          {c.categories.map((x) => (
            <Link className="card" key={x.slug} href={routes.category(x.slug)}>
              <span className="tag">{productsInCategory(c, x.slug).length} reviews · {guidesInCategory(c, x.slug).length} guides</span>
              <h2 className="product-title">{x.name}</h2>
              <p className="muted">{x.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
