import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDate } from "@/lib/freshness-rules";
import { isRenderableSponsor } from "@/lib/sponsors";
import { resolveOutbound } from "@/lib/outbound";
import { AdminPage, Pill } from "@/components/admin/ui";
import { HubTabs } from "@/components/admin/hub-tabs";
import { PARTNER_TABS } from "@/components/admin/nav";

type SP = { searchParams: Promise<{ type?: string }> };
type Row = { key: string; company: string; companyHref?: string; type: string; destination: string; tracking: string; clicks: number | null; active: boolean; label: string; placement: string; verification: string; verified: boolean; manage: string };

const host = (u: string | null | undefined) => {
  try {
    return u ? new URL(u).host.replace(/^www\./, "") : "—";
  } catch {
    return "invalid URL";
  }
};

// One view over every commercial relationship. The data stays in its own tables (affiliate links,
// sponsor slots, documented partner records); this page shows them side by side with the exact
// label the public site renders, so an affiliate can never be mistaken for an official link.
export default async function AdminPartners({ searchParams }: SP) {
  await requireAdminPage();
  const type = (await searchParams).type ?? "";
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [products, sponsors, relationships, outbound, sponsorClicks] = await Promise.all([
    db.product.findMany({ select: { id: true, name: true, slug: true, vendor: true, status: true, officialUrl: true, links: { where: { active: true }, orderBy: { updatedAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
    db.sponsorSlot.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }] }),
    db.brandRelationship.findMany({ include: { product: { select: { id: true, name: true } } }, orderBy: { brand: "asc" } }),
    db.analyticsEvent.groupBy({ by: ["productSlug"], where: { event: "outbound_click", createdAt: { gte: since } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["sponsorId"], where: { event: "sponsor_click", createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const clicksFor = new Map(outbound.map((r) => [r.productSlug, r._count._all]));
  const sponsorClicksFor = new Map(sponsorClicks.map((r) => [r.sponsorId, r._count._all]));
  const rows: Row[] = [
    ...products.map((p): Row => {
      const link = p.links[0];
      const target = resolveOutbound({ affiliate: link ? { url: link.url, label: link.label, provider: link.provider } : null, officialUrl: p.officialUrl });
      const affiliate = target?.kind === "affiliate";
      return {
        key: `p${p.id}`, company: p.vendor ?? p.name, companyHref: `/admin/products/${p.id}`, type: affiliate ? "Affiliate" : "Official vendor link",
        destination: host(target?.url), tracking: `/go/${p.slug}`, clicks: clicksFor.get(p.slug) ?? 0, active: p.status === "PUBLISHED" && !!target,
        label: affiliate ? "“Affiliate link” (links to disclosure)" : "“Official vendor site”", placement: "Every product CTA",
        verification: affiliate ? `Partner verified ${formatDate(link!.verifiedAt) ?? "—"}` : "Official URL from the product record", verified: affiliate ? !!link!.verifiedAt : true, manage: affiliate ? "/admin/affiliates" : `/admin/products/${p.id}`,
      };
    }),
    ...sponsors.map((s): Row => ({
      key: `s${s.id}`, company: s.title, type: "Sponsor", destination: host(s.url), tracking: `/sponsor/${s.id}`, clicks: sponsorClicksFor.get(s.id) ?? 0,
      active: isRenderableSponsor(s, now), label: `“${s.label}”`, placement: `${s.pageType} · ${s.placement}`,
      verification: s.startsAt || s.endsAt ? `${formatDate(s.startsAt) ?? "open"} → ${formatDate(s.endsAt) ?? "open"}` : "No schedule", verified: isRenderableSponsor(s, now), manage: "/admin/sponsors",
    })),
    ...relationships.map((r): Row => ({
      key: `r${r.id}`, company: r.brand, companyHref: r.product ? `/admin/products/${r.product.id}` : undefined, type: r.relationshipType.charAt(0) + r.relationshipType.slice(1).toLowerCase(),
      destination: host(r.website), tracking: "—", clicks: null, active: r.agreementStatus === "ACTIVE" && (!r.endDate || r.endDate >= now),
      label: r.agreementStatus === "ACTIVE" && r.verifiedAt ? "Disclosed on the product page" : "Not shown publicly", placement: r.product ? r.product.name : "Brand-level",
      verification: r.verifiedAt ? `Verified ${formatDate(r.verifiedAt)}${r.verifiedBy ? ` by ${r.verifiedBy}` : ""}` : "Not verified", verified: !!r.verifiedAt, manage: "/admin/relationships",
    })),
  ];
  const types = [...new Set(rows.map((r) => r.type))];
  const shown = type ? rows.filter((r) => r.type === type) : rows;
  return (
    <AdminPage title="Partners">
      <HubTabs tabs={PARTNER_TABS} label="Partner sections" />
      <p className="muted">Every outbound relationship in one place. Nothing here is implied by a product being reviewed: affiliates need a verified partner link, sponsors an active dated slot, and partner records a verification before anything is shown publicly. Clicks are the last 30 days of tracked redirects (automated agents excluded).</p>
      <form className="admin-filter" method="get">
        <label className="field">Type<select name="type" defaultValue={type}><option value="">All ({rows.length})</option>{types.map((t) => <option key={t} value={t}>{t} ({rows.filter((r) => r.type === t).length})</option>)}</select></label>
        <button className="btn secondary" type="submit">Apply</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Company</th><th>Type</th><th>Destination</th><th>Tracking</th><th>Status</th><th>Public label</th><th>Placement</th><th>Verification</th><th /></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td>{r.companyHref ? <Link href={r.companyHref}>{r.company}</Link> : r.company}</td>
              <td><Pill tone={r.type === "Affiliate" || r.type === "Sponsor" ? "warn" : ""}>{r.type}</Pill></td>
              <td className="small">{r.destination}</td>
              <td className="small"><code>{r.tracking}</code>{r.clicks !== null && <><br /><span className="tiny muted">{r.clicks} clicks / 30 days</span></>}</td>
              <td><Pill tone={r.active ? "good" : ""}>{r.active ? "active" : "inactive"}</Pill></td>
              <td className="small">{r.label}</td>
              <td className="small">{r.placement}</td>
              <td className="small"><Pill tone={r.verified ? "good" : "warn"}>{r.verified ? "ok" : "check"}</Pill> {r.verification}</td>
              <td><Link className="small" href={r.manage}>Manage</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminPage>
  );
}
