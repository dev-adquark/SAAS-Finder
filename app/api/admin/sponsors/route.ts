import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parseSponsor } from "@/lib/admin/inputs";
import { createSponsor } from "@/lib/admin/services";

export const GET = adminRoute(async () => db.sponsorSlot.findMany({ orderBy: [{ pageType: "asc" }, { priority: "desc" }] }));
export const POST = adminRoute(async (req) => createSponsor(parseSponsor(await readJson(req), true)));
