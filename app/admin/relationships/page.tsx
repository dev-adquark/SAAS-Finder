import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { AGREEMENT_STATUSES, RELATIONSHIP_TYPES } from "@/lib/admin/inputs";
import { isActiveRelationship } from "@/lib/catalog";
import { formatDate } from "@/lib/freshness-rules";
import { AdminPage, Area, DangerForm, Field, Flash, Hidden, Pill, Select, dateInput } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export default async function AdminRelationships({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [rows, products] = await Promise.all([
    db.brandRelationship.findMany({ include: { product: { select: { name: true } } }, orderBy: [{ agreementStatus: "asc" }, { brand: "asc" }] }),
    db.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <AdminPage title="Brand & partner relationships">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="notice">
        Record <strong>documented</strong> agreements only. A product being reviewed is not a relationship. A relationship appears publicly only while it is ACTIVE, has a verification source and verifier, and is within its dates — expired agreements stop appearing automatically.
      </p>
      {rows.length === 0 && <p className="muted">No relationships recorded. All reviewed products are presented neutrally as &ldquo;Reviewed&rdquo; / &ldquo;Official vendor information&rdquo;.</p>}
      {rows.map((r) => {
        const live = isActiveRelationship(r);
        return (
          <section className="panel section-gap" key={r.id}>
            <h2>{r.brand} <Pill tone={live ? "good" : r.agreementStatus === "ENDED" ? "bad" : "warn"}>{live ? "LIVE" : r.agreementStatus}</Pill> <span className="small muted">{r.relationshipType}{r.product ? ` · ${r.product.name}` : ""}</span></h2>
            <p className="tiny muted">Verified {formatDate(r.verifiedAt) ?? "—"} by {r.verifiedBy ?? "—"} · {formatDate(r.startDate) ?? "no start"} → {formatDate(r.endDate) ?? "no end"}</p>
            <form action={A.updateRelationshipAction} className="form-grid">
              <Hidden name="relId" value={r.id} />
              <Select label="Status" name="agreementStatus" options={opts(AGREEMENT_STATUSES)} defaultValue={r.agreementStatus} />
              <Select label="Type" name="relationshipType" options={opts(RELATIONSHIP_TYPES)} defaultValue={r.relationshipType} />
              <Field label="Start" name="startDate" type="date" defaultValue={dateInput(r.startDate)} />
              <Field label="End" name="endDate" type="date" defaultValue={dateInput(r.endDate)} />
              <Field label="Verification source URL" name="sourceUrl" type="url" defaultValue={r.sourceUrl} full />
              <Field label="Verified by" name="verifiedBy" defaultValue={r.verifiedBy} maxLength={120} />
              <Area label="Notes" name="notes" defaultValue={r.notes} rows={2} maxLength={2000} />
              <button className="btn secondary" type="submit">Save</button>
            </form>
            <DangerForm action={A.deleteRelationshipAction}><Hidden name="relId" value={r.id} /></DangerForm>
          </section>
        );
      })}
      <form action={A.createRelationshipAction} className="panel form-grid section-gap">
        <h2>Record a documented relationship</h2>
        <Field label="Brand" name="brand" required maxLength={120} />
        <Select label="Product (optional)" name="productId" allowEmpty="— none —" options={products.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Type" name="relationshipType" options={opts(RELATIONSHIP_TYPES)} />
        <Select label="Status" name="agreementStatus" options={opts(AGREEMENT_STATUSES)} defaultValue="DRAFT" />
        <Field label="Official website" name="website" type="url" />
        <Field label="Verification source URL (agreement / network page)" name="sourceUrl" type="url" />
        <Field label="Verified by" name="verifiedBy" maxLength={120} />
        <Field label="Start" name="startDate" type="date" />
        <Field label="End" name="endDate" type="date" />
        <Area label="Notes" name="notes" rows={2} maxLength={2000} />
        <button className="btn primary" type="submit">Save as draft / activate</button>
      </form>
    </AdminPage>
  );
}
