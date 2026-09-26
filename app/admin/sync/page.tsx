import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { formatDate } from "@/lib/freshness-rules";
import { productSyncStates, syncDashboard, SYNC_STATE_LABEL, type ProductSyncState } from "@/lib/sync/dashboard";
import { AdminPage, DangerForm, Flash, Hidden, Pill } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

const KIND_LABEL: Record<string, string> = {
  PRICE_CHANGED: "Price changed", NEW_PLAN: "New plan", PLAN_NOT_FOUND: "Plan not found", FACT_NOT_FOUND: "Fact evidence missing", FACT_CHANGED: "Fact changed",
  NEW_SOURCE: "New official link", SOURCE_NOT_FOUND: "Source page gone", SOURCE_UPDATED: "Announcements updated",
};
const STATE_TONE: Record<ProductSyncState, "good" | "warn" | "bad" | ""> = { verified: "good", partial: "warn", review: "warn", failed: "bad", never: "" };
const RUN_TONE: Record<string, "good" | "warn" | "bad" | ""> = { COMPLETED: "good", PARTIAL: "warn", RUNNING: "", PROCESSING: "", FAILED: "bad" };
const PERIODS = ["MONTHLY", "ANNUAL", "FREE", "ONE_TIME", "USAGE", "CUSTOM"];

const when = (d: Date | null | undefined) => (d ? `${formatDate(d)} ${d.toISOString().slice(11, 16)} UTC` : "—");
const dur = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);
const host = (u: string | null) => {
  try {
    return u ? new URL(u).host.replace(/^www\./, "") + new URL(u).pathname : "";
  } catch {
    return u ?? "";
  }
};

