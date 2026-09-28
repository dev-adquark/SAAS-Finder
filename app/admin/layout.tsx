import type { Metadata } from "next";
import { isAdminSession } from "@/lib/admin/guard";
import { logout } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminSession();
  return (
    <div className={`admin${authed ? " admin-shell" : ""}`}>
      {authed && <AdminSidebar signOut={<form action={logout}><button className="btn secondary" type="submit">Sign out</button></form>} />}
      <div className="admin-main">
        {!process.env.DATABASE_URL && authed && <div className="container"><div className="flash err">DATABASE_URL is not configured — admin changes cannot be saved.</div></div>}
        {children}
      </div>
    </div>
  );
}
