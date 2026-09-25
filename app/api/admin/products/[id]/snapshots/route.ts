import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseSnapshot } from "@/lib/admin/inputs";
import { addSnapshot } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => db.pricingSnapshot.findMany({ where: { productId: id }, orderBy: { capturedAt: "desc" } }));
// Body may include "verify": true to record an editor-verified check in one step.
export const POST = adminRoute<P>(async (req, { id }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  return addSnapshot(id, parseSnapshot(body), { verify: body?.verify === true, by: "api" });
});
