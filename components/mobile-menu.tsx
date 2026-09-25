"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu, IconX } from "@/components/icons";

type NavItem = { href: string; label: string };

export function MobileMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on; navigating elsewhere closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => setOpenOn((typeof next === "function" ? next(open) : next) ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button type="button" className="btn ghost menu-toggle" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <IconX /> : <IconMenu />}
      </button>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          {items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={pathname === i.href ? "page" : undefined}>
              {i.label} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
