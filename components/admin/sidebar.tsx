"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_NAV, isActive } from "@/components/admin/nav";

/** Sticky grouped sidebar on desktop; an off-canvas drawer with a toggle on small screens. */
export function AdminSidebar({ signOut }: { signOut: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  // The drawer remembers the path it was opened on, so any navigation closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current = ADMIN_NAV.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  return (
    <>
      <div className="admin-topbar">
        <button type="button" className="admin-menu-btn" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true" className="burger" /> Menu
        </button>
        <span className="admin-current">{current?.label ?? "Admin"}</span>
      </div>
      {open && <button type="button" className="admin-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside id="admin-sidebar" className={`admin-sidebar${open ? " open" : ""}`} aria-label="Admin">
        <Link href="/admin" className="admin-brand">SaaS Finder <span>Admin</span></Link>
        <nav>
          {ADMIN_NAV.map((g) => (
            <div className="admin-group" key={g.label}>
              <p className="admin-group-label">{g.label}</p>
              <ul>
                {g.items.map((i) => {
                  const active = isActive(pathname, i.href);
                  return <li key={i.href}><Link href={i.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>{i.label}</Link></li>;
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link href="/" className="small">View site ↗</Link>
          {signOut}
        </div>
      </aside>
    </>
  );
}
