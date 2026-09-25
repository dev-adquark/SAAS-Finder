import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseChangelog } from "@/lib/admin/inputs";
import { addChangelog } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.changeLog.findMany({ where: { productId: id }, orderBy: { changedAt: "desc" } }));
export const POST = adminRoute<P>(async (req, { id }) => addChangelog(id, parseChangelog(await readJson(req))));
