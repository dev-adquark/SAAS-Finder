import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseAlternative } from "@/lib/admin/inputs";
import { addAlternative } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.alternative.findMany({ where: { productId: id }, include: { alternative: { select: { slug: true, name: true } } }, orderBy: { sortOrder: "asc" } }));
export const POST = adminRoute<P>(async (req, { id }) => addAlternative(id, parseAlternative(await readJson(req), true)));
