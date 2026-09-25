import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMetadata } from "@/lib/seo/metadata";
import { routes } from "@/lib/seo/routes";

// The monitored address is a business input supplied via environment, never hard-coded.
const email = process.env.CONTACT_EMAIL?.trim();
const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

export const metadata = buildMetadata({
  title: "Contact",
  description: "Contact SaaSFinder about corrections, pricing updates, affiliate partnerships or sponsored placements.",
  path: routes.contact(),
  noindex: !validEmail,
});

export default function Contact() {
  return (
    <section className="section">
      <div className="container prose">
        <Breadcrumbs items={[{ name: "Contact", path: routes.contact() }]} />
        <span className="eyebrow">Contact</span>
        <h1>Contact SaaSFinder</h1>
        <div className="panel">
          <p>We welcome corrections, pricing updates from vendors, and affiliate or sponsorship enquiries. Sponsorship enquiries are handled separately from editorial work and cannot change reviews, scores or rankings.</p>
          {validEmail ? (
            <p>Email: <a href={`mailto:${validEmail}`}>{validEmail}</a></p>
          ) : (
            <p className="muted">Our contact inbox is not available yet. Please check back soon.</p>
          )}
        </div>
      </div>
    </section>
  );
}
