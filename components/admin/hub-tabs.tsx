"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, type NavItem } from "@/components/admin/nav";

/** In-page sub-navigation for hub areas (Publishing, Partners). Scrolls horizontally on phones. */
export function HubTabs({ tabs, label }: { tabs: NavItem[]; label: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="hub-tabs" aria-label={label}>
      {tabs.map((t) => {
        const active = isActive(pathname, t.href);
        return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
