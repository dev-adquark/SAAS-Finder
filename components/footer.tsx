import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <strong>{SITE_NAME}</strong>
        <p>
          Independent SaaS research. Some outbound links may be affiliate links; sponsored placements are always labelled
          &ldquo;Sponsored&rdquo;. Neither affects editorial selection. Verify current pricing and terms with each vendor before buying.
        </p>
        <nav className="footerlinks" aria-label="Footer">
          <Link href={routes.products()}>All reviews</Link>
          <Link href={routes.categories()}>Categories</Link>
          <Link href={routes.bestIndex()}>Best-for guides</Link>
          <Link href={routes.comparisons()}>Comparisons</Link>
          <Link href={routes.alternativesIndex()}>Alternatives</Link>
          <Link href={routes.methodology()}>Methodology</Link>
          <Link href={routes.disclosure()}>Disclosure</Link>
          <Link href={routes.privacy()}>Privacy</Link>
          <Link href={routes.contact()}>Contact</Link>
        </nav>
        <p>© {new Date().getUTCFullYear()} {SITE_NAME}.</p>
      </div>
    </footer>
  );
}
