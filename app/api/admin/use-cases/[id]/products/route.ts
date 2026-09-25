import { adminRoute, readJson } from "@/lib/admin/api";
import { parseUseCaseProduct } from "@/lib/admin/inputs";
import { addUseCaseProduct } from "@/lib/admin/services";

type P = { id: string };
export const POST = adminRoute<P>(async (req, { id }) => addUseCaseProduct(id, parseUseCaseProduct(await readJson(req), true)));
