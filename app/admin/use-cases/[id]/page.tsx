import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { CONTENT_STATUSES } from "@/lib/admin/inputs";
import * as A from "@/app/admin/actions";
import { AdminPage, Area, Check, DangerForm, Field, Flash, Hidden, Select } from "@/components/admin/ui";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> };

export default async function EditUseCase({ params, searchParams }: Props) {
  await requireAdminPage();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const u = await db.useCase.findUnique({ where: { id }, include: { products: { include: { product: { select: { name: true, status: true } } }, orderBy: { position: "asc" } }, faqs: { orderBy: { sortOrder: "asc" } } } });
  if (!u) notFound();
  const [categories, candidates] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.product.findMany({ where: { categoryId: u.categoryId, useCases: { none: { useCaseId: u.id } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const criteria = Array.isArray(u.criteria) ? (u.criteria as { name: string; description: string }[]).map((c) => `${c.name}: ${c.description}`).join("\n") : "";
  const back = `/admin/use-cases/${u.id}`;
  return (
    <AdminPage title={`Edit ${u.title}`} back={{ href: "/admin/use-cases", label: "Best-for use cases" }}>
      <Flash ok={sp.ok} error={sp.error} />
      <form action={A.updateUseCaseAction} className="panel form-grid">
        <Hidden name="id" value={u.id} />
        <Field label="Title" name="title" defaultValue={u.title} required maxLength={150} />
        <Field label="Slug" name="slug" defaultValue={u.slug} required maxLength={80} />
        <Field label="Audience" name="audience" defaultValue={u.audience} required maxLength={120} />
        <Select label="Category" name="categoryId" defaultValue={u.categoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Select label="Status" name="status" defaultValue={u.status} options={CONTENT_STATUSES.map((s) => ({ value: s, label: s }))} />
        <Field label="SEO title" name="seoTitle" defaultValue={u.seoTitle} maxLength={70} />
        <Field label="SEO description" name="seoDescription" defaultValue={u.seoDescription} full maxLength={170} />
        <Area label="Introduction (blank line between paragraphs)" name="intro" defaultValue={u.intro} rows={6} required maxLength={5000} />
        <Area label="Selection criteria (Name: description per line)" name="criteria" defaultValue={criteria} rows={5} required />
        <button className="btn primary" type="submit">Save use case</button>
      </form>

      <section className="panel section-gap">
        <h2>Picks (editorial order)</h2>
        {u.products.map((row) => (
          <div className="faq" key={row.id}>
            <form action={A.updateUseCaseProductAction} className="form-grid">
              <Hidden name="id" value={u.id} /><Hidden name="rowId" value={row.id} />
              <strong className="full">{row.product.name} {row.product.status !== "PUBLISHED" && <span className="pill warn">not published</span>}</strong>
              <Area label="Why it fits" name="rationale" defaultValue={row.rationale} required rows={2} maxLength={1500} />
              <Area label="Limitations to weigh" name="caveat" defaultValue={row.caveat} rows={2} maxLength={800} />
              <Field label="Position" name="position" type="number" defaultValue={row.position} />
              <Check label="Active" name="active" defaultChecked={row.active} />
              <button className="btn secondary" type="submit">Save pick</button>
            </form>
            <DangerForm action={A.deleteUseCaseProductAction} label="Remove"><Hidden name="id" value={u.id} /><Hidden name="rowId" value={row.id} /></DangerForm>
          </div>
        ))}
        {candidates.length > 0 && (
          <form action={A.addUseCaseProductAction} className="form-grid section-gap">
            <Hidden name="id" value={u.id} />
            <Select label="Product" name="productId" options={candidates.map((c) => ({ value: c.id, label: c.name }))} />
            <Field label="Position" name="position" type="number" defaultValue={u.products.length} />
            <Area label="Why it fits" name="rationale" required rows={2} maxLength={1500} />
            <Area label="Limitations to weigh" name="caveat" rows={2} maxLength={800} />
            <button className="btn secondary" type="submit">Add pick</button>
          </form>
        )}
      </section>

      <section className="panel section-gap">
        <h2>FAQs</h2>
        {u.faqs.map((q) => (
          <div className="faq" key={q.id}>
            <form action={A.updateFaqAction} className="form-grid">
              <Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} />
              <Field label="Question" name="question" defaultValue={q.question} full required maxLength={300} />
              <Area label="Answer" name="answer" defaultValue={q.answer} required rows={2} maxLength={3000} />
              <button className="btn secondary" type="submit">Save FAQ</button>
            </form>
            <DangerForm action={A.deleteFaqAction}><Hidden name="faqId" value={q.id} /><Hidden name="back" value={back} /></DangerForm>
          </div>
        ))}
        <form action={A.addFaqAction} className="form-grid section-gap">
          <Hidden name="ownerType" value="useCase" /><Hidden name="ownerId" value={u.id} /><Hidden name="back" value={back} />
          <Field label="New question" name="question" full required maxLength={300} />
          <Area label="Answer" name="answer" required rows={2} maxLength={3000} />
          <button className="btn secondary" type="submit">Add FAQ</button>
        </form>
      </section>
      <section className="panel section-gap">
        <h2>Delete</h2>
        <DangerForm action={A.deleteUseCaseAction} label="Delete use case"><Hidden name="id" value={u.id} /></DangerForm>
      </section>
    </AdminPage>
  );
}
