import Link from "next/link";
import { alternativesFor, loadCatalog } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "SaaS alternatives",
  description: "Curated alternatives to popular SaaS tools, with the reason each alternative made the list and the trade-offs to expect.",
  path: routes.alternativesIndex(),
});

export default async function AlternativesIndex() {
  const c = await loadCatalog();
  const names = new Map(c.categories.map((x) => [x.slug, x.name]));
  const list = c.products.map((p) => ({ p, alts: alternativesFor(c, p) })).filter((x) => x.alts.length > 0);
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("SaaS alternatives", routes.alternativesIndex(), list.map(({ p }) => ({ name: `${p.name} alternatives`, path: routes.alternatives(p.slug) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Alternatives", path: routes.alternativesIndex() }]} />
        <span className="eyebrow">Alternatives</span>
        <h1>Alternatives to popular SaaS tools</h1>
        <div className="grid">
          {list.map(({ p, alts }) => (
            <Link className="card" key={p.slug} href={routes.alternatives(p.slug)}>
              <span className="tag">{names.get(p.categorySlug)}</span>
              <h2 className="product-title">{p.name} alternatives</h2>
              <p className="muted">{alts.map((a) => a.product.name).join(", ")}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
