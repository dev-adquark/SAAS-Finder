import { adminRoute, readJson } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { parsePair } from "@/lib/admin/inputs";
import { createPair } from "@/lib/admin/services";

export const GET = adminRoute(async () => db.competitorPair.findMany({ include: { productA: { select: { slug: true, name: true } }, productB: { select: { slug: true, name: true } } }, orderBy: { slug: "asc" } }));
export const POST = adminRoute(async (req) => createPair(parsePair(await readJson(req), true)));
