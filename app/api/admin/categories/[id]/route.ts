import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseCategory } from "@/lib/admin/inputs";
import { deleteCategory, NotFoundError, updateCategory } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => {
  const c = await db.category.findUnique({ where: { id }, include: { faqs: { orderBy: { sortOrder: "asc" } } } });
  if (!c) throw new NotFoundError("Category not found");
  return c;
});
export const PATCH = adminRoute<P>(async (req, { id }) => updateCategory(id, parseCategory(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteCategory(id));
