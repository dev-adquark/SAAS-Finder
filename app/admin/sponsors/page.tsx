import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { isRenderableSponsor, SPONSOR_MIN_PRIORITY, SPONSOR_PAGE_TYPES, SPONSOR_PLACEMENTS } from "@/lib/sponsors";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden, Pill, Select, dateInput } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

export default async function AdminSponsors({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const slots = await db.sponsorSlot.findMany({ orderBy: [{ pageType: "asc" }, { placement: "asc" }, { priority: "desc" }] });
  return (
    <AdminPage title="Sponsor slots">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">A slot renders only when it is active, within its dates, has a title, an HTTPS URL, a label containing &ldquo;Sponsored&rdquo;, and meets the placement&apos;s minimum priority (sidebar ≥ {SPONSOR_MIN_PRIORITY.sidebar}, inline ≥ {SPONSOR_MIN_PRIORITY.inline}). Sponsors never influence editorial lists. Clicks are tracked as <code>sponsor_click</code> via /sponsor/{"{id}"}.</p>
      <form action={A.createSponsorAction} className="panel form-grid">
        <h2 className="full">New sponsor slot</h2>
        <Field label="Title" name="title" required maxLength={120} />
        <Field label="Label" name="label" defaultValue="Sponsored" required maxLength={60} />
        <Select label="Page type" name="pageType" options={opts(SPONSOR_PAGE_TYPES)} />
        <Select label="Placement" name="placement" options={opts(SPONSOR_PLACEMENTS)} />
        <Field label="Priority (0–100)" name="priority" type="number" defaultValue={0} />
        <Field label="Campaign" name="campaign" maxLength={120} />
        <Field label="Destination URL (https)" name="url" type="url" full />
        <Area label="Short description" name="description" rows={2} maxLength={300} />
        <Field label="Starts" name="startsAt" type="date" />
        <Field label="Ends" name="endsAt" type="date" />
        <Check label="Active" name="active" />
        <button className="btn primary" type="submit">Create slot</button>
      </form>
      {slots.map((s) => (
        <section className="panel section-gap" key={s.id}>
          <h2>{s.title} <Pill tone={isRenderableSponsor(s) ? "good" : "warn"}>{isRenderableSponsor(s) ? "rendering" : "not rendering"}</Pill></h2>
          <form action={A.updateSponsorAction} className="form-grid">
            <Hidden name="sponsorId" value={s.id} />
            <Field label="Title" name="title" defaultValue={s.title} required maxLength={120} />
            <Field label="Label" name="label" defaultValue={s.label} required maxLength={60} />
            <Select label="Page type" name="pageType" options={opts(SPONSOR_PAGE_TYPES)} defaultValue={s.pageType} />
            <Select label="Placement" name="placement" options={opts(SPONSOR_PLACEMENTS)} defaultValue={s.placement} />
            <Field label="Priority" name="priority" type="number" defaultValue={s.priority} />
            <Field label="Campaign" name="campaign" defaultValue={s.campaign} maxLength={120} />
            <Field label="Destination URL" name="url" type="url" defaultValue={s.url} full />
            <Area label="Description" name="description" defaultValue={s.description} rows={2} maxLength={300} />
            <Field label="Starts" name="startsAt" type="date" defaultValue={dateInput(s.startsAt)} />
            <Field label="Ends" name="endsAt" type="date" defaultValue={dateInput(s.endsAt)} />
            <Check label="Active" name="active" defaultChecked={s.active} />
            <button className="btn secondary" type="submit">Save</button>
          </form>
          <DangerForm action={A.deleteSponsorAction}><Hidden name="sponsorId" value={s.id} /></DangerForm>
        </section>
      ))}
    </AdminPage>
  );
}
