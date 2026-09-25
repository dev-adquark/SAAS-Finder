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
  title: "SaaS comparisons",
  description: "Side-by-side SaaS comparisons with category-specific criteria, key differences and guidance on which tool fits which team.",
  path: routes.comparisons(),
});

export default async function Comparisons() {
  const c = await loadCatalog();
  const title = (a: string, b: string) => `${findProduct(c, a)?.name} vs ${findProduct(c, b)?.name}`;
  return (
    <section className="section">
      <JsonLd data={itemListJsonLd("SaaS comparisons", routes.comparisons(), c.pairs.map((p) => ({ name: title(p.productA, p.productB), path: routes.compare(p.productA, p.productB) })))} />
      <div className="container">
        <Breadcrumbs items={[{ name: "Comparisons", path: routes.comparisons() }]} />
        <span className="eyebrow" style={{ marginTop: 18 }}>Comparison library</span>
        <h1 style={{ marginTop: 12 }}>SaaS <span className="grad-text">vs</span> SaaS</h1>
        <p className="lead">{c.pairs.length} curated head-to-heads. Each uses the criteria that matter in its category — no auto-generated matchups.</p>
        {c.categories.map((cat) => {
          const pairs = c.pairs.filter((p) => p.categorySlug === cat.slug);
          if (!pairs.length) return null;
          return (
            <section key={cat.slug} className="section-gap reveal" style={catStyle(cat.slug)}>
              <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}><CategoryIcon slug={cat.slug} /> <Link href={routes.category(cat.slug)}>{cat.name}</Link></h2>
              <div className="grid three reveal-stagger">
                {pairs.map((p) => {
                  const a = findProduct(c, p.productA)!;
                  const b = findProduct(c, p.productB)!;
                  return (
                    <Link className="card vscard" key={p.slug} href={routes.compare(a.slug, b.slug)}>
                      <span className="side"><Monogram name={a.name} slug={a.slug} categorySlug={a.categorySlug} />{a.name}</span>
                      <span className="vs" aria-hidden="true">VS</span>
                      <span className="side"><Monogram name={b.name} slug={b.slug} categorySlug={b.categorySlug} />{b.name}</span>
                      <span className="sr-only"> versus </span>
                      <span className="sum">{p.summary}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
