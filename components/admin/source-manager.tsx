import * as A from "@/app/admin/actions";
import { FACT_KEYS, SOURCE_KINDS, SOURCE_STATUSES } from "@/lib/admin/inputs";
import { SOURCE_EXPIRY_DAYS } from "@/lib/admin/services";
import { formatDate } from "@/lib/freshness-rules";
import { FACT_LABELS } from "@/components/verification";
import { Area, DangerForm, Field, Hidden, Pill, Select, dateInput } from "@/components/admin/ui";

type Source = { id: string; kind: string; url: string; name: string; section: string | null; checkedAt: Date | null; status: string; notes: string | null };
type Fact = { id: string; key: string; value: string; evidence: string | null; sourceId: string | null; status: string; checkedAt: Date | null };
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

function effectiveStatus(s: { status: string; checkedAt: Date | null }) {
  if (s.status === "VERIFIED" && (!s.checkedAt || Date.now() - s.checkedAt.getTime() > SOURCE_EXPIRY_DAYS * 86_400_000)) return "EXPIRED";
  return s.status;
}
const tone = (s: string) => (s === "VERIFIED" ? "good" : s === "EXPIRED" || s === "BROKEN" ? "bad" : "warn");

/** Source & fact management for one product (admin). */
export function SourceManager({ productId, sources, facts }: { productId: string; sources: Source[]; facts: Fact[] }) {
  const missing = FACT_KEYS.filter((k) => !facts.some((f) => f.key === k));
  return (
    <section className="panel section-gap" id="sources">
      <h2>Sources &amp; verification</h2>
      <p className="small muted">Only official vendor pages (or reputable independent sources for claims the vendor doesn&apos;t publish). Verified sources older than {SOURCE_EXPIRY_DAYS} days show as expired.</p>
      <table className="admin-table">
        <thead><tr><th>Source</th><th>Kind</th><th>Status</th><th>Checked</th><th /></tr></thead>
        <tbody>
          {sources.map((s) => {
            const st = effectiveStatus(s);
            return (
              <tr key={s.id}>
                <td><a href={s.url} target="_blank" rel="nofollow noopener noreferrer">{s.name}</a><br /><span className="tiny muted">{s.url}</span></td>
                <td className="small">{s.kind}</td>
                <td><Pill tone={tone(st)}>{st}</Pill></td>
                <td className="small">{formatDate(s.checkedAt) ?? "—"}</td>
                <td>
                  <form action={A.verifySourceAction} className="inline-form"><Hidden name="id" value={productId} /><Hidden name="sourceId" value={s.id} /><button className="btn secondary" type="submit">Mark verified today</button></form>
                  <form action={A.updateSourceAction} className="inline-form"><Hidden name="id" value={productId} /><Hidden name="sourceId" value={s.id} /><Hidden name="status" value="BROKEN" /><button className="btn ghost" type="submit">Mark broken</button></form>
                  <DangerForm action={A.deleteSourceAction}><Hidden name="id" value={productId} /><Hidden name="sourceId" value={s.id} /></DangerForm>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <form action={A.addSourceAction} className="form-grid section-gap">
        <Hidden name="id" value={productId} />
        <Select label="Kind" name="kind" options={opts(SOURCE_KINDS)} />
        <Select label="Status" name="status" options={opts(SOURCE_STATUSES)} defaultValue="NEEDS_VERIFICATION" />
        <Field label="Name" name="name" required maxLength={120} />
        <Field label="Section (optional)" name="section" maxLength={120} />
        <Field label="URL (https)" name="url" type="url" required full />
        <Field label="Checked on" name="checkedAt" type="date" />
        <button className="btn secondary" type="submit">Add source</button>
      </form>

      <h3 className="section-gap">Sourced facts</h3>
      <p className="small muted">A fact is public as verified only with a verified source and a verbatim evidence quote. Missing keys: {missing.map((k) => FACT_LABELS[k]).join(", ") || "none"}.</p>
      {facts.map((f) => (
        <div className="faq" key={f.id}>
          <form action={A.upsertFactAction} className="form-grid">
            <Hidden name="id" value={productId} /><Hidden name="key" value={f.key} />
            <strong className="full">{FACT_LABELS[f.key] ?? f.key} <Pill tone={tone(f.status)}>{f.status}</Pill> <span className="tiny muted">{formatDate(f.checkedAt)}</span></strong>
            <Field label="Value" name="value" defaultValue={f.value} full required maxLength={300} />
            <Area label="Evidence (verbatim quote from the source)" name="evidence" defaultValue={f.evidence} rows={2} maxLength={500} />
            <Select label="Source" name="sourceId" defaultValue={f.sourceId} allowEmpty="— none —" options={sources.map((s) => ({ value: s.id, label: `${s.kind}: ${s.name}` }))} />
            <Select label="Status" name="status" defaultValue={f.status} options={opts(SOURCE_STATUSES)} />
            <Field label="Checked on" name="checkedAt" type="date" defaultValue={dateInput(f.checkedAt)} />
            <button className="btn secondary" type="submit">Save fact</button>
          </form>
          <DangerForm action={A.deleteFactAction}><Hidden name="id" value={productId} /><Hidden name="factId" value={f.id} /></DangerForm>
        </div>
      ))}
      {missing.length > 0 && (
        <form action={A.upsertFactAction} className="form-grid section-gap">
          <Hidden name="id" value={productId} />
          <Select label="Fact" name="key" options={missing.map((k) => ({ value: k, label: FACT_LABELS[k] }))} />
          <Select label="Source" name="sourceId" allowEmpty="— none —" options={sources.map((s) => ({ value: s.id, label: `${s.kind}: ${s.name}` }))} />
          <Field label="Value" name="value" full required maxLength={300} />
          <Area label="Evidence (verbatim quote)" name="evidence" rows={2} maxLength={500} />
          <Select label="Status" name="status" options={opts(SOURCE_STATUSES)} defaultValue="NEEDS_VERIFICATION" />
          <button className="btn secondary" type="submit">Add fact</button>
        </form>
      )}
    </section>
  );
}
