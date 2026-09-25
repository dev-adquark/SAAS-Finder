import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import * as A from "@/app/admin/actions";
import { AdminPage, Area, DangerForm, Field, Flash, Hidden, Pill } from "@/components/admin/ui";

type SP = { searchParams: Promise<{ ok?: string; error?: string; owner?: string }> };

// All FAQs in one place: product, category and use-case FAQs (each rendered with FAQPage schema
// on its public page only when visible).
export default async function AdminFaqs({ searchParams }: SP) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter = sp.owner === "product" || sp.owner === "category" || sp.owner === "useCase" ? sp.owner : null;
  const faqs = await db.faq.findMany({
    where: filter === "product" ? { productId: { not: null } } : filter === "category" ? { categoryId: { not: null } } : filter === "useCase" ? { useCaseId: { not: null } } : {},
    include: { product: { select: { id: true, name: true } }, category: { select: { id: true, name: true } }, useCase: { select: { id: true, title: true } } },
    orderBy: [{ productId: "asc" }, { categoryId: "asc" }, { useCaseId: "asc" }, { sortOrder: "asc" }],
    take: 500,
  });
  const owner = (f: (typeof faqs)[number]) =>
    f.product ? { kind: "Product", name: f.product.name, href: `/admin/products/${f.product.id}` } : f.category ? { kind: "Category", name: f.category.name, href: `/admin/categories/${f.category.id}` } : { kind: "Best-for", name: f.useCase?.title ?? "", href: `/admin/use-cases/${f.useCase?.id}` };
  return (
    <AdminPage title={`FAQs (${faqs.length})`}>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted">Add new FAQs from the product, category or best-for editor. Published products must keep at least one FAQ.</p>
      <div className="filters">
        {[["", "All"], ["product", "Products"], ["category", "Categories"], ["useCase", "Best-for"]].map(([k, l]) => (
          <Link key={k} className="btn secondary" href={k ? `/admin/faqs?owner=${k}` : "/admin/faqs"} aria-current={(filter ?? "") === k ? "page" : undefined}>{l}</Link>
        ))}
      </div>
      {faqs.map((f) => {
        const o = owner(f);
        return (
          <div className="panel section-gap" key={f.id}>
            <p className="small"><Pill>{o.kind}</Pill> <Link href={o.href}>{o.name}</Link></p>
            <form action={A.updateFaqAction} className="form-grid">
              <Hidden name="faqId" value={f.id} /><Hidden name="back" value="/admin/faqs" />
              <Field label="Question" name="question" defaultValue={f.question} full required maxLength={300} />
              <Area label="Answer" name="answer" defaultValue={f.answer} required rows={2} maxLength={3000} />
              <Field label="Order" name="sortOrder" type="number" defaultValue={f.sortOrder} />
              <button className="btn secondary" type="submit">Save FAQ</button>
            </form>
            <DangerForm action={A.deleteFaqAction}><Hidden name="faqId" value={f.id} /><Hidden name="back" value="/admin/faqs" /></DangerForm>
          </div>
        );
      })}
    </AdminPage>
  );
}
