import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseProduct } from "@/lib/admin/inputs";
import { createProduct } from "@/lib/admin/services";

export const GET = adminRoute(async () =>
  db.product.findMany({ include: { category: true, review: true, tags: { include: { tag: true } }, _count: { select: { faqs: true, alternativesFrom: true, snapshots: true } } }, orderBy: { updatedAt: "desc" } }),
);

export const POST = adminRoute(async (req) => createProduct(parseProduct(await readJson(req), true)));
