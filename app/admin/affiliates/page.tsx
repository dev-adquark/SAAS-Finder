import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { formatDate } from "@/lib/freshness-rules";
import { AdminPage, DangerForm, Flash, Hidden, Pill } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminAffiliates({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [links, withoutLinks] = await Promise.all([
    db.affiliateLink.findMany({ include: { product: { select: { id: true, name: true, slug: true } } }, orderBy: [{ product: { name: "asc" } }, { createdAt: "desc" }] }),
    db.product.findMany({ where: { links: { none: { active: true } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <AdminPage title="Affiliate links">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">/go/{"{slug}"} only ever redirects to an active HTTPS link stored here, or to the product&apos;s official URL. Add links from the product editor once a partner relationship is verified.</p>
      <table className="admin-table">
        <thead><tr><th>Product</th><th>Link</th><th>Status</th><th /></tr></thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.id}>
              <td><Link href={`/admin/products/${l.product.id}`}>{l.product.name}</Link><br /><span className="small muted">/go/{l.product.slug}</span></td>
              <td>{l.label} · {l.provider ?? "—"}<br /><span className="small muted">{l.url}</span></td>
              <td><Pill tone={l.active ? "good" : "warn"}>{l.active ? `active since ${formatDate(l.verifiedAt)}` : "inactive"}</Pill></td>
              <td>
                <form action={A.toggleLinkAction} className="inline-form"><Hidden name="linkId" value={l.id} /><Hidden name="active" value={String(!l.active)} /><Hidden name="back" value="/admin/affiliates" /><button className="btn secondary" type="submit">{l.active ? "Deactivate" : "Activate"}</button></form>
                <DangerForm action={A.deleteLinkAction}><Hidden name="linkId" value={l.id} /><Hidden name="back" value="/admin/affiliates" /></DangerForm>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {links.length === 0 && <p className="notice">No affiliate links configured. All CTAs currently go to official vendor sites and are labelled accordingly.</p>}
      <h2 className="section-gap">Products using official links ({withoutLinks.length})</h2>
      <p className="small">{withoutLinks.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link href={`/admin/products/${p.id}`}>{p.name}</Link></span>)}</p>
    </AdminPage>
  );
}
