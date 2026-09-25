import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDate } from "@/lib/freshness-rules";
import * as A from "@/app/admin/actions";
import { AdminPage, Flash, Hidden, Pill, statusTone } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminPricing({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [pending, verified] = await Promise.all([
    db.pricingSnapshot.findMany({ where: { status: "PENDING" }, include: { product: { select: { id: true, name: true, pricingUrl: true } } }, orderBy: { capturedAt: "asc" }, take: 200 }),
    db.pricingSnapshot.findMany({ where: { status: "VERIFIED" }, include: { product: { select: { id: true, name: true } } }, orderBy: { verifiedAt: "desc" }, take: 50 }),
  ]);
  const row = (s: (typeof pending)[number] | (typeof verified)[number], actions: boolean) => (
    <tr key={s.id}>
      <td><Link href={`/admin/products/${s.product.id}#pricing`}>{s.product.name}</Link></td>
      <td>{formatDate(s.capturedAt)}</td>
      <td>{s.plan ?? "—"} {s.price !== null ? `${s.price.toString()} ${s.currency ?? ""}` : ""} {s.billingPeriod ?? ""}<br /><span className="small muted">{s.summary}</span></td>
      <td className="small">{s.sourceType}{s.sourceUrl && <><br /><a href={s.sourceUrl} target="_blank" rel="nofollow noopener">open source</a></>}</td>
      <td><Pill tone={statusTone(s.status)}>{s.status}</Pill></td>
      <td>
        {actions && (["verify", "reject"] as const).map((d) => (
          <form key={d} action={A.reviewSnapshotAction} className="inline-form"><Hidden name="snapshotId" value={s.id} /><Hidden name="decision" value={d} /><Hidden name="back" value="/admin/pricing" /><button className={`btn ${d === "verify" ? "primary" : "secondary"}`} type="submit">{d}</button></form>
        ))}
      </td>
    </tr>
  );
  return (
    <AdminPage title="Pricing review queue">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Detected or recorded pricing waits here until an editor checks it against the source. Verifying publishes it, supersedes the previous price for that plan, updates &ldquo;Last checked&rdquo;, writes a change-log entry, closes open refresh tasks and revalidates pages. Qualitative notes without a price verify as notes only.</p>
      <h2>Awaiting review ({pending.length})</h2>
      <table className="admin-table"><thead><tr><th>Product</th><th>Captured</th><th>Pricing</th><th>Source</th><th>Status</th><th /></tr></thead><tbody>{pending.map((s) => row(s, true))}</tbody></table>
      <h2 className="section-gap">Recently verified</h2>
      <table className="admin-table"><thead><tr><th>Product</th><th>Captured</th><th>Pricing</th><th>Source</th><th>Status</th><th /></tr></thead><tbody>{verified.map((s) => row(s, false))}</tbody></table>
    </AdminPage>
  );
}
