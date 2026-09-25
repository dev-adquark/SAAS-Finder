import { adminRoute, readJson } from "@/lib/admin/api";
import { parseAlternative } from "@/lib/admin/inputs";
import { deleteAlternative, updateAlternative } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) => updateAlternative(id, parseAlternative(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteAlternative(id));
