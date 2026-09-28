import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Pill, statusTone } from "@/components/admin/ui";
import { HubTabs } from "@/components/admin/hub-tabs";
import { PUBLISHING_TABS } from "@/components/admin/nav";

type SP = { searchParams: Promise<{ q?: string }> };

// Publishing hub: live status of every editorial page type, and one search across all of them.
export default async function AdminPublishing({ searchParams }: SP) {
  await requireAdminPage();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const [products, alternatives, pairs, useCases] = await Promise.all([
    db.product.findMany({ select: { id: true, name: true, slug: true, status: true, _count: { select: { alternativesFrom: { where: { active: true } } } } }, orderBy: { name: "asc" } }),
    db.alternative.groupBy({ by: ["active"], _count: { _all: true } }),
    db.competitorPair.findMany({ select: { id: true, slug: true, active: true, productA: { select: { name: true, slug: true } }, productB: { select: { name: true, slug: true } } }, orderBy: { slug: "asc" } }),
    db.useCase.findMany({ select: { id: true, slug: true, title: true, status: true, _count: { select: { products: { where: { active: true } } } } }, orderBy: { title: "asc" } }),
  ]);
  const altCount = (active: boolean) => alternatives.find((a) => a.active === active)?._count._all ?? 0;
  const withSets = products.filter((p) => p.status === "PUBLISHED" && p._count.alternativesFrom > 0).length;
  const published = products.filter((p) => p.status === "PUBLISHED").length;
  const countStatus = (s: string) => useCases.filter((u) => u.status === s).length;
  const needle = q.toLowerCase();
  const hit = (...v: string[]) => v.some((x) => x.toLowerCase().includes(needle));
  const results = q
    ? [
        ...products.filter((p) => hit(p.name, p.slug)).map((p) => ({ type: "Alternatives", label: `${p.name} alternatives`, status: p._count.alternativesFrom ? `${p._count.alternativesFrom} active` : "none", tone: p._count.alternativesFrom ? "good" : "warn", edit: `/admin/alternatives?q=${encodeURIComponent(p.slug)}`, view: routes.alternatives(p.slug) })),
        ...pairs.filter((p) => hit(p.productA.name, p.productB.name, p.slug)).map((p) => ({ type: "Comparison", label: `${p.productA.name} vs ${p.productB.name}`, status: p.active ? "published" : "inactive", tone: p.active ? "good" : "warn", edit: "/admin/comparisons", view: routes.compare(p.productA.slug, p.productB.slug) })),
        ...useCases.filter((u) => hit(u.title, u.slug)).map((u) => ({ type: "Best for", label: u.title, status: u.status.toLowerCase(), tone: statusTone(u.status), edit: `/admin/use-cases/${u.id}`, view: routes.best(u.slug) })),
      ]
    : [];
  const cards = [
    { title: "Alternatives", href: "/admin/alternatives", lines: [`${withSets}/${published} published products have a set`, `${altCount(true)} active · ${altCount(false)} inactive entries`] },
    { title: "Comparisons", href: "/admin/comparisons", lines: [`${pairs.filter((p) => p.active).length} published`, `${pairs.filter((p) => !p.active).length} inactive`] },
    { title: "Best for", href: "/admin/use-cases", lines: [`${countStatus("PUBLISHED")} published · ${countStatus("DRAFT")} draft`, `${countStatus("REVIEW")} in review · ${countStatus("ARCHIVED")} archived`] },
  ];
  return (
    <AdminPage title="Publishing">
      <HubTabs tabs={PUBLISHING_TABS} label="Publishing sections" />
      <div className="stat-grid">
        {cards.map((c) => (
          <Link className="stat" href={c.href} key={c.title}>
            <div className="k">{c.title}</div>
            {c.lines.map((l) => <div className="small" key={l}>{l}</div>)}
          </Link>
        ))}
      </div>
      <form className="admin-filter section-gap" method="get" role="search">
        <label className="field">Find a page<input name="q" defaultValue={q} placeholder="Product, comparison or guide" maxLength={80} /></label>
        <button className="btn secondary" type="submit">Search</button>
        {q && <Link className="btn secondary" href="/admin/publishing">Clear</Link>}
      </form>
      {q && (
        <table className="admin-table">
          <thead><tr><th>Type</th><th>Page</th><th>Status</th><th /></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={`${r.type}${r.view}`}>
                <td className="small">{r.type}</td>
                <td><Link href={r.edit}>{r.label}</Link></td>
                <td><Pill tone={r.tone as "good" | "warn" | "bad" | ""}>{r.status}</Pill></td>
                <td className="small"><Link href={r.view}>View ↗</Link></td>
              </tr>
            ))}
            {!results.length && <tr><td colSpan={4} className="muted">No pages match &ldquo;{q}&rdquo;.</td></tr>}
          </tbody>
        </table>
      )}
    </AdminPage>
  );
}
