import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { publishProblems } from "@/lib/content/publish-validation";
import { strArray, strRecord } from "@/lib/catalog";
import { lastCheckedAt, freshness, refreshTargetDays } from "@/lib/freshness-rules";
import { formatDate } from "@/lib/freshness-rules";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Flash, Pill, statusTone } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminProducts({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const products = await db.product.findMany({
    include: { category: true, review: true, snapshots: { where: { status: "VERIFIED" }, orderBy: { capturedAt: "desc" }, take: 1 }, _count: { select: { faqs: true, alternativesFrom: { where: { active: true } } } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return (
    <AdminPage title="Products">
      <Flash ok={sp.ok} error={sp.error} />
      <p><Link className="btn primary" href="/admin/products/new">New product</Link></p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Status</th><th>Review</th><th>Pricing</th><th>Publish readiness</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const problems = publishProblems({
                slug: p.slug, name: p.name, categorySlug: p.category.slug, tagline: p.tagline, description: p.description, officialUrl: p.officialUrl, pricingUrl: p.pricingUrl,
                features: strArray(p.features), comparison: strRecord(p.comparison), alternativesIntro: p.alternativesIntro,
                review: p.review ? { editorialSummary: p.review.editorialSummary, pros: strArray(p.review.pros), cons: strArray(p.review.cons), bestFor: strArray(p.review.bestFor), limitations: strArray(p.review.limitations) } : null,
                faqCount: p._count.faqs, alternativeCount: p._count.alternativesFrom,
              });
              const checked = lastCheckedAt(p.pricingCheckedAt, p.snapshots[0]?.capturedAt);
              const f = freshness(checked, refreshTargetDays(p.refreshIntervalDays));
              return (
                <tr key={p.id}>
                  <td><Link href={`/admin/products/${p.id}`}><strong>{p.name}</strong></Link><br /><span className="small muted">{routes.product(p.slug)}</span></td>
                  <td>{p.category.name}</td>
                  <td><Pill tone={statusTone(p.status)}>{p.status}</Pill></td>
                  <td><Pill tone={statusTone(p.review?.reviewStatus ?? "")}>{p.review?.reviewStatus ?? "NONE"}</Pill></td>
                  <td><Pill tone={f.state === "fresh" ? "good" : f.state === "due-soon" ? "warn" : "bad"}>{f.state}</Pill><br /><span className="small muted">{formatDate(checked) ?? "never verified"}</span></td>
                  <td>{problems.length ? <span className="small">{problems.join("; ")}</span> : <Pill tone="good">ready</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
