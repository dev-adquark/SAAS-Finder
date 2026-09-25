import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { createProductAction } from "@/app/admin/actions";
import { AdminPage, Area, Field, Flash, Select } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string }> };

export default async function NewProduct({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return (
    <AdminPage title="New product" back={{ href: "/admin/products", label: "Products" }}>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">New products start as drafts. After creating, add review content, FAQs, alternatives and comparison values; publishing is blocked until they are complete.</p>
      <form action={createProductAction} className="panel form-grid">
        <Field label="Name" name="name" required maxLength={120} />
        <Field label="Slug (URL: /{slug})" name="slug" required maxLength={80} hint="Lowercase, hyphens. Cannot be a reserved route or contain -vs-." />
        <Select label="Category" name="categoryId" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Field label="Vendor" name="vendor" maxLength={120} />
        <Field label="Official URL" name="officialUrl" type="url" required />
        <Field label="Official pricing URL" name="pricingUrl" type="url" />
        <Field label="Tagline" name="tagline" required full maxLength={300} />
        <Area label="Description" name="description" required maxLength={5000} />
        <button className="btn primary" type="submit">Create draft</button>
      </form>
    </AdminPage>
  );
}
