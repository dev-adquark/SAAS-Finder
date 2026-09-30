import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { formatDate } from "@/lib/freshness-rules";
import { productSyncStates, runStateLabel, runStats, syncDashboard, SYNC_STATE_LABEL, type ProductSyncState } from "@/lib/sync/dashboard";
import { AdminPage, DangerForm, Flash, Hidden, Pill } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/admin/auto-refresh";

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
  const active = d.active;
  const s = d.summary;
  return (
    <AdminPage title="Data sync">
      <Flash ok={sp.ok} error={sp.error} />
      <AutoRefresh active={!!active} />
      <p className="muted">
        Fully automatic, every 25 days: the official-website crawl and the G2 source run, results are validated, matched to products by G2 link or official domain, compared,
        written to the database and the site is revalidated. Official pages are authoritative for published prices and facts; confirmed changes apply automatically, and
        removals apply only after a second successful run confirms them. G2 data is stored as source data (never an editorial score or a published price) and fills only
        configured empty fields. A failed or blocked source never changes data — the previous value and its date stay. This page is monitoring; no action is required.
      </p>
      {!d.configured && <div className="flash err" role="alert">APIFY_API_TOKEN is not configured on the server. The automatic sync is disabled until it is added to the environment.</div>}
      <div className="inline-form" style={{ gap: 8, flexWrap: "wrap" }}>
        <form action={A.startFullSyncAction} className="inline-form">
          <label className="small muted"><input type="checkbox" name="confirm" required /> confirm</label>
          <button className="btn" type="submit" disabled={!d.configured || !!active}>Run sync now</button>
        </form>
        <form action={A.advanceSyncAction}><button className="btn secondary" type="submit" disabled={!active}>Refresh progress</button></form>
        <Pill tone={active ? "" : d.last ? RUN_TONE[d.last.status] : ""}>{active ? runStateLabel(active) : d.last ? `Idle · last run ${d.last.status.toLowerCase()}` : "Idle · no sync yet"}</Pill>
      </div>

      <div className="stat-grid section-gap">
        {[
          ["Last sync", d.lastFinished ? when(d.lastFinished.finishedAt) : "Never"],
          ["Last successful sync", d.lastSuccessful ? when(d.lastSuccessful.finishedAt) : "Never"],
          ["Next scheduled sync", when(d.nextRun)],
          ["Current status", active ? active.status.toLowerCase() : d.last ? d.last.status.toLowerCase() : "—"],
          ["Products added", s.productsAdded],
          ["Products updated", s.productsUpdated],
          ["Products unchanged", s.productsUnchanged],
          ["Retired (flagged)", s.productsRetiredFlagged],
          ["Official pages synced", s.officialPagesOk],
          ["G2 listings synced", s.g2ListingsOk],
          ["Not listed on G2", s.g2NotListed],
          ["Changes applied", s.changesApplied],
          ["Claims re-confirmed", s.claimsReverified],
          ["Not applied (see below)", s.changesPending],
          ["Sources unavailable", s.sourcesUnavailable],
          ["Validation failures", s.validationFailures],
          ["API errors", s.apiErrors],
          ["Retry attempts", s.retries],
          ["Sync duration", dur(s.durationMs)],
        ].map(([k, v]) => <div className="stat" key={String(k)}><div className="k">{k}</div><div className="v" style={{ fontSize: typeof v === "string" && v.length > 10 ? "1rem" : undefined }}>{v}</div></div>)}
      </div>

      <section className="panel section-gap" id="actors">
        <h2>Actor runs — {active ? "current sync" : "last sync"}</h2>
        {!d.actorRuns.length ? <p className="muted small">No Apify run recorded yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Phase</th><th>Source</th><th>Actor</th><th>Apify run ID</th><th>Result</th></tr></thead>
            <tbody>
              {d.actorRuns.map((a) => (
                <tr key={a.runId}>
                  <td className="small">{a.phase}</td>
                  <td className="small">{a.phase >= 3 ? "G2" : a.phase === 2 ? "Official (new links)" : "Official websites"}</td>
                  <td className="small"><code>{a.actor}</code></td>
                  <td className="small"><code>{a.runId}</code></td>
                  <td><Pill tone={a.status === "SUCCEEDED" ? "good" : a.status === "RUNNING" || a.status === "READY" ? "" : "bad"}>{a.status.toLowerCase()}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.errors.length > 0 && (
          <>
            <h3 className="section-gap">API errors — last sync ({d.errors.length})</h3>
            <table className="admin-table">
              <thead><tr><th>When</th><th>Source</th><th>Error</th></tr></thead>
              <tbody>{d.errors.map((e, i) => <tr key={i}><td className="small">{when(new Date(e.at))}</td><td className="small">{e.source}</td><td className="small">{e.message}</td></tr>)}</tbody>
            </table>
            <p className="tiny muted">Failed sources are retried automatically: API calls up to 3× with backoff, and a failed scheduled sync on the next daily tick (up to 3 attempts per cycle). Existing data was not changed.</p>
          </>
        )}
      </section>

      <section className="panel section-gap" id="review">
        <h2>Not applied automatically ({d.pendingChanges.length})</h2>
        <p className="muted small">Detections the sync could not apply safely on its own: removals waiting for a second run to confirm them, and new plans whose billing period the official page does not state. They resolve on their own in later syncs; the buttons are optional overrides.</p>
        {!d.pendingChanges.length ? <p className="muted small">Nothing outstanding.</p> : (
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
                    <td className="small"><strong>{c.newValue ?? "—"}</strong><br /><span className="tiny muted">First seen {formatDate(c.detectedAt)}{+c.lastSeenAt !== +c.detectedAt ? ` · last seen ${formatDate(c.lastSeenAt)}` : ""}</span><br /><span className="tiny muted">{c.note ?? (c.kind.endsWith("NOT_FOUND") ? "Applies automatically if the next successful sync confirms it." : c.kind === "NEW_PLAN" ? "Billing period not stated on the official page." : "")}</span></td>
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

      <section className="panel section-gap" id="g2">
        <h2>G2 source data ({d.g2Listings.length} matched)</h2>
        <p className="muted small">Matched by G2 link, then official domain, then exact name. Ratings are G2 users&apos; ratings shown with attribution on product pages — never the editorial score. G2 pricing is stored for reference only.</p>
        {!d.g2Listings.length ? <p className="muted small">No G2 data yet — it arrives with the next sync.</p> : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>G2 listing</th><th>G2 rating</th><th>Reviews</th><th>Domain</th><th>Status</th><th>Last synced</th></tr></thead>
            <tbody>
              {d.g2Listings.map((l) => (
                <tr key={l.id}>
                  <td>{l.product ? <Link href={`/admin/products/${l.product.id}`}>{l.product.name}</Link> : "—"}</td>
                  <td className="small"><a href={l.g2Url} target="_blank" rel="nofollow noopener noreferrer">{l.g2Slug} ↗</a></td>
                  <td className="small">{l.rating ?? "—"}</td>
                  <td className="small">{l.reviewCount?.toLocaleString("en-US") ?? "—"}</td>
                  <td className="small">{l.companyDomain ?? "—"}{l.domainConflict && <> <Pill tone="warn">differs from official URL</Pill></>}</td>
                  <td><Pill tone={l.status === "ACTIVE" ? "good" : "warn"}>{l.status.toLowerCase().replace("_", " ")}</Pill></td>
                  <td className="small">{when(l.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel section-gap" id="new-products">
        <h2>New products detected</h2>
        <p className="muted small">G2 products listed as competitors by at least two catalog products in one category are created automatically as drafts (no duplicates: slug and official domain are checked). They publish once the editorial content the publish gate requires is complete — the sync never invents reviews, pros/cons or FAQs.</p>
        {!d.autoCreated.length ? <p className="muted small">No products created automatically yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Category</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>{d.autoCreated.map((p) => <tr key={p.id}><td><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td><td className="small">{p.category.name}</td><td className="small">{when(p.autoCreatedAt)}</td><td><Pill>{p.status.toLowerCase()}</Pill></td></tr>)}</tbody>
          </table>
        )}
        {d.candidates.length > 0 && (
          <details className="section-gap"><summary className="small">Candidates being tracked ({d.candidates.length})</summary>
            <table className="admin-table">
              <thead><tr><th>G2 product</th><th>Domain</th><th>Listed as competitor by</th><th>Last seen</th></tr></thead>
              <tbody>{d.candidates.map((c) => <tr key={c.id}><td className="small"><a href={c.g2Url} target="_blank" rel="nofollow noopener noreferrer">{c.name} ↗</a></td><td className="small">{c.companyDomain ?? "—"}</td><td className="small">{c.mentions} product(s)</td><td className="small">{when(c.lastSyncedAt)}</td></tr>)}</tbody>
            </table>
          </details>
        )}
      </section>

      <section className="panel section-gap" id="history">
        <h2>Change history</h2>
        <p className="muted small">Every applied change keeps its previous value; revert restores it exactly.</p>
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
        <h2>Sync history</h2>
        {!d.runs.length ? <p className="muted small">No sync has run yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Duration</th><th>Attempts</th><th>Details</th></tr></thead>
            <tbody>
              {d.runs.map((r) => {
                const st = runStats(r);
                return (
                  <tr key={r.id}>
                    <td className="small">{when(r.startedAt)}{r.cycleKey && <><br /><span className="tiny muted">{r.cycleKey}</span></>}</td>
                    <td className="small">{r.trigger.replace("_", " ").toLowerCase()}</td>
                    <td><Pill tone={RUN_TONE[r.status]}>{r.status.toLowerCase()}</Pill></td>
                    <td className="small">{dur(r.durationMs)}</td>
                    <td className="small">{r.attempts}</td>
                    <td className="tiny">
                      <details>
                        <summary>Added {st.productsAdded ?? 0} · updated {st.productsUpdated ?? 0} · unchanged {st.productsUnchanged ?? 0} · errors {(st.errors ?? []).length}</summary>
                        <div className="muted" style={{ marginTop: 6 }}>
                          Official pages OK {st.officialPagesOk ?? 0} · G2 listings OK {st.g2ListingsOk ?? 0} · not on G2 {st.g2NotListed ?? 0} · G2 records scanned {st.g2Scanned ?? 0}, matched {st.g2Matched ?? 0}, invalid {st.g2Invalid ?? 0}<br />
                          Changes detected {st.changesDetected ?? 0} · applied {st.changesApplied ?? 0} · outstanding {st.changesPending ?? 0} · claims re-confirmed {st.claimsReverified ?? 0} · validation failures {st.validationFailures ?? 0} · retired flagged {st.productsRetiredFlagged ?? 0}<br />
                          {(st.actorRuns ?? []).map((a) => <span key={a.runId}>Phase {a.phase}: <code>{a.actor}</code> run <code>{a.runId}</code> ({a.status.toLowerCase()})<br /></span>)}
                          {(st.errors ?? []).map((e, i) => <span key={i}>{e.source}: {e.message}<br /></span>)}
                          {r.error && !(st.errors ?? []).length && <span>{r.error}</span>}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AdminPage>
  );
}