// Every figure is read from the sync tables at request time.
export default async function AdminSync({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [d, states, products] = await Promise.all([syncDashboard(), productSyncStates(), db.product.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } })]);
  const active = d.runs.find((r) => r.status === "RUNNING" || r.status === "PROCESSING");
  const s = d.summary;
  return (
    <AdminPage title="Data sync">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">
        A weekly Apify crawl fetches each product&apos;s official pages. Automation only <strong>re-confirms</strong> existing verified facts, prices and sources whose exact quote is still on the official page (their check dates move forward).
        Every difference — a new price, a missing plan, a new official link, a page that is gone — waits here for an editor. Blocked or failed pages never change data: the previous verified value and its date stay.
      </p>
      {!d.configured && <div className="flash err" role="alert">APIFY_API_TOKEN is not configured on the server. Automated research is disabled until it is added to the environment.</div>}
      <div className="inline-form" style={{ gap: 8, flexWrap: "wrap" }}>
        <form action={A.startFullSyncAction}><button className="btn" type="submit" disabled={!d.configured || !!active}>Run full sync now</button></form>
        <form action={A.advanceSyncAction}><button className="btn secondary" type="submit" disabled={!active}>Check progress</button></form>
        {active && <Pill>{active.status === "RUNNING" ? `Crawling official pages (phase ${active.phase})…` : `Processing results (${active.cursor} done)…`}</Pill>}
      </div>

      <div className="stat-grid section-gap">
        {[
          ["Last sync", d.lastFinished ? when(d.lastFinished.finishedAt) : "Never"],
          ["Next sync", when(d.nextRun)],
          ["Products checked", s.productsChecked],
          ["Sources checked", s.sourcesChecked],
          ["Facts checked", s.factsChecked],
          ["Prices checked", s.pricesChecked],
          ["Claims re-confirmed", s.claimsReverified],
          ["Changes detected", s.changesDetected],
          ["Changes accepted", s.changesAccepted],
          ["Changes rejected / kept", s.changesRejected],
          ["Sources unavailable", s.sourcesUnavailable],
          ["Validation failures", s.validationFailures],
          ["Sync duration", dur(s.durationMs)],
        ].map(([k, v]) => <div className="stat" key={String(k)}><div className="k">{k}</div><div className="v" style={{ fontSize: typeof v === "string" && v.length > 10 ? "1rem" : undefined }}>{v}</div></div>)}
      </div>

      <section className="panel section-gap" id="review">
        <h2>Review queue ({d.pendingChanges.length})</h2>
        {!d.pendingChanges.length ? <p className="muted small">Nothing waiting. New detections appear here after each sync.</p> : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Change</th><th>Previous</th><th>Detected</th><th>Evidence &amp; source</th><th>Decision</th></tr></thead>
            <tbody>
              {d.pendingChanges.map((c) => {
                const needsPeriod = c.kind === "PRICE_CHANGED" || c.kind === "NEW_PLAN";
                const period = ((c.payload ?? {}) as { billingPeriod?: string | null }).billingPeriod ?? "";
                return (
                  <tr key={c.id}>
                    <td><Link href={`/admin/products/${c.product.id}`}>{c.product.name}</Link></td>
                    <td><Pill tone={c.kind.endsWith("NOT_FOUND") ? "bad" : "warn"}>{KIND_LABEL[c.kind]}</Pill><br /><span className="small">{c.field}</span></td>
                    <td className="small">{c.previousValue ?? "—"}</td>
                    <td className="small"><strong>{c.newValue ?? "—"}</strong><br /><span className="tiny muted">First seen {formatDate(c.detectedAt)}{+c.lastSeenAt !== +c.detectedAt ? ` · last seen ${formatDate(c.lastSeenAt)}` : ""}</span></td>
                    <td className="small">
                      {c.evidence ? <blockquote className="tiny" style={{ margin: "0 0 6px", borderLeft: "2px solid var(--line-strong)", paddingLeft: 8 }}>&ldquo;{c.evidence}&rdquo;</blockquote> : <span className="tiny muted">No quote (absence detected)</span>}<br />
                      {c.sourceUrl && <a className="tiny" href={c.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">{host(c.sourceUrl)} ↗</a>}
                    </td>
                    <td>
                      <form action={A.acceptChangeAction} className="inline-form" style={{ flexWrap: "wrap", gap: 6 }}>
                        <Hidden name="changeId" value={c.id} />
                        {needsPeriod && (
                          <select name="billingPeriod" defaultValue={period} required aria-label="Billing period">
                            <option value="" disabled>Billing period…</option>
                            {PERIODS.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
                          </select>
                        )}
                        <input name="note" placeholder="Note (optional)" maxLength={500} />
                        <button className="btn" type="submit">Accept</button>
                      </form>
                      <form action={A.keepChangeAction} className="inline-form"><Hidden name="changeId" value={c.id} /><button className="btn secondary" type="submit">Keep existing</button></form>{" "}
                      <form action={A.rejectChangeAction} className="inline-form"><Hidden name="changeId" value={c.id} /><button className="btn secondary" type="submit">Reject</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel section-gap" id="products">
        <h2>Product status</h2>
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Status</th><th>Last synced</th><th>Pages fetched</th><th>Pending</th><th /></tr></thead>
          <tbody>
            {products.map((p) => {
              const st = states.get(p.id) ?? { state: "never" as const, pending: 0, lastSyncedAt: null, ok: 0, pages: 0 };
              return (
                <tr key={p.id}>
                  <td><Link href={`/admin/products/${p.id}#sources`}>{p.name}</Link>{p.status !== "PUBLISHED" && <> <Pill>{p.status.toLowerCase()}</Pill></>}</td>
                  <td><Pill tone={STATE_TONE[st.state]}>{SYNC_STATE_LABEL[st.state]}</Pill></td>
                  <td className="small">{when(st.lastSyncedAt)}</td>
                  <td className="small">{st.pages ? `${st.ok}/${st.pages}` : "—"}</td>
                  <td>{st.pending ? <a href="#review">{st.pending}</a> : 0}</td>
                  <td><form action={A.startProductSyncAction} className="inline-form"><Hidden name="productId" value={p.id} /><Hidden name="back" value="/admin/sync" /><button className="btn secondary" type="submit" disabled={!d.configured || !!active}>Sync product</button></form></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel section-gap" id="failures">
        <h2>Source failures — last run ({d.failures.length})</h2>
        {!d.failures.length ? <p className="muted small">No failures in the last run.</p> : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Source</th><th>Result</th><th>Reason</th><th>Checked</th><th>Retry</th></tr></thead>
            <tbody>
              {d.failures.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/admin/products/${f.product.id}#sources`}>{f.product.name}</Link></td>
                  <td className="small"><a href={f.url} target="_blank" rel="nofollow noopener noreferrer">{host(f.url)} ↗</a>{f.phase === 2 && <><br /><span className="tiny muted">discovered link</span></>}</td>
                  <td><Pill tone="bad">{(f.status ?? "UNAVAILABLE").replace("_", " ").toLowerCase()}</Pill></td>
                  <td className="small">{f.reason ?? "—"}</td>
                  <td className="small">{when(f.processedAt)}</td>
                  <td className="tiny muted">Retried by the crawler (2×); retried again next sync. Previous verified value and date kept.</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel section-gap" id="history">
        <h2>Change history</h2>
        {!d.history.length ? <p className="muted small">No decisions yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Decided</th><th>Product</th><th>Change</th><th>Previous → new</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.history.map((c) => (
                <tr key={c.id}>
                  <td className="small">{when(c.reviewedAt)}<br /><span className="tiny muted">by {c.reviewedBy ?? "—"}</span></td>
                  <td><Link href={`/admin/products/${c.product.id}`}>{c.product.name}</Link></td>
                  <td className="small">{KIND_LABEL[c.kind]}<br />{c.field}</td>
                  <td className="small">{c.previousValue ?? "—"} → <strong>{c.newValue ?? "—"}</strong>{c.sourceUrl && <><br /><a className="tiny" href={c.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">{host(c.sourceUrl)} ↗</a></>}{c.note && <><br /><span className="tiny muted">{c.note}</span></>}</td>
                  <td><Pill tone={c.status === "ACCEPTED" ? "good" : c.status === "REVERTED" ? "bad" : ""}>{c.status.toLowerCase()}</Pill></td>
                  <td>{c.status === "ACCEPTED" && c.kind !== "SOURCE_UPDATED" && <DangerForm action={A.revertChangeAction} label="Revert"><Hidden name="changeId" value={c.id} /></DangerForm>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel section-gap" id="runs">
        <h2>Runs</h2>
        {!d.runs.length ? <p className="muted small">No sync has run yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Duration</th><th>Attempts</th><th>Notes</th></tr></thead>
            <tbody>
              {d.runs.map((r) => (
                <tr key={r.id}>
                  <td className="small">{when(r.startedAt)}{r.weekKey && <><br /><span className="tiny muted">{r.weekKey}</span></>}</td>
                  <td className="small">{r.trigger.replace("_", " ").toLowerCase()}</td>
                  <td><Pill tone={RUN_TONE[r.status]}>{r.status.toLowerCase()}</Pill></td>
                  <td className="small">{dur(r.durationMs)}</td>
                  <td className="small">{r.attempts}</td>
                  <td className="tiny muted">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminPage>
  );
}
