import Link from "next/link";
import { routes } from "@/lib/seo/routes";

export function Header() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link className="brand" href={routes.home()}>SaaS<span>Finder</span></Link>
        <nav className="navlinks" aria-label="Main">
          <Link href={routes.categories()}>Categories</Link>
          <Link href={routes.bestIndex()}>Best-for guides</Link>
          <Link href={routes.comparisons()}>Comparisons</Link>
          <Link href={routes.alternativesIndex()}>Alternatives</Link>
          <Link href={routes.methodology()}>Methodology</Link>
        </nav>
        <Link className="btn primary nav-cta" href={routes.products()}>All reviews</Link>
      </div>
    </header>
  );
}
