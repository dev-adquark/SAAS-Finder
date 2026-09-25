import { revalidatePath } from "next/cache";
import { adminRoute, readJson } from "@/lib/admin/api";
import { InputError } from "@/lib/admin/inputs";
import { normalizePath } from "@/lib/seo/routes";

const MAX_PATHS = 50;

// Body: { "paths": ["/wix", "/category/crm"] } or { "all": true }.
export const POST = adminRoute(async (req) => {
  const body = (await readJson(req)) as { paths?: unknown; all?: unknown };
  if (body.all === true) {
    revalidatePath("/", "layout");
    return { ok: true, paths: ["/ (layout)"] };
  }
  const requested: unknown[] = Array.isArray(body.paths) ? body.paths : [];
  const paths = [...new Set(
    requested
      .filter((p): p is string => typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && p.length <= 300 && !/[\s\\]/.test(p))
      .map((p) => normalizePath(p)),
  )].slice(0, MAX_PATHS);
  if (!paths.length) throw new InputError(["No valid paths supplied"]);
  for (const p of paths) revalidatePath(p);
  revalidatePath("/sitemap.xml");
  return { ok: true, paths };
});
