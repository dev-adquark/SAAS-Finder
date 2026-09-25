import { adminRoute, readJson } from "@/lib/admin/api";
import { parsePair } from "@/lib/admin/inputs";
import { deletePair, updatePair } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) => updatePair(id, parsePair(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deletePair(id));
