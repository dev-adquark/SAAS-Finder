import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseRefresh } from "@/lib/admin/inputs";
import { addRefresh } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.contentRefresh.findMany({ where: { productId: id }, orderBy: { dueAt: "asc" } }));
export const POST = adminRoute<P>(async (req, { id }) => addRefresh(id, parseRefresh(await readJson(req))));
