import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { createUseCaseAction } from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Field, Flash, Pill, Select, statusTone } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminUseCases({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const [rows, categories] = await Promise.all([
    db.useCase.findMany({ include: { category: true, _count: { select: { products: true, faqs: true } } }, orderBy: [{ category: { name: "asc" } }, { title: "asc" }] }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <AdminPage title="Best-for use cases">
      <Flash ok={sp.ok} error={sp.error} />
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
