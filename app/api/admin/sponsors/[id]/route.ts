import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseSponsor } from "@/lib/admin/inputs";
import { deleteSponsor, NotFoundError, updateSponsor } from "@/lib/admin/services";

type P = { id: string };
export const GET = adminRoute<P>(async (_req, { id }) => {
  const s = await db.sponsorSlot.findUnique({ where: { id } });
  if (!s) throw new NotFoundError("Sponsor not found");
  return s;
});
export const PATCH = adminRoute<P>(async (req, { id }) => updateSponsor(id, parseSponsor(await readJson(req), false)));
export const DELETE = adminRoute<P>(async (_req, { id }) => deleteSponsor(id));
