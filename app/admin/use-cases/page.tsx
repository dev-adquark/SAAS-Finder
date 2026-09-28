import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { createUseCaseAction } from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Field, Flash, Pill, Select, statusTone } from "@/components/admin/ui";
import { HubTabs } from "@/components/admin/hub-tabs";
import { PUBLISHING_TABS } from "@/components/admin/nav";


type SP = { searchParams: Promise<{ ok?: string; error?: string; q?: string; status?: string }> };

export default async function AdminUseCases({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [allRows, categories] = await Promise.all([
    db.useCase.findMany({ include: { category: true, _count: { select: { products: true, faqs: true } } }, orderBy: [{ category: { name: "asc" } }, { title: "asc" }] }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const rows = allRows.filter((u) => (!q || `${u.title} ${u.slug}`.toLowerCase().includes(q)) && (!sp.status || u.status === sp.status));
  return (
    <AdminPage title="Best-for use cases">
      <HubTabs tabs={PUBLISHING_TABS} label="Publishing sections" />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="admin-filter" method="get" role="search">
        <label className="field">Search<input name="q" defaultValue={sp.q ?? ""} placeholder="Guide title" maxLength={80} /></label>
        <label className="field">Status<select name="status" defaultValue={sp.status ?? ""}><option value="">All</option>{["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label>
        <button className="btn secondary" type="submit">Apply</button>
      </form>
      <p className="small muted">{rows.length} of {allRows.length} guides</p>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>URL</th><th>Category</th><th>Status</th><th>Picks</th><th>FAQs</th></tr></thead>
        <tbody>{rows.map((u) => <tr key={u.id}><td><Link href={`/admin/use-cases/${u.id}`}><strong>{u.title}</strong></Link></td><td className="small">{routes.best(u.slug)}</td><td>{u.category.name}</td><td><Pill tone={statusTone(u.status)}>{u.status}</Pill></td><td>{u._count.products}</td><td>{u._count.faqs}</td></tr>)}</tbody>
      </table>
      <form action={createUseCaseAction} className="panel form-grid section-gap">
        <h2 className="full">New use case</h2>
        <Field label="Title (search intent)" name="title" required maxLength={150} placeholder="Best CRM for Freelancers" />
        <Field label="Slug" name="slug" required maxLength={80} placeholder="crm-for-freelancers" />
        <Field label="Audience" name="audience" required maxLength={120} />
        <Select label="Category" name="categoryId" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Area label="Introduction" name="intro" required maxLength={5000} />
        <Area label="Selection criteria (Name: description per line)" name="criteria" required />
        <button className="btn primary" type="submit">Create draft</button>
      </form>
    </AdminPage>
  );
}
