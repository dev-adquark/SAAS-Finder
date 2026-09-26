import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { dataQuality } from "@/lib/admin/services";
import { AdminPage, Pill } from "@/components/admin/ui";
import { formatDate } from "@/lib/freshness-rules";
import { productSyncStates, syncDashboard, SYNC_STATE_LABEL } from "@/lib/sync/dashboard";

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bar-row" style={{ gridTemplateColumns: "200px 1fr 70px", ["--cat" as string]: tone }}>
      <span className="small">{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      <strong className="small">{value}/{total}</strong>
    </div>
  );
}

// Every number is computed from the database at request time.
export default async function DataQuality() {
  await requireAdminPage();
  const [{ totals: t, perProduct }, sync, states] = await Promise.all([dataQuality(), syncDashboard(), productSyncStates()]);
  const ss = sync.summary;
  return (
    <AdminPage title="Data quality">
      <div className="stat-grid">
        {[
          ["Products", t.products], ["Published", t.published], ["Pricing verified", t.pricingVerified], ["With verified sources", t.withVerifiedSources],
          ["Missing sources", t.missingSources], ["Expired sources", t.expiredSources], ["Stale content (>90d)", t.staleContent], ["Incomplete reviews", t.incompleteReviews],
          ["Active affiliate links", t.affiliateActive], ["Active sponsors", t.activeSponsors], ["Expired sponsors", t.expiredSponsors], ["Active relationships", t.activeRelationships],
        ].map(([k, v]) => <div className="stat" key={k as string}><div className="k">{k}</div><div className="v">{v}</div></div>)}
      </div>
      <section className="panel section-gap">
        <h2>Automated research sync</h2>
        <p className="small muted">{sync.configured ? "Weekly Apify crawl of official vendor pages." : "Disabled — APIFY_API_TOKEN is not configured."} <Link href="/admin/sync">Open the review queue →</Link></p>
        <div className="stat-grid">
          {[
            ["Last sync", sync.lastFinished?.finishedAt ? formatDate(sync.lastFinished.finishedAt) : "Never"], ["Next sync", formatDate(sync.nextRun)],
            ["Products checked", ss.productsChecked], ["Sources checked", ss.sourcesChecked], ["Facts checked", ss.factsChecked], ["Prices checked", ss.pricesChecked],
            ["Changes detected", ss.changesDetected], ["Changes accepted", ss.changesAccepted], ["Changes rejected", ss.changesRejected],
            ["Sources unavailable", ss.sourcesUnavailable], ["Validation failures", ss.validationFailures], ["Awaiting review", sync.pendingChanges.length],
          ].map(([k, v]) => <div className="stat" key={k as string}><div className="k">{k}</div><div className="v">{v}</div></div>)}
        </div>
      </section>
      <section className="panel section-gap">
        <h2>Coverage</h2>
        <div className="bars">
          <Bar label="Pricing verified" value={t.pricingVerified} total={t.products} tone="#10b981" />
          <Bar label="Verified sources" value={t.withVerifiedSources} total={t.products} tone="#22d3ee" />
          <Bar label="Fresh content (≤90d)" value={t.products - t.staleContent} total={t.products} tone="#6366f1" />
          <Bar label="Hands-on review complete" value={t.products - t.incompleteReviews} total={t.products} tone="#f97316" />
          <Bar label="Affiliate configured" value={t.affiliateActive} total={t.products} tone="#f59e0b" />
        </div>
      </section>
      <section className="panel section-gap">
        <h2>Per product</h2>
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Sync</th><th>Pricing</th><th>Sources</th><th>Facts</th><th>Content</th><th>Review</th><th>Affiliate</th></tr></thead>
          <tbody>
            {perProduct.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/products/${p.id}#sources`}>{p.name}</Link></td>
                <td>{(() => { const st = states.get(p.id)?.state ?? "never"; return <Pill tone={st === "verified" ? "good" : st === "failed" ? "bad" : st === "never" ? "" : "warn"}>{SYNC_STATE_LABEL[st]}</Pill>; })()}</td>
                <td><Pill tone={p.pricingVerified ? "good" : "warn"}>{p.pricingVerified ? "verified" : "pending"}</Pill></td>
                <td><Pill tone={p.sourcesVerified ? "good" : "bad"}>{p.sourcesVerified} ok</Pill>{p.sourcesExpired > 0 && <> <Pill tone="bad">{p.sourcesExpired} expired</Pill></>}{p.sourcesPending > 0 && <> <Pill tone="warn">{p.sourcesPending} pending</Pill></>}</td>
                <td>{p.factsVerified}</td>
                <td><Pill tone={p.stale ? "bad" : "good"}>{p.stale ? "stale" : "fresh"}</Pill></td>
                <td><Pill tone={p.incompleteReview ? "warn" : "good"}>{p.incompleteReview ? "pending" : "done"}</Pill></td>
                <td>{p.affiliateActive ? <Pill tone="good">active</Pill> : <span className="tiny muted">official link</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminPage>
  );
}
