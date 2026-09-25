import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseProduct } from "@/lib/admin/inputs";
import { deleteProduct, NotFoundError, updateProduct } from "@/lib/admin/services";

type P = { id: string };

export const GET = adminRoute<P>(async (_req, { id }) => {
  const product = await db.product.findUnique({
    where: { id },
    include: { category: true, review: true, tags: { include: { tag: true } }, faqs: { orderBy: { sortOrder: "asc" } }, snapshots: { orderBy: { capturedAt: "desc" } }, links: true, alternativesFrom: { include: { alternative: { select: { slug: true, name: true } } } }, changelog: { orderBy: { changedAt: "desc" } }, refreshes: { orderBy: { dueAt: "desc" } }, useCases: { include: { useCase: { select: { slug: true, title: true } } } } },
  });
  if (!product) throw new NotFoundError("Product not found");
  return product;
});

export const PATCH = adminRoute<P>(async (req, { id }) => updateProduct(id, parseProduct(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteProduct(id));
