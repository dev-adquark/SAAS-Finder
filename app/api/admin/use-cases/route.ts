import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseUseCase } from "@/lib/admin/inputs";
import { createUseCase } from "@/lib/admin/services";

export const GET = adminRoute(async () => db.useCase.findMany({ include: { category: { select: { slug: true, name: true } }, _count: { select: { products: true, faqs: true } } }, orderBy: { slug: "asc" } }));
export const POST = adminRoute(async (req) => createUseCase(parseUseCase(await readJson(req), true)));
