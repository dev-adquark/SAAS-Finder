import { adminKey, safeEqual } from "@/lib/admin/session";

/** Bearer-token check for programmatic admin API access. Rejects when the key is unset or too short. */
export function requireAdmin(req: Request) {
  const expected = adminKey();
  const header = req.headers.get("authorization") ?? "";
  return Boolean(expected && header.startsWith("Bearer ") && safeEqual(header.slice(7), expected));
}
