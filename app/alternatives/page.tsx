import Link from "next/link";
import { alternativesFor, loadCatalog } from "@/lib/catalog";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Monogram, catStyle } from "@/components/identity";
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
        <span className="eyebrow" style={{ marginTop: 18 }}>Alternatives</span>
        <h1 style={{ marginTop: 12 }}>Find a better fit</h1>
        <p className="lead">Curated alternatives for {list.length} popular tools. Every alternative comes with the reason it made the list.</p>
        <div className="grid three section-gap reveal-stagger">
          {list.map(({ p, alts }) => (
            <Link className="card pcard accent-top" key={p.slug} href={routes.alternatives(p.slug)} style={catStyle(p.categorySlug)}>
              <div className="pcard-head">
                <Monogram name={p.name} categorySlug={p.categorySlug} />
                <div><h2 style={{ fontSize: "1.1rem", margin: 0 }}>{p.name} alternatives</h2><div className="sub">{names.get(p.categorySlug)}</div></div>
              </div>
              <p className="tiny muted">{p.alternativesIntro}</p>
              <div className="pcard-foot" style={{ justifyContent: "flex-start" }}>
                <span style={{ display: "flex" }}>{alts.map((a) => <Monogram key={a.product.slug} name={a.product.name} categorySlug={a.product.categorySlug} size="sm" />)}</span>
                <span className="small">{alts.map((a) => a.product.name).join(", ")}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
