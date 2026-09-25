import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { buildSearchIndex } from "@/lib/search-index";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(buildSearchIndex(await loadCatalog()), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
