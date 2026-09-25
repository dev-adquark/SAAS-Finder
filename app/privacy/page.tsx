import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { routes } from "@/lib/seo/routes";

export const metadata = buildMetadata({
  title: "Privacy",
  description: "What SaaSFinder measures when you use the site, what it never collects, and how outbound and sponsored link clicks are counted.",
  path: routes.privacy(),
});

export default function Privacy() {
  return (
    <section className="section">
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Privacy", path: routes.privacy() }]} />
        <span className="eyebrow">Privacy</span>
        <h1>Privacy overview</h1>
        <div className="panel">
          <h2>What we measure</h2>
          <p>We record a small set of anonymous, first-party events: page views, clicks on vendor buttons, clicks on outbound vendor links and clicks on sponsored placements. Each event stores the page path, the product and placement involved, the type of page and button, and a timestamp.</p>
          <h2>What we do not collect</h2>
          <p>Our analytics do not set advertising cookies and do not store IP addresses, names, email addresses, device fingerprints or other personal identifiers. Payloads are size-limited, and fields that look like personal data are discarded.</p>
          <h2>Outbound links</h2>
          <p>When you click a vendor or sponsor link, you pass through a SaaSFinder redirect that records the click and then sends you to the vendor. Once on the vendor&apos;s site, that vendor&apos;s own privacy policy applies. Affiliate partners may use their own tracking to attribute a purchase.</p>
          <h2>Forms</h2>
          <p>Please do not send sensitive personal information to us. If we add lead or contact forms, this page will be updated first to describe what is collected and why.</p>
        </div>
      </div>
    </section>
  );
}
