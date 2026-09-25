import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { createCategoryAction } from "@/app/admin/actions";
import { routes } from "@/lib/seo/routes";
import { AdminPage, Area, Field, Flash } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function AdminCategories({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const rows = await db.category.findMany({ include: { _count: { select: { products: true, useCases: true, faqs: true, pairs: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <AdminPage title="Categories">
      <Flash ok={sp.ok} error={sp.error} />
      <table className="admin-table">
        <thead><tr><th>Category</th><th>URL</th><th>Products</th><th>Best-for</th><th>Comparisons</th><th>FAQs</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}><td><Link href={`/admin/categories/${c.id}`}><strong>{c.name}</strong></Link></td><td className="small">{routes.category(c.slug)}</td><td>{c._count.products}</td><td>{c._count.useCases}</td><td>{c._count.pairs}</td><td>{c._count.faqs}</td></tr>)}</tbody>
      </table>
      <form action={createCategoryAction} className="panel form-grid section-gap">
        <h2 className="full">New category</h2>
        <Field label="Name" name="name" required maxLength={120} />
        <Field label="Slug (blank = from name)" name="slug" maxLength={80} />
        <Field label="Short description" name="description" full maxLength={500} />
        <Area label="Hub introduction" name="intro" maxLength={5000} />
        <button className="btn primary" type="submit">Create category</button>
      </form>
    </AdminPage>
  );
}
