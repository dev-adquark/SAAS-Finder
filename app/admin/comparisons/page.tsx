import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Check, DangerForm, Flash, Hidden, Select, lines } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminComparisons({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [pairs, products] = await Promise.all([
    db.competitorPair.findMany({ include: { productA: { select: { name: true, slug: true } }, productB: { select: { name: true, slug: true } }, category: { select: { name: true } } }, orderBy: { slug: "asc" } }),
    db.product.findMany({ select: { id: true, name: true, category: { select: { name: true } } }, orderBy: [{ category: { name: "asc" } }, { name: "asc" }] }),
  ]);
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.category.name})` }));
  return (
    <AdminPage title="Comparisons">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Pairs are stored in canonical order (alphabetical by slug), so a reversed duplicate cannot be created. Both products must share a category.</p>
      <form action={A.createPairAction} className="panel form-grid">
        <h2 className="full">New comparison</h2>
        <Select label="Product A" name="productAId" options={productOptions} />
        <Select label="Product B" name="productBId" options={productOptions} />
        <Area label="Summary" name="summary" required rows={2} maxLength={1500} />
        <Area label="Choose product A if…" name="chooseA" required rows={2} maxLength={1000} />
        <Area label="Choose product B if…" name="chooseB" required rows={2} maxLength={1000} />
        <Area label="Key differences (one per line)" name="highlights" rows={3} />
        <button className="btn primary" type="submit">Create comparison</button>
      </form>
      {pairs.map((p) => (
        <section className="panel section-gap" key={p.id}>
          <h2>{p.productA.name} vs {p.productB.name} <span className="small muted">{p.category.name} · <Link href={routes.compare(p.productA.slug, p.productB.slug)}>{routes.compare(p.productA.slug, p.productB.slug)}</Link></span></h2>
          <form action={A.updatePairAction} className="form-grid">
            <Hidden name="pairId" value={p.id} />
            <Area label="Summary" name="summary" defaultValue={p.summary} required rows={2} maxLength={1500} />
            <Area label={`Choose ${p.productA.name} if…`} name="chooseA" defaultValue={p.chooseA} required rows={2} maxLength={1000} />
            <Area label={`Choose ${p.productB.name} if…`} name="chooseB" defaultValue={p.chooseB} required rows={2} maxLength={1000} />
            <Area label="Key differences (one per line)" name="highlights" defaultValue={lines(p.highlights)} rows={3} />
            <Check label="Active (published)" name="active" defaultChecked={p.active} />
            <button className="btn secondary" type="submit">Save</button>
          </form>
          <DangerForm action={A.deletePairAction}><Hidden name="pairId" value={p.id} /></DangerForm>
        </section>
      ))}
    </AdminPage>
  );
}
