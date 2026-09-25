import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { revalidateAllAction } from "@/app/admin/actions";
import { AdminPage, Flash } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function Dashboard({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  if (!process.env.DATABASE_URL) return <AdminPage title="Admin"><p className="muted">Configure DATABASE_URL to manage content.</p></AdminPage>;
  const now = new Date();
  const [byStatus, pending, due, useCases, pairs, sponsors, events] = await Promise.all([
    db.product.groupBy({ by: ["status"], _count: { _all: true } }),
    db.pricingSnapshot.count({ where: { status: "PENDING" } }),
    db.contentRefresh.count({ where: { completedAt: null, dueAt: { lte: now } } }),
    db.useCase.count({ where: { status: "PUBLISHED" } }),
    db.competitorPair.count({ where: { active: true } }),
    db.sponsorSlot.count({ where: { active: true } }),
    db.analyticsEvent.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
  ]);
  const count = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
  const cards: [string, number | string, string][] = [
    ["Published products", count("PUBLISHED"), "/admin/products"],
    ["Drafts / in review", count("DRAFT") + count("REVIEW"), "/admin/products"],
    ["Pricing awaiting review", pending, "/admin/pricing"],
    ["Refreshes due", due, "/admin/refreshes"],
    ["Published best-for pages", useCases, "/admin/use-cases"],
    ["Active comparisons", pairs, "/admin/comparisons"],
    ["Active sponsor slots", sponsors, "/admin/sponsors"],
    ["Events (7 days)", events, "/admin/analytics"],
  ];
  return (
    <AdminPage title="Admin dashboard">
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid">
        {cards.map(([label, value, href]) => (
          <Link className="card" href={href} key={label}><strong style={{ fontSize: 28 }}>{value}</strong><p className="muted">{label}</p></Link>
        ))}
      </div>
      <form action={revalidateAllAction} className="section-gap"><button className="btn secondary" type="submit">Revalidate all public pages</button></form>
    </AdminPage>
  );
}
