import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminKey, SESSION_COOKIE, verifySessionToken } from "@/lib/admin/session";

export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, adminKey());
}

/** Call at the top of every admin page. */
export async function requireAdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");
}

/** Call at the top of every admin server action. */
export async function assertAdmin() {
  if (!(await isAdminSession())) throw new Error("Unauthorized");
}
