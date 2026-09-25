import Link from "next/link";
import { findProduct, loadCatalog } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CategoryIcon } from "@/components/icons";
import { Monogram, catStyle } from "@/components/identity";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { routes } from "@/lib/seo/routes";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Best-for software guides",
  description: "Curated best-for guides that match SaaS tools to specific teams and use cases, with selection criteria and honest limitations.",
  path: routes.bestIndex(),
});

export default async function BestIndex() {
  const c = await loadCatalog();
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("Best-for software guides", routes.bestIndex(), c.useCases.map((u) => ({ name: u.title, path: routes.best(u.slug) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Best-for guides", path: routes.bestIndex() }]} />
        <span className="eyebrow" style={{ marginTop: 18 }}>Buying guides</span>
        <h1 style={{ marginTop: 12 }}>Best software for your situation</h1>
        <p className="lead">{c.useCases.length} guides that match tools to a specific audience, with the criteria we used and the limitations to weigh.</p>
        {c.categories.map((cat) => {
          const guides = c.useCases.filter((u) => u.categorySlug === cat.slug);
          if (!guides.length) return null;
          return (
            <section className="section-gap reveal" key={cat.slug} style={catStyle(cat.slug)}>
              <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}><CategoryIcon slug={cat.slug} /> <Link href={routes.category(cat.slug)}>{cat.name}</Link></h2>
              <div className="grid two-col reveal-stagger">
                {guides.map((u) => (
                  <Link className="card ucard accent-top" key={u.slug} href={routes.best(u.slug)}>
                    <span className="tag">For {u.audience}</span>
                    <h3>{u.title}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{u.criteria.map((x) => x.name).join(" · ")}</p>
                    <span className="picks">
                      {u.products.slice(0, 4).map((x) => { const p = findProduct(c, x.slug); return p ? <Monogram key={x.slug} name={p.name} categorySlug={p.categorySlug} size="sm" /> : null; })}
                      <span className="tiny muted" style={{ marginLeft: 10 }}>{u.products.map((x) => findProduct(c, x.slug)?.name).join(", ")}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
