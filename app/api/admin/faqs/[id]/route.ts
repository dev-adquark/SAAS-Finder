import { adminRoute, readJson } from "@/lib/admin/api";
import { read } from "@/lib/admin/inputs";
import { deleteFaq, updateFaq } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) =>
  updateFaq(id, read(await readJson(req)).str("question", { max: 300 }).str("answer", { max: 3000 }).int("sortOrder", { min: 0, max: 1000 }).done()),
);
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteFaq(id));
