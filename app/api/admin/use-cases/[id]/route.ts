import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseUseCase } from "@/lib/admin/inputs";
import { deleteUseCase, NotFoundError, updateUseCase } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => {
  const u = await db.useCase.findUnique({ where: { id }, include: { products: { include: { product: { select: { slug: true, name: true } } }, orderBy: { position: "asc" } }, faqs: { orderBy: { sortOrder: "asc" } } } });
  if (!u) throw new NotFoundError("Use case not found");
  return u;
});
export const PATCH = adminRoute<P>(async (req, { id }) => updateUseCase(id, parseUseCase(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteUseCase(id));
