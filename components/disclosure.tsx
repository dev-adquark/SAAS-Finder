import Link from "next/link";
import { routes } from "@/lib/seo/routes";
import { IconShield } from "@/components/icons";

/** Visible disclosure shown on every page that contains outbound vendor CTAs. */
export function AffiliateDisclosure() {
  return (
    <aside className="disclosure" data-disclosure="affiliate" aria-label="Affiliate disclosure">
      <IconShield size={20} />
      <span>
        <strong>Disclosure:</strong> Some outbound links on this page may be affiliate links. If you buy through one, SaaSFinder may earn a commission at no extra cost to you. Commissions and sponsorships never decide which products we include or how we rank them.{" "}
        <Link href={routes.disclosure()}>Read our disclosure</Link> and <Link href={routes.methodology()}>methodology</Link>.
      </span>
    </aside>
  );
}
