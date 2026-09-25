import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseLink } from "@/lib/admin/inputs";
import { addLink } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.affiliateLink.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" } }));
export const POST = adminRoute<P>(async (req, { id }) => addLink(id, parseLink(await readJson(req), true)));
