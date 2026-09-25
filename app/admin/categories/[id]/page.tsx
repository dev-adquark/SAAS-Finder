import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { AdminPage, Area, DangerForm, Field, Flash, Hidden } from "@/components/admin/ui";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

export default async function EditCategory({ params, searchParams }: Props) {
  await requireAdminPage();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await db.category.findUnique({ where: { id }, include: { faqs: { orderBy: { sortOrder: "asc" } } } });
  if (!c) notFound();
  const back = `/admin/categories/${c.id}`;
  return (
    <AdminPage title={`Edit ${c.name}`} back={{ href: "/admin/categories", label: "Categories" }}>
      <Flash ok={sp.ok} error={sp.error} />
      <form action={A.updateCategoryAction} className="panel form-grid">
        <Hidden name="id" value={c.id} />
        <Field label="Name" name="name" defaultValue={c.name} required maxLength={120} />
        <Field label="Slug" name="slug" defaultValue={c.slug} required maxLength={80} hint="Changes the /category/{slug} URL" />
        <Field label="Short description" name="description" defaultValue={c.description} full maxLength={500} />
        <Area label="Hub introduction (blank line between paragraphs)" name="intro" defaultValue={c.intro} rows={6} maxLength={5000} />
        <Field label="SEO title" name="seoTitle" defaultValue={c.seoTitle} maxLength={70} />
        <Field label="SEO description" name="seoDescription" defaultValue={c.seoDescription} maxLength={170} />
        <Field label="Sort order" name="sortOrder" type="number" defaultValue={c.sortOrder} />
        <button className="btn primary" type="submit">Save category</button>
      </form>
      <section className="panel section-gap">
        <h2>Category FAQs</h2>
        {c.faqs.map((q) => (
          <div className="faq" key={q.id}>
            <form action={A.updateFaqAction} className="form-grid">
              <Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} />
              <Field label="Question" name="question" defaultValue={q.question} full required maxLength={300} />
              <Area label="Answer" name="answer" defaultValue={q.answer} required rows={2} maxLength={3000} />
              <Field label="Order" name="sortOrder" type="number" defaultValue={q.sortOrder} />
              <button className="btn secondary" type="submit">Save FAQ</button>
            </form>
            <DangerForm action={A.deleteFaqAction}><Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} /></DangerForm>
          </div>
        ))}
        <form action={A.addFaqAction} className="form-grid section-gap">
          <Hidden name="ownerType" value="category" /><Hidden name="ownerId" value={c.id} /><Hidden name="back" value={back} />
          <Field label="New question" name="question" full required maxLength={300} />
          <Area label="Answer" name="answer" required rows={2} maxLength={3000} />
          <button className="btn secondary" type="submit">Add FAQ</button>
        </form>
      </section>
      <section className="panel section-gap">
        <h2>Delete</h2>
        <p className="small muted">Only possible when no products, use cases or comparisons reference this category.</p>
        <DangerForm action={A.deleteCategoryAction} label="Delete category"><Hidden name="id" value={c.id} /></DangerForm>
      </section>
    </AdminPage>
  );
}
