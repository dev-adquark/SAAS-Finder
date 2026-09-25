import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin/guard";
import { login } from "@/app/admin/actions";
import { AdminPage, Flash } from "@/components/admin/ui";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <AdminPage title="Admin sign in">
      <Flash error={error} />
      <form action={login} className="panel form-grid" style={{ maxWidth: 480 }}>
        <label className="field full">Admin key<input name="password" type="password" autoComplete="current-password" required maxLength={500} /></label>
        <button className="btn primary" type="submit">Sign in</button>
      </form>
    </AdminPage>
  );
}
