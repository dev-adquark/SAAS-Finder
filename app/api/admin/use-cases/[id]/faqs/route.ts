import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseFaq } from "@/lib/admin/inputs";
import { addFaq } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.faq.findMany({ where: { useCaseId: id }, orderBy: { sortOrder: "asc" } }));
export const POST = adminRoute<P>(async (req, { id }) => addFaq({ useCaseId: id }, parseFaq(await readJson(req))));
