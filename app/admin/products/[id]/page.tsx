import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { comparisonSchemaFor, storedComparisonKeys } from "@/lib/content/comparison-schema";
import { strRecord } from "@/lib/catalog";
import { freshness, lastCheckedAt, refreshTargetDays, formatDate } from "@/lib/freshness-rules";
import { routes } from "@/lib/seo/routes";
import { BILLING_PERIODS, CONTENT_STATUSES, PRICE_SOURCE_TYPES, REVIEW_STATUSES } from "@/lib/admin/inputs";
import * as A from "@/app/admin/actions";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden, Pill, Select, dateInput, kv, lines, statusTone } from "@/components/admin/ui";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export default async function ProductEditor({ params, searchParams }: Props) {
  await requireAdminPage();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await db.product.findUnique({
    where: { id },
    include: {
      category: true, review: true, tags: { include: { tag: true } }, faqs: { orderBy: { sortOrder: "asc" } }, snapshots: { orderBy: { capturedAt: "desc" } }, links: { orderBy: { createdAt: "desc" } },
      alternativesFrom: { include: { alternative: { select: { id: true, name: true, slug: true } } }, orderBy: { sortOrder: "asc" } }, changelog: { orderBy: { changedAt: "desc" }, take: 20 },
      refreshes: { orderBy: { dueAt: "desc" }, take: 20 }, useCases: { include: { useCase: { select: { id: true, title: true } } } },
    },
  });
  if (!p) notFound();
  const [categories, others] = await Promise.all([db.category.findMany({ orderBy: { name: "asc" } }), db.product.findMany({ where: { id: { not: p.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const back = `/admin/products/${p.id}`;
  const comparison = strRecord(p.comparison);
  const known = new Set(storedComparisonKeys(p.category.slug));
  const extra = Object.fromEntries(Object.entries(comparison).filter(([k]) => !known.has(k)));
  const checked = lastCheckedAt(p.pricingCheckedAt, p.snapshots.find((s) => s.status === "VERIFIED")?.capturedAt);
  const f = freshness(checked, refreshTargetDays(p.refreshIntervalDays));
  const r = p.review;

  return (
    <AdminPage title={`Edit ${p.name}`} back={{ href: "/admin/products", label: "Products" }}>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="small">
        <Pill tone={statusTone(p.status)}>{p.status}</Pill> · Public URL: {p.status === "PUBLISHED" ? <Link href={routes.product(p.slug)}>{routes.product(p.slug)}</Link> : <span className="muted">{routes.product(p.slug)} (not public)</span>} ·
        Pricing freshness: <Pill tone={f.state === "fresh" ? "good" : f.state === "due-soon" ? "warn" : "bad"}>{f.state}</Pill> last checked {formatDate(checked) ?? "never"}, target {refreshTargetDays(p.refreshIntervalDays)} days
      </p>

      <form action={A.updateProductAction} className="panel form-grid">
        <Hidden name="id" value={p.id} />
        <Hidden name="categorySlugForSchema" value={p.category.slug} />
        <h2 className="full">Product</h2>
        <Field label="Name" name="name" defaultValue={p.name} required maxLength={120} />
        <Field label="Slug" name="slug" defaultValue={p.slug} required maxLength={80} hint="Changing the slug changes the canonical URL." />
        <Select label="Category" name="categoryId" defaultValue={p.categoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Field label="Subcategory" name="subcategory" defaultValue={p.subcategory} maxLength={120} />
        <Field label="Vendor" name="vendor" defaultValue={p.vendor} maxLength={120} />
        <Select label="Publish status" name="status" defaultValue={p.status} options={opts(CONTENT_STATUSES)} />
        <Field label="Official URL" name="officialUrl" type="url" defaultValue={p.officialUrl} required />
        <Field label="Official pricing URL" name="pricingUrl" type="url" defaultValue={p.pricingUrl} />
        <Field label="Tagline" name="tagline" defaultValue={p.tagline} full required maxLength={300} />
        <Area label="Description" name="description" defaultValue={p.description} required maxLength={5000} />
        <Area label="Key features (one per line)" name="features" defaultValue={lines(p.features)} />
        <Area label="Why people look for alternatives" name="alternativesIntro" defaultValue={p.alternativesIntro} maxLength={3000} />
        <Area label="Tags (one per line)" name="tags" defaultValue={p.tags.map((t) => t.tag.name).join("\n")} rows={3} />
        <Field label="SEO title override" name="seoTitle" defaultValue={p.seoTitle} maxLength={70} />
        <Field label="SEO description override" name="seoDescription" defaultValue={p.seoDescription} maxLength={170} />
        <Field label="Refresh interval override (days)" name="refreshIntervalDays" type="number" defaultValue={p.refreshIntervalDays} hint="Blank = default 90 days" />

        <h2 className="full">Comparison values ({p.category.name} schema)</h2>
        {comparisonSchemaFor(p.category.slug).filter((x) => !x.computed).map((x) => (
          <Field key={x.key} label={x.label} name={`cmp_${x.key}`} defaultValue={comparison[x.key]} maxLength={200} />
        ))}
        <p className="full small muted">Pricing is derived from verified snapshots and never typed here. If you change the category, save first, then fill the new category&apos;s fields.</p>
        {Object.keys(extra).length > 0 && <Area label="Other comparison values (key: value)" name="comparisonExtra" defaultValue={kv(extra)} rows={3} />}

        <h2 className="full">Review</h2>
        <Field label="Editorial score (0–5, blank = not scored)" name="rating" type="number" defaultValue={r?.rating} />
        <Select label="Review status" name="reviewStatus" defaultValue={r?.reviewStatus ?? "NOT_STARTED"} options={opts(REVIEW_STATUSES)} />
        <Field label="Reviewed by" name="reviewedBy" defaultValue={r?.reviewedBy} maxLength={120} />
        <Field label="Last editorial review" name="lastReviewedAt" type="date" defaultValue={dateInput(r?.lastReviewedAt)} />
        <Area label="Editorial summary" name="editorialSummary" defaultValue={r?.editorialSummary} maxLength={5000} />
        <Area label="Verdict" name="verdict" defaultValue={r?.verdict} rows={2} maxLength={1000} />
        <Area label="Pros (one per line)" name="pros" defaultValue={lines(r?.pros)} />
        <Area label="Cons (one per line)" name="cons" defaultValue={lines(r?.cons)} />
        <Area label="Best for (one per line)" name="bestFor" defaultValue={lines(r?.bestFor)} rows={3} />
        <Area label="Limitations (one per line)" name="limitations" defaultValue={lines(r?.limitations)} rows={3} />
        <button className="btn primary" type="submit">Save product</button>
      </form>

      <section className="panel section-gap">
        <h2>FAQs ({p.faqs.length})</h2>
        {p.faqs.map((q) => (
          <div className="faq" key={q.id}>
            <form action={A.updateFaqAction} className="form-grid">
              <Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} />
              <Field label="Question" name="question" defaultValue={q.question} full required maxLength={300} />
              <Area label="Answer" name="answer" defaultValue={q.answer} required rows={2} maxLength={3000} />
              <Field label="Order" name="sortOrder" type="number" defaultValue={q.sortOrder} />
              <button className="btn secondary" type="submit">Save FAQ</button>
            </form>
            <DangerForm action={A.deleteFaqAction}><Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} /></DangerForm>
          </div>
        ))}
        <form action={A.addFaqAction} className="form-grid section-gap">
          <Hidden name="ownerType" value="product" /><Hidden name="ownerId" value={p.id} /><Hidden name="back" value={back} />
          <Field label="New question" name="question" full required maxLength={300} />
          <Area label="Answer" name="answer" required rows={2} maxLength={3000} />
          <Field label="Order" name="sortOrder" type="number" defaultValue={p.faqs.length} />
          <button className="btn secondary" type="submit">Add FAQ</button>
        </form>
      </section>

      <section className="panel section-gap">
        <h2>Alternatives ({p.alternativesFrom.length})</h2>
        <table className="admin-table"><tbody>
          {p.alternativesFrom.map((a) => (
            <tr key={a.id}>
              <td style={{ width: "100%" }}>
                <form action={A.updateAlternativeAction} className="form-grid">
                  <Hidden name="altId" value={a.id} /><Hidden name="back" value={back} />
                  <strong className="full">{a.alternative.name}</strong>
                  <Area label="Editorial rationale" name="rationale" defaultValue={a.rationale} required rows={2} maxLength={1000} />
                  <Field label="Key difference" name="keyDifference" defaultValue={a.keyDifference} full maxLength={500} />
                  <Field label="Order" name="sortOrder" type="number" defaultValue={a.sortOrder} />
                  <Check label="Active" name="active" defaultChecked={a.active} />
                  <button className="btn secondary" type="submit">Save</button>
                </form>
                <DangerForm action={A.deleteAlternativeAction} label="Remove"><Hidden name="altId" value={a.id} /><Hidden name="back" value={back} /></DangerForm>
              </td>
            </tr>
          ))}
        </tbody></table>
        <form action={A.addAlternativeAction} className="form-grid section-gap">
          <Hidden name="id" value={p.id} /><Hidden name="back" value={back} />
          <Select label="Alternative product" name="alternativeId" options={others.map((o) => ({ value: o.id, label: o.name }))} />
          <Field label="Order" name="sortOrder" type="number" defaultValue={p.alternativesFrom.length} />
          <Area label="Editorial rationale (why it is a credible alternative)" name="rationale" required rows={2} maxLength={1000} />
          <Field label="Key difference" name="keyDifference" full maxLength={500} />
          <button className="btn secondary" type="submit">Add alternative</button>
        </form>
      </section>

      <section className="panel section-gap" id="pricing">
        <h2>Pricing snapshots</h2>
        <p className="small muted">Only VERIFIED snapshots are public. Record exactly what the official pricing page states; never estimate.</p>
        <table className="admin-table">
          <thead><tr><th>Captured</th><th>Plan / price</th><th>Source</th><th>Status</th><th /></tr></thead>
          <tbody>
            {p.snapshots.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.capturedAt)}</td>
                <td>{s.plan ?? "—"} {s.price !== null ? `${s.price.toString()} ${s.currency ?? ""}` : ""} {s.billingPeriod ?? ""}<br /><span className="small muted">{s.summary}</span></td>
                <td className="small">{s.sourceType}{s.sourceUrl && <><br /><a href={s.sourceUrl} rel="nofollow noopener" target="_blank">source</a></>}</td>
                <td><Pill tone={statusTone(s.status)}>{s.status}</Pill></td>
                <td>
                  {s.status === "PENDING" && (["verify", "reject"] as const).map((d) => (
                    <form key={d} action={A.reviewSnapshotAction} className="inline-form"><Hidden name="snapshotId" value={s.id} /><Hidden name="decision" value={d} /><Hidden name="back" value={back} /><button className={`btn ${d === "verify" ? "primary" : "secondary"}`} type="submit">{d}</button></form>
                  ))}
                  {s.status === "VERIFIED" && <form action={A.reviewSnapshotAction} className="inline-form"><Hidden name="snapshotId" value={s.id} /><Hidden name="decision" value="retire" /><Hidden name="back" value={back} /><button className="btn secondary" type="submit">retire</button></form>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={A.addSnapshotAction} className="form-grid section-gap">
          <Hidden name="id" value={p.id} /><Hidden name="back" value={back} />
          <Field label="Plan" name="plan" maxLength={100} />
          <Select label="Billing period" name="billingPeriod" options={opts(BILLING_PERIODS)} allowEmpty="—" />
          <Field label="Price (as listed)" name="price" type="number" />
          <Field label="Currency (ISO, e.g. USD)" name="currency" maxLength={3} />
          <Field label="Source URL" name="sourceUrl" type="url" defaultValue={p.pricingUrl} />
          <Select label="Source type" name="sourceType" options={opts(PRICE_SOURCE_TYPES)} defaultValue="OFFICIAL_PRICING_PAGE" />
          <Area label="Note / change summary" name="summary" required rows={2} maxLength={2000} />
          <Check label="I checked this against the source — mark as verified" name="verify" />
          <button className="btn secondary" type="submit">Record snapshot</button>
        </form>
      </section>

      <section className="panel section-gap">
        <h2>Affiliate links</h2>
        <p className="small muted">Only add links from a verified partner programme. Active HTTPS links replace the official URL behind /go/{p.slug}.</p>
        <table className="admin-table"><tbody>
          {p.links.map((l) => (
            <tr key={l.id}>
              <td>{l.label}<br /><span className="small muted">{l.provider ?? "—"} · {l.url}</span></td>
              <td><Pill tone={l.active ? "good" : "warn"}>{l.active ? "active" : "inactive"}</Pill></td>
              <td>
                <form action={A.toggleLinkAction} className="inline-form"><Hidden name="linkId" value={l.id} /><Hidden name="active" value={String(!l.active)} /><Hidden name="back" value={back} /><button className="btn secondary" type="submit">{l.active ? "Deactivate" : "Activate (verified)"}</button></form>
                <DangerForm action={A.deleteLinkAction}><Hidden name="linkId" value={l.id} /><Hidden name="back" value={back} /></DangerForm>
              </td>
            </tr>
          ))}
        </tbody></table>
        <form action={A.addLinkAction} className="form-grid section-gap">
          <Hidden name="id" value={p.id} /><Hidden name="back" value={back} />
          <Field label="Label" name="label" required maxLength={120} />
          <Field label="Network / provider" name="provider" maxLength={120} />
          <Field label="Affiliate URL (https)" name="url" type="url" required full />
          <Check label="Partner relationship verified — activate" name="active" />
          <button className="btn secondary" type="submit">Add link</button>
        </form>
      </section>

      <section className="panel section-gap">
        <h2>Refresh tasks</h2>
        <table className="admin-table"><tbody>
          {p.refreshes.map((t) => (
            <tr key={t.id}>
              <td>{formatDate(t.dueAt)}<br /><span className="small muted">{t.reason}</span></td>
              <td>{t.completedAt ? <><Pill tone="good">done {formatDate(t.completedAt)}</Pill><br /><span className="small muted">{t.resolution}</span></> : <Pill tone="warn">open</Pill>}</td>
              <td>
                {t.completedAt ? (
                  <form action={A.reopenRefreshAction} className="inline-form"><Hidden name="refreshId" value={t.id} /><Hidden name="back" value={back} /><button className="btn secondary" type="submit">Reopen</button></form>
                ) : (
                  <form action={A.resolveRefreshAction} className="inline-form"><Hidden name="refreshId" value={t.id} /><Hidden name="back" value={back} /><input name="note" placeholder="What you checked" maxLength={500} /> <button className="btn secondary" type="submit">Checked — no change</button></form>
                )}
              </td>
            </tr>
          ))}
        </tbody></table>
        <form action={A.addRefreshAction} className="form-grid section-gap">
          <Hidden name="id" value={p.id} /><Hidden name="back" value={back} />
          <Field label="Due date" name="dueAt" type="date" required />
          <Field label="Reason" name="reason" required maxLength={500} />
          <button className="btn secondary" type="submit">Schedule refresh</button>
        </form>
      </section>

      <section className="panel section-gap">
        <h2>Change log</h2>
        <ul className="list">{p.changelog.map((c) => <li key={c.id}><strong>{formatDate(c.changedAt)}</strong> [{c.version}] {c.summary}</li>)}</ul>
        <form action={A.addChangelogAction} className="form-grid">
          <Hidden name="id" value={p.id} />
          <Field label="Version / label" name="version" required maxLength={60} />
          <Field label="Summary" name="summary" required maxLength={2000} />
          <button className="btn secondary" type="submit">Add entry</button>
        </form>
      </section>

      <section className="panel section-gap">
        <h2>Best-for memberships</h2>
        {p.useCases.length ? <ul className="list">{p.useCases.map((u) => <li key={u.id}><Link href={`/admin/use-cases/${u.useCase.id}`}>{u.useCase.title}</Link> (position {u.position}{u.active ? "" : ", inactive"})</li>)}</ul> : <p className="muted">Not featured in any best-for page.</p>}
      </section>

      <section className="panel section-gap">
        <h2>Delete</h2>
        <p className="small muted">Published products cannot be deleted; archive first. Deleting removes FAQs, snapshots, links and history for this product.</p>
        <DangerForm action={A.deleteProductAction} label="Delete product"><Hidden name="id" value={p.id} /></DangerForm>
      </section>
    </AdminPage>
  );
}
