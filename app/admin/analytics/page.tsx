import { requireAdminPage } from "@/lib/admin/guard";
import { analyticsReport, analyticsWindow } from "@/lib/admin/services";
import { AdminPage } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ from?: string; to?: string }> };

function Table({ title, head, rows }: { title: string; head: string[]; rows: (string | number | null)[][] }) {
  return (
    <section className="panel section-gap">
      <h2>{title}</h2>
      {rows.length ? (
        <table className="admin-table"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c ?? "—"}</td>)}</tr>)}</tbody></table>
      ) : <p className="muted">No events in this window.</p>}
    </section>
  );
}

export default async function AdminAnalytics({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const { from, to } = analyticsWindow(sp.from ?? null, sp.to ?? null);
  const r = await analyticsReport(from, to);
  return (
    <AdminPage title="Analytics">
      <form className="panel form-grid" method="get">
        <label className="field">From<input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} /></label>
        <button className="btn secondary" type="submit">Apply</button>
      </form>
      <p className="muted">{r.total} events between {r.from.slice(0, 10)} and {r.to.slice(0, 10)}.</p>
      <Table title="Event counts" head={["Event", "Count"]} rows={r.byEvent.map((x) => [x.event, x.count])} />
      <Table title="Product breakdown (CTA + outbound clicks)" head={["Product", "Event", "Count"]} rows={r.byProduct.map((x) => [x.productSlug, x.event, x.count])} />
      <Table title="CTA performance" head={["CTA type", "Placement", "Page type", "Clicks"]} rows={r.ctaPerformance.map((x) => [x.ctaType, x.placement, x.pageType, x.count])} />
      <Table title="Sponsor clicks" head={["Sponsor slot", "Page type", "Clicks"]} rows={r.sponsorClicks.map((x) => [x.sponsorId, x.pageType, x.count])} />
      <Table title="Top pages (views)" head={["Path", "Views"]} rows={r.topPages.map((x) => [x.path, x.count])} />
    </AdminPage>
  );
}
