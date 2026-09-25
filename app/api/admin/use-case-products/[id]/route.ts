import { adminRoute, readJson } from "@/lib/admin/api";
import { parseUseCaseProduct } from "@/lib/admin/inputs";
import { deleteUseCaseProduct, updateUseCaseProduct } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) => updateUseCaseProduct(id, parseUseCaseProduct(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteUseCaseProduct(id));
