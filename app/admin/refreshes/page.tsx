import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { formatDate, freshness, lastCheckedAt, refreshTargetDays } from "@/lib/freshness-rules";
import { AdminPage, Flash, Hidden, Pill } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminRefreshes({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const now = new Date();
  const [open, done, products] = await Promise.all([
    db.contentRefresh.findMany({ where: { completedAt: null }, include: { product: { select: { id: true, name: true, pricingUrl: true } } }, orderBy: { dueAt: "asc" }, take: 200 }),
    db.contentRefresh.findMany({ where: { completedAt: { not: null } }, include: { product: { select: { id: true, name: true } } }, orderBy: { completedAt: "desc" }, take: 30 }),
    db.product.findMany({ where: { status: "PUBLISHED" }, select: { id: true, name: true, pricingCheckedAt: true, refreshIntervalDays: true, snapshots: { where: { status: "VERIFIED" }, orderBy: { capturedAt: "desc" }, take: 1, select: { capturedAt: true } } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <AdminPage title="Freshness & refreshes">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Flow: due task → check the official pricing page → either &ldquo;Checked — no change&rdquo; (updates Last checked) or record a new snapshot on the product and verify it (supersedes old price, logs the change, closes the task). Pages revalidate automatically. The daily cron only queues tasks; it never edits pricing.</p>
      <form action={A.runRefreshQueueAction}><button className="btn secondary" type="submit">Queue due products now</button></form>
      <h2 className="section-gap">Open tasks ({open.length})</h2>
      <table className="admin-table">
        <thead><tr><th>Product</th><th>Due</th><th>Reason</th><th /></tr></thead>
        <tbody>
          {open.map((t) => (
            <tr key={t.id}>
              <td><Link href={`/admin/products/${t.product.id}#pricing`}>{t.product.name}</Link>{t.product.pricingUrl && <><br /><a className="small" href={t.product.pricingUrl} target="_blank" rel="nofollow noopener">official pricing ↗</a></>}</td>
              <td><Pill tone={t.dueAt <= now ? "bad" : "warn"}>{formatDate(t.dueAt)}</Pill></td>
              <td className="small">{t.reason}</td>
              <td>
                <form action={A.resolveRefreshAction} className="inline-form"><Hidden name="refreshId" value={t.id} /><Hidden name="back" value="/admin/refreshes" /><input name="note" placeholder="What you checked" maxLength={500} /> <button className="btn secondary" type="submit">Checked — no change</button></form>{" "}
                <Link className="btn secondary" href={`/admin/products/${t.product.id}#pricing`}>Record change</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="section-gap">Freshness by product</h2>
      <table className="admin-table">
        <thead><tr><th>Product</th><th>Last checked</th><th>Target</th><th>State</th></tr></thead>
        <tbody>
          {products.map((p) => {
            const checked = lastCheckedAt(p.pricingCheckedAt, p.snapshots[0]?.capturedAt);
            const days = refreshTargetDays(p.refreshIntervalDays);
            const f = freshness(checked, days, now);
            return <tr key={p.id}><td><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td><td>{formatDate(checked) ?? "never"}</td><td>{days} days{p.refreshIntervalDays ? " (override)" : ""}</td><td><Pill tone={f.state === "fresh" ? "good" : f.state === "due-soon" ? "warn" : "bad"}>{f.state}{f.daysUntilDue !== null ? ` (${f.daysUntilDue}d)` : ""}</Pill></td></tr>;
          })}
        </tbody>
      </table>
      <h2 className="section-gap">Recently completed</h2>
      <ul className="list">{done.map((t) => <li key={t.id}>{formatDate(t.completedAt)} — <Link href={`/admin/products/${t.product.id}`}>{t.product.name}</Link>: {t.resolution}</li>)}</ul>
    </AdminPage>
  );
}
