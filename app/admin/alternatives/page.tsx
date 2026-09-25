import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminAlternatives({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const products = await db.product.findMany({
    include: { alternativesFrom: { include: { alternative: { select: { name: true } } }, orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  return (
    <AdminPage title="Alternatives sets">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Curated per source product. Add new alternatives from the product editor.</p>
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
