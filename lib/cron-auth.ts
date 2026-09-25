import { safeEqual } from "@/lib/admin/session";

export function requireCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const header = req.headers.get("x-cron-secret");
  return (auth !== null && safeEqual(auth, `Bearer ${secret}`)) || (header !== null && safeEqual(header, secret));
}
