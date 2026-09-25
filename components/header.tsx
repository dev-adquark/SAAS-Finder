import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import { BrandMark } from "@/components/icons";
import { CommandPalette, SearchTrigger } from "@/components/command-palette";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLinks } from "@/components/nav-links";

const NAV = [
  { href: routes.products(), label: "Products" },
  { href: routes.categories(), label: "Categories" },
  { href: routes.alternativesIndex(), label: "Alternatives" },
  { href: routes.comparisons(), label: "Compare" },
  { href: routes.bestIndex(), label: "Best For" },
];

export function Header() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link className="brand" href={routes.home()} aria-label="SaaSFinder home">
          <BrandMark />
          <span>SaaS<b>Finder</b></span>
        </Link>
        <NavLinks items={NAV} />
        <div className="nav-right">
          <SearchTrigger />
          <MobileMenu items={[...NAV, { href: routes.methodology(), label: "Methodology" }, { href: routes.disclosure(), label: "Disclosure" }]} />
        </div>
      </div>
      <CommandPalette />
    </header>
  );
}
