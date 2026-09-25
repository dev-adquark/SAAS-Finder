import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

const MAX_PATHS = 50;
const MAX_PATH_LENGTH = 500;

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.paths) ? body.paths : ["/"];
    const paths = requested
      .filter((path: unknown): path is string => typeof path === "string" && path.startsWith("/") && path.length <= MAX_PATH_LENGTH)
      .map((path) => path.split("?")[0].split("#")[0])
      .filter((path) => path === "/" || !path.includes("//"))
      .slice(0, MAX_PATHS);
    if (!paths.length) return NextResponse.json({ error: "No valid paths supplied" }, { status: 400 });
    for (const path of paths) revalidatePath(path);
    revalidatePath("/sitemap.xml");
    revalidatePath("/robots.txt");
    return NextResponse.json({ ok: true, paths });
  } catch {
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
