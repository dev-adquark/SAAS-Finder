import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { routes } from "@/lib/seo/routes";

export const metadata = buildMetadata({
  title: "Affiliate and sponsorship disclosure",
  description: "How SaaSFinder earns money through affiliate links and labelled sponsored placements, and why neither affects editorial selection or rankings.",
  path: routes.disclosure(),
});

export default function Disclosure() {
  return (
    <section className="section">
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Disclosure", path: routes.disclosure() }]} />
        <span className="eyebrow">Transparency</span>
        <h1>Affiliate &amp; sponsorship disclosure</h1>
        <div className="panel">
          <h2>Affiliate links</h2>
          <p>SaaSFinder may earn a commission when you buy through some outbound links. These links are labelled &ldquo;Affiliate link&rdquo; next to the button, use <code>rel=&quot;sponsored nofollow&quot;</code>, and pass through our <code>/go/</code> redirect so we can count clicks. You never pay more because of an affiliate link. Links labelled &ldquo;Official vendor site&rdquo; are not affiliate links.</p>
          <h2>Sponsored placements</h2>
          <p>Some pages may show a paid placement. Every placement is labelled &ldquo;Sponsored&rdquo;, appears in a clearly separated box, and is tracked separately from editorial links.</p>
          <h2>Reviewed is not partnered</h2>
          <p>Products appear on SaaSFinder because we reviewed and researched them. Being reviewed does not mean a vendor collaborates with, endorses, sponsors or has approved SaaSFinder. We only use words like &ldquo;Partner&rdquo;, &ldquo;Sponsored&rdquo; or &ldquo;Affiliate&rdquo; where a documented agreement exists, and those labels disappear automatically when the agreement ends. At the time of writing, outbound links go to official vendor sites unless a link is explicitly labelled &ldquo;Affiliate link&rdquo;.</p>
          <h2>Editorial independence</h2>
          <p>Commissions and sponsorships never determine which products we include, how we score them, the order of lists, or which alternatives and comparisons we publish. How we make those decisions is described in our <Link href={routes.methodology()}>methodology</Link>.</p>
          <h2>Pricing</h2>
          <p>Vendor pricing and features change. Pricing is shown only after editorial verification and always carries a &ldquo;Last checked&rdquo; date. Confirm current plans, taxes, limits and cancellation terms on the vendor&apos;s site before you buy.</p>
        </div>
      </div>
    </section>
  );
}
