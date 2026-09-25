import type { Metadata } from "next";
import Link from "next/link";
import { isAdminSession } from "@/lib/admin/guard";
import { logout } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/quality", "Data Quality"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/alternatives", "Alternatives"],
  ["/admin/comparisons", "Comparisons"],
  ["/admin/use-cases", "Best For"],
  ["/admin/pricing", "Pricing"],
  ["/admin/affiliates", "Affiliate Links"],
  ["/admin/sponsors", "Sponsors"],
  ["/admin/relationships", "Partners"],
  ["/admin/faqs", "FAQs"],
  ["/admin/refreshes", "Refresh Queue"],
  ["/admin/analytics", "Analytics"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminSession();
  return (
    <div className="admin">
      {authed && (
        <div className="container">
          <nav className="admin-nav" aria-label="Admin">
            {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            <form action={logout} className="inline-form"><button className="btn secondary" type="submit">Sign out</button></form>
          </nav>
        </div>
      )}
      {!process.env.DATABASE_URL && authed && <div className="container"><div className="flash err">DATABASE_URL is not configured — admin changes cannot be saved.</div></div>}
      {children}
    </div>
  );
}
