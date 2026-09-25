import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/site";
import { BrandMark } from "@/components/icons";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href={routes.home()}><BrandMark /><span>SaaS<b>Finder</b></span></Link>
            <p style={{ marginTop: 14, maxWidth: 380 }}>
              Independent SaaS research: structured reviews, curated alternatives and side-by-side comparisons. Some outbound links may be affiliate links; sponsored placements are always labelled &ldquo;Sponsored&rdquo;. Neither affects editorial selection.
            </p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              <li><Link href={routes.products()}>All reviews</Link></li>
              <li><Link href={routes.categories()}>Categories</Link></li>
              <li><Link href={routes.bestIndex()}>Best-for guides</Link></li>
            </ul>
          </nav>
          <nav aria-label="Decide">
            <h2>Decide</h2>
            <ul>
              <li><Link href={routes.comparisons()}>Comparisons</Link></li>
              <li><Link href={routes.alternativesIndex()}>Alternatives</Link></li>
              <li><Link href={routes.methodology()}>How we review</Link></li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <h2>Trust</h2>
            <ul>
              <li><Link href={routes.disclosure()}>Disclosure</Link></li>
              <li><Link href={routes.privacy()}>Privacy</Link></li>
              <li><Link href={routes.contact()}>Contact</Link></li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getUTCFullYear()} {SITE_NAME}. Verify current pricing and terms with each vendor before buying.</span>
          <span>Press <kbd>⌘K</kbd> to search</span>
        </div>
      </div>
    </footer>
  );
}
