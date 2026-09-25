import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/site";
import { BrandMark } from "@/components/icons";

const CATEGORIES = [
  ["website-builders", "Website Builders"],
  ["design", "Design"],
  ["crm", "CRM"],
  ["marketing", "Marketing"],
  ["project-management", "Project Management"],
] as const;

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="closing">Better software decisions start with <em>better information.</em></p>
        <div className="footer-grid">
          <div>
            <Link className="brand" href={routes.home()}><BrandMark /><span>SaaS <b>Finder</b></span></Link>
            <p style={{ marginTop: 14, maxWidth: 340 }}>
              An independent atlas of SaaS: structured reviews, curated alternatives and side-by-side comparisons, researched from official sources. Some outbound links may be affiliate links; sponsored placements are always labelled &ldquo;Sponsored&rdquo;. Neither affects editorial selection.
            </p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              <li><Link href={routes.products()}>All reviews</Link></li>
              <li><Link href={routes.categories()}>Categories</Link></li>
              {CATEGORIES.map(([slug, name]) => <li key={slug}><Link href={routes.category(slug)}>{name}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Research">
            <h2>Research</h2>
            <ul>
              <li><Link href={routes.comparisons()}>Comparisons</Link></li>
              <li><Link href={routes.alternativesIndex()}>Alternatives</Link></li>
              <li><Link href={routes.bestIndex()}>Best-for guides</Link></li>
            </ul>
          </nav>
          <nav aria-label="Trust">
            <h2>Trust</h2>
            <ul>
              <li><Link href={routes.methodology()}>Methodology</Link></li>
              <li><Link href={routes.disclosure()}>Disclosure</Link></li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <h2>Company</h2>
            <ul>
              <li><Link href={routes.contact()}>Contact</Link></li>
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h2>Legal</h2>
            <ul>
              <li><Link href={routes.privacy()}>Privacy</Link></li>
              <li><Link href={routes.disclosure()}>Affiliate &amp; sponsorship</Link></li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getUTCFullYear()} {SITE_NAME}. Verify current pricing and terms with each vendor before buying.</span>
          <span>Press <kbd>⌘K</kbd> to search the atlas</span>
        </div>
      </div>
    </footer>
  );
}
