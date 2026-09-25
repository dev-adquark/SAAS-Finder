"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop nav with an active-page indicator. */
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="navlinks" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={pathname === i.href || pathname.startsWith(i.href + "/") ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
