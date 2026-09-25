import { adminRoute, readJson } from "@/lib/admin/api";
import { parseLink } from "@/lib/admin/inputs";
import { deleteLink, updateLink } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) => updateLink(id, parseLink(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteLink(id));
