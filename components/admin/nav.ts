// Admin information architecture. Every existing admin route stays at its URL; the sidebar groups
// them, and Publishing / Partners are hubs over the pages they contain.
export type NavItem = { href: string; label: string; match?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard" }, { href: "/admin/quality", label: "Data quality" }, { href: "/admin/sync", label: "Data sync" }, { href: "/admin/analytics", label: "Analytics" }] },
  { label: "Catalog", items: [{ href: "/admin/products", label: "Products" }, { href: "/admin/categories", label: "Categories" }, { href: "/admin/faqs", label: "FAQs" }] },
  { label: "Publishing", items: [{ href: "/admin/publishing", label: "Overview" }, { href: "/admin/alternatives", label: "Alternatives" }, { href: "/admin/comparisons", label: "Comparisons" }, { href: "/admin/use-cases", label: "Best for" }] },
  { label: "Partners", items: [{ href: "/admin/partners", label: "All relationships" }, { href: "/admin/affiliates", label: "Affiliate links" }, { href: "/admin/sponsors", label: "Sponsors" }, { href: "/admin/relationships", label: "Partner records" }] },
  { label: "Pricing", items: [{ href: "/admin/pricing", label: "Pricing review" }, { href: "/admin/refreshes", label: "Refresh queue" }] },
];

export const PUBLISHING_TABS: NavItem[] = [{ href: "/admin/publishing", label: "Overview" }, { href: "/admin/alternatives", label: "Alternatives" }, { href: "/admin/comparisons", label: "Comparisons" }, { href: "/admin/use-cases", label: "Best for" }];
export const PARTNER_TABS: NavItem[] = [{ href: "/admin/partners", label: "All relationships" }, { href: "/admin/affiliates", label: "Affiliate links" }, { href: "/admin/sponsors", label: "Sponsors" }, { href: "/admin/relationships", label: "Partner records" }];

/** Exact match for hub roots and /admin; prefix match for sections with sub-pages (e.g. /admin/products/abc). */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/admin/publishing" || href === "/admin/partners") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
