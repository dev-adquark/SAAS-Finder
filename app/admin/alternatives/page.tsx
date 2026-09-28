import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden } from "@/components/admin/ui";
import { HubTabs } from "@/components/admin/hub-tabs";
import { PUBLISHING_TABS } from "@/components/admin/nav";


type SP = { searchParams: Promise<{ ok?: string; error?: string; q?: string; show?: string }> };

export default async function AdminAlternatives({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const all = await db.product.findMany({
    include: { alternativesFrom: { include: { alternative: { select: { name: true } } }, orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  const products = all.filter((p) => (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q)) && (sp.show !== "empty" || p.alternativesFrom.length === 0));
  return (
    <AdminPage title="Alternatives sets">
      <HubTabs tabs={PUBLISHING_TABS} label="Publishing sections" />
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Curated per source product. Add new alternatives from the product editor.</p>
      <form className="admin-filter" method="get" role="search">
        <label className="field">Product<input name="q" defaultValue={sp.q ?? ""} placeholder="Filter by product" maxLength={80} /></label>
        <label className="field">Show<select name="show" defaultValue={sp.show ?? ""}><option value="">All products</option><option value="empty">Without alternatives</option></select></label>
        <button className="btn secondary" type="submit">Apply</button>
      </form>
      <p className="small muted">{products.length} of {all.length} products</p>
      {products.map((p) => (
        <section className="panel section-gap" key={p.id}>
          <h2><Link href={`/admin/products/${p.id}`}>{p.name}</Link> <span className="small muted">{routes.alternatives(p.slug)}</span></h2>
          {p.alternativesFrom.length === 0 && <p className="muted">No alternatives yet — the public alternatives page is hidden.</p>}
          {p.alternativesFrom.map((a) => (
            <div className="faq" key={a.id}>
              <form action={A.updateAlternativeAction} className="form-grid">
                <Hidden name="altId" value={a.id} /><Hidden name="back" value="/admin/alternatives" />
                <strong className="full">#{a.sortOrder} {a.alternative.name}</strong>
                <Area label="Rationale" name="rationale" defaultValue={a.rationale} required rows={2} maxLength={1000} />
                <Field label="Key difference" name="keyDifference" defaultValue={a.keyDifference} full maxLength={500} />
                <Field label="Order" name="sortOrder" type="number" defaultValue={a.sortOrder} />
                <Check label="Active" name="active" defaultChecked={a.active} />
                <button className="btn secondary" type="submit">Save</button>
              </form>
              <DangerForm action={A.deleteAlternativeAction} label="Remove"><Hidden name="altId" value={a.id} /><Hidden name="back" value="/admin/alternatives" /></DangerForm>
            </div>
          ))}
        </section>
      ))}
    </AdminPage>
  );
}
