import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { routes } from "@/lib/seo/routes";
import { SITE_NAME } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Terms of use",
  description: "The terms for using FindMy.tech: what the site is, acceptable use, third-party links, no warranty on vendor information, and liability.",
  path: routes.terms(),
});

export default function Terms() {
  return (
    <section className="section">
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Terms", path: routes.terms() }]} />
        <span className="eyebrow">Legal</span>
        <h1>Terms of use</h1>
        <div className="panel">
          <h2>What this site is</h2>
          <p>{SITE_NAME} publishes independent research, reviews, comparisons and buying guides about software products. By using this site, you agree to these terms. If you do not agree, please do not use the site.</p>
          <h2>Not advice, not a guarantee</h2>
          <p>Content on {SITE_NAME} is for general informational purposes only and is not professional, legal, financial or purchasing advice. Prices, features and plans are set by each vendor and can change at any time; we verify them against the vendor&apos;s own published pages and show the date of that check, but you should confirm current pricing and terms directly with the vendor before buying. See our <Link href={routes.methodology()}>methodology</Link> for how we verify facts.</p>
          <h2>Third-party links</h2>
          <p>Outbound links take you to third-party websites we do not control and are not responsible for. Some outbound links are affiliate links, and some pages carry labelled sponsored placements; see our <Link href={routes.disclosure()}>disclosure</Link> for how those work and how they are marked. Visiting a vendor&apos;s site is governed by that vendor&apos;s own terms and privacy policy, not ours.</p>
          <h2>Acceptable use</h2>
          <p>You may browse and share links to this site. You may not scrape, copy or republish substantial parts of the site&apos;s content, attempt to disrupt or gain unauthorized access to it, or use it in a way that violates applicable law.</p>
          <h2>Intellectual property</h2>
          <p>Our own text, structure and design are owned by {SITE_NAME} or its licensors. Product names, logos and trademarks shown to identify the software we review belong to their respective owners; see our <Link href={routes.disclosure()}>disclosure</Link> for how we use them.</p>
          <h2>No warranty</h2>
          <p>The site is provided &ldquo;as is&rdquo;, without warranties of any kind, express or implied, including accuracy, completeness or fitness for a particular purpose. We make reasonable efforts to keep information current but cannot guarantee it is error-free or up to date at the moment you read it.</p>
          <h2>Limitation of liability</h2>
          <p>To the fullest extent permitted by law, {SITE_NAME} is not liable for any loss or damage arising from your use of this site or a decision made based on its content, including a purchase made through an outbound link.</p>
          <h2>Changes</h2>
          <p>We may update these terms as the site changes. The version in effect is the one published on this page.</p>
          <h2>Contact</h2>
          <p>Questions about these terms can be sent through our <Link href={routes.contact()}>contact page</Link>.</p>
        </div>
      </div>
    </section>
  );
}
