import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { isRenderableSponsor, pickSponsor, SPONSOR_MIN_PRIORITY, SPONSOR_PAGE_TYPES, SPONSOR_PLACEMENT_FOR_PAGE_TYPE, type SponsorPageType, type SponsorRecord } from "@/lib/sponsors";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden, Pill, Select, dateInput } from "@/components/admin/ui";
import { HubTabs } from "@/components/admin/hub-tabs";
import { PARTNER_TABS } from "@/components/admin/nav";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

/** Which sponsor actually wins each (pageType, placement) slot right now — the same contest the
 * public /api/sponsors endpoint runs — so a slot's real winner is visible, not just each row's own
 * validity. A sponsor can pass every one of its own rules and still never render because another
 * active sponsor for the identical slot outranks it; that state is otherwise invisible in admin. */
function slotStatus(slot: SponsorRecord, all: SponsorRecord[]): { tone: "good" | "warn" | "bad" | ""; text: string } {
  if (!isRenderableSponsor(slot)) {
    if (!slot.active) return { tone: "", text: "Inactive" };
    if (!slot.title?.trim() || !slot.label?.trim() || !slot.url) return { tone: "bad", text: "Incomplete (title, label and an HTTPS URL are required)" };
    if (slot.startsAt && slot.startsAt > new Date()) return { tone: "warn", text: "Not yet started" };
    if (slot.endsAt && slot.endsAt < new Date()) return { tone: "bad", text: "Ended" };
    return { tone: "bad", text: `Priority below the ${slot.placement} minimum (${SPONSOR_MIN_PRIORITY[slot.placement as "sidebar" | "inline"] ?? "?"})` };
  }
  const winner = pickSponsor(all, slot.pageType as SponsorPageType, slot.placement as never);
  if (winner?.id === slot.id) return { tone: "good", text: "Live now" };
  return { tone: "warn", text: `Outranked by "${winner?.title}" (priority ${winner?.priority} vs ${slot.priority})` };
}

export default async function AdminSponsors({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const slots = await db.sponsorSlot.findMany({ orderBy: [{ pageType: "asc" }, { placement: "asc" }, { priority: "desc" }] });
  return (
    <AdminPage title="Sponsor slots">
      <HubTabs tabs={PARTNER_TABS} label="Partner sections" />
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">
        Placement is fixed per page type — product, alternatives and best-for guides show a sponsor in the sidebar; category and comparison pages show one inline — so there is no way to configure a slot nothing on the site actually requests.
        A slot renders only when it is active, within its dates, complete (title, label containing &ldquo;Sponsored&rdquo;, HTTPS URL) and meets its placement&apos;s minimum priority (sidebar ≥ {SPONSOR_MIN_PRIORITY.sidebar}, inline ≥ {SPONSOR_MIN_PRIORITY.inline}).
        When two active slots target the same page type, only the higher-priority one shows — the other is marked &ldquo;Outranked&rdquo; below, not hidden silently. Sponsors never influence editorial lists. Clicks are tracked as <code>sponsor_click</code> via /sponsor/{"{id}"}.
      </p>
      <form action={A.createSponsorAction} className="panel form-grid">
        <h2 className="full">New sponsor slot</h2>
        <Field label="Title" name="title" required maxLength={120} />
        <Field label="Label" name="label" defaultValue="Sponsored" required maxLength={60} />
        <Select label="Page type" name="pageType" options={SPONSOR_PAGE_TYPES.map((v) => ({ value: v, label: `${v} (${SPONSOR_PLACEMENT_FOR_PAGE_TYPE[v]})` }))} />
        <Field label="Priority (0–100)" name="priority" type="number" defaultValue={0} hint="Inline placements (category, compare) need 10+ to render at all." />
        <Field label="Campaign" name="campaign" maxLength={120} />
        <Field label="Destination URL (https)" name="url" type="url" full />
        <Area label="Short description" name="description" rows={2} maxLength={300} />
        <Field label="Starts" name="startsAt" type="date" />
        <Field label="Ends" name="endsAt" type="date" />
        <Check label="Active" name="active" />
        <button className="btn primary" type="submit">Create slot</button>
      </form>
      {slots.map((s) => {
        const status = slotStatus(s, slots);
        return (
          <section className="panel section-gap" key={s.id}>
            <h2>{s.title} <Pill tone={status.tone}>{status.text}</Pill></h2>
            <form action={A.updateSponsorAction} className="form-grid">
              <Hidden name="sponsorId" value={s.id} />
              <Field label="Title" name="title" defaultValue={s.title} required maxLength={120} />
              <Field label="Label" name="label" defaultValue={s.label} required maxLength={60} />
              <Select label="Page type" name="pageType" options={SPONSOR_PAGE_TYPES.map((v) => ({ value: v, label: `${v} (${SPONSOR_PLACEMENT_FOR_PAGE_TYPE[v]})` }))} defaultValue={s.pageType} />
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
        );
      })}
    </AdminPage>
  );
}
