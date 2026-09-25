import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseCategory } from "@/lib/admin/inputs";
import { createCategory } from "@/lib/admin/services";

export const GET = adminRoute(async () => db.category.findMany({ include: { _count: { select: { products: true, useCases: true, faqs: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
export const POST = adminRoute(async (req) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  // Slug defaults to the slugified name.
  return createCategory(parseCategory({ ...body, slug: body?.slug ?? body?.name }, true));
});
