import Link from "next/link";
import type { FactRef, Product, SourceKind, SourceRef } from "@/lib/content/types";
import { formatDate, freshness } from "@/lib/freshness-rules";
import { formatPrice, pricingState } from "@/lib/pricing";
import { routes } from "@/lib/seo/routes";
import { IconArrow, IconCheck, IconClock, IconInfo, IconShield } from "@/components/icons";

export const FACT_LABELS: Record<string, string> = {
  company: "Company",
  founded: "Founded",
  headquarters: "Headquarters",
  officialDescription: "Official description",
  audience: "Target audience",
  useCases: "Primary use cases",
  integrations: "Integrations",
  platforms: "Platforms",
  mobileApps: "Mobile apps",
  browser: "Browser access",
  security: "Security",
  support: "Support options",
  freePlan: "Free plan",
  freeTrial: "Free trial",
  billingOptions: "Billing options",
  usageLimits: "Usage limits",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  PRICING: "Official pricing",
  PRODUCT: "Official product page",
  DOCUMENTATION: "Official documentation",
  HELP_CENTER: "Help center",
  SECURITY: "Security",
  CHANGELOG: "Changelog",
  NEWSROOM: "Newsroom",
  ABOUT: "About the company",
  CONTACT: "Contact / sales",
  INTEGRATIONS: "Integrations",
  STATUS: "Status page",
  INDEPENDENT: "Independent source",
  PRIVACY: "Privacy policy",
  TERMS: "Terms of service",
};

const RESOURCE_ORDER: SourceKind[] = ["PRODUCT", "PRICING", "DOCUMENTATION", "HELP_CENTER", "SECURITY", "CHANGELOG", "NEWSROOM", "INTEGRATIONS", "STATUS", "CONTACT", "ABOUT", "PRIVACY", "TERMS"];

export const verifiedFacts = (p: Pick<Product, "facts">) => p.facts.filter((f) => f.status === "VERIFIED");
export const fact = (p: Pick<Product, "facts">, key: string): FactRef | undefined => verifiedFacts(p).find((f) => f.key === key);
export const verifiedSources = (p: Pick<Product, "sources">) => p.sources.filter((s) => s.status === "VERIFIED");

function ExtLink({ href, children, className = "text-link" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="nofollow noopener noreferrer">
      {children} <IconArrow size={12} aria-hidden="true" /><span className="sr-only"> (opens official site in a new tab)</span>
    </a>
  );
}

/** Evidence-backed trust badges; each appears only when the underlying data supports it. */
export function TrustBadges({ product }: { product: Product }) {
  const ps = pricingState(product);
  const sources = verifiedSources(product);
  const recent = freshness(new Date(product.contentUpdatedAt), 30).state !== "overdue";
  return (
    <div className="chip-row" aria-label="Verification badges">
      <span className={`status ${ps.tone}`}>{ps.label}</span>
      {sources.length > 0 && <span className="status ok">Official sources · {sources.length}</span>}
      {recent && <span className="status info">Recently updated</span>}
      {product.affiliate && <Link className="status pending" href={routes.disclosure()}>Affiliate link</Link>}
    </div>
  );
}

/** "Sources & Verification": every source linked directly, with its check date. */
export function SourcesPanel({ product }: { product: Product }) {
  const sources = verifiedSources(product);
  const checked = formatDate(product.sourceCheckedAt);
  return (
    <section className="panel section-gap sources-panel reveal" id="sources" aria-labelledby="sources-title">
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2 id="sources-title" style={{ margin: 0, display: "flex", gap: 10, alignItems: "center" }}><IconShield /> Sources &amp; verification</h2>
        <span className={`status ${sources.length ? "ok" : "pending"}`}>{sources.length ? `${sources.length} official sources verified` : "Sources not yet verified"}</span>
      </div>
      {sources.length ? (
        <ul className="source-list">
          {sources.map((s) => (
            <li key={s.url}>
              <span className="src-kind">Verified source<br /><span className="muted">{SOURCE_LABEL[s.kind]}</span></span>
              <span><ExtLink href={s.url}>{s.name}</ExtLink><br /><span className="tiny muted">Official vendor source · {new URL(s.url).host.replace(/^www\./, "")}</span></span>
              <span className="tiny muted"><IconCheck size={12} /> Checked {formatDate(s.checkedAt) ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">We haven&apos;t yet verified official sources for this profile. Facts below are shown as &ldquo;Not verified&rdquo; until we do.</p>
      )}
      <p className="tiny muted" style={{ marginTop: 12 }}>
        <IconInfo size={12} /> A fact or price is marked verified only when an exact quote from the vendor&apos;s official page supports it on the check date{checked ? ` (last source check: ${checked})` : ""}. See our <Link href={routes.methodology()}>methodology</Link>.
      </p>
    </section>
  );
}

/** Official resource links grouped by type — only links that exist are shown. */
export function ResourceCenter({ product }: { product: Product }) {
  const byKind = new Map<SourceKind, SourceRef>();
  for (const s of verifiedSources(product)) if (!byKind.has(s.kind)) byKind.set(s.kind, s);
  const items: { label: string; href: string }[] = [{ label: "Official website", href: product.officialUrl }];
  if (product.pricingUrl) items.push({ label: "Pricing", href: product.pricingUrl });
  for (const k of RESOURCE_ORDER) {
    const s = byKind.get(k);
    if (s && !items.some((i) => i.href === s.url)) items.push({ label: SOURCE_LABEL[k], href: s.url });
  }
  return (
    <section className="section-gap reveal" id="resources" aria-labelledby="resources-title">
      <h2 id="resources-title">Official {product.name} resources</h2>
      <div className="resource-grid">
        {items.map((i) => (
          <a key={i.href} className="resource" href={i.href} target="_blank" rel="nofollow noopener noreferrer">
            <span>{i.label}</span>
            <span className="tiny muted">{new URL(i.href).host.replace(/^www\./, "")}</span>
            <IconArrow size={16} className="arrow" />
          </a>
        ))}
      </div>
    </section>
  );
}

/** Product facts table. Unsourced fields say "Not verified" instead of being guessed or hidden. */
export function FactsTable({ product, keys, title }: { product: Product; keys: string[]; title: string }) {
  return (
    <div className="table-wrap">
      <table className="compare slim facts">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {keys.map((k) => {
            const f = fact(product, k);
            return (
              <tr key={k}>
                <th scope="row">{FACT_LABELS[k] ?? k}</th>
                <td>
                  {f ? (
                    <span className="cell">
                      <span>{f.value}</span>
                      {f.sourceUrl && <ExtLink href={f.sourceUrl} className="tiny text-link">Source · checked {formatDate(f.checkedAt)}</ExtLink>}
                    </span>
                  ) : (
                    <span className="muted">Not verified</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BILLING: Record<string, string> = { MONTHLY: "Monthly", ANNUAL: "Annual", FREE: "Free", CUSTOM: "Custom", ONE_TIME: "One-time", USAGE: "Usage-based" };

/**
 * Editorial pricing table: one row per verified price point, grouped by plan, exactly as captured
 * (vendor unit wording, promotional / per-seat flags, source and check date).
 */
export function PlanTable({ product }: { product: Product }) {
  if (!product.pricing.length) return null;
  const order = [...new Set(product.pricing.map((p) => p.plan ?? "—"))];
  const rows = order.flatMap((plan) => product.pricing.filter((p) => (p.plan ?? "—") === plan));
  return (
    <div className="table-wrap section-gap">
      <table className="compare stackable price-table">
        <caption className="sr-only">{product.name} verified pricing</caption>
        <thead>
          <tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Billing</th><th scope="col">Unit</th><th scope="col">Notes</th><th scope="col">Verification</th></tr>
        </thead>
        <tbody>
          {rows.map((pt, i) => {
            const first = i === 0 || (rows[i - 1].plan ?? "—") !== (pt.plan ?? "—");
            return (
              <tr key={`${pt.plan}-${pt.billingPeriod}-${i}`} className={first ? "plan-first" : "plan-cont"}>
                <th scope="row">{first ? pt.plan ?? "—" : <span className="sr-only">{pt.plan}</span>}</th>
                <td data-label="Price"><strong className="pt-price">{formatPrice(pt)}</strong>{pt.promotional && <span className="ind varies" style={{ marginLeft: 8 }}>Promotional</span>}</td>
                <td data-label="Billing">{BILLING[pt.billingPeriod ?? ""] ?? "—"}</td>
                <td data-label="Unit" className="small">{pt.unit ?? "—"}{pt.perSeat && <span className="ind verify" style={{ marginLeft: 6 }}>Per seat</span>}</td>
                <td data-label="Notes" className="small muted">{pt.note || "—"}</td>
                <td data-label="Verification" className="small">
                  <span className="status ok">✓ {formatDate(pt.capturedAt)}</span>
                  {pt.sourceUrl && <><br /><a className="tiny text-link" href={pt.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">Official source ↗</a></>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Freshness of each tracked dimension; unchecked dimensions say so. */
export function FreshnessStrip({ product }: { product: Product }) {
  const rows: [string, string | null][] = [
    ["Content updated", product.contentUpdatedAt],
    ["Pricing checked", product.pricingLastChecked],
    ["Features checked", product.featuresCheckedAt],
    ["Sources checked", product.sourceCheckedAt],
  ];
  return (
    <ol className="fresh-strip" aria-label="Freshness">
      {rows.map(([label, date]) => {
        const f = date ? freshness(new Date(date), 90) : null;
        const tone = !f ? "neutral" : f.state === "fresh" ? "ok" : f.state === "due-soon" ? "pending" : "danger";
        return (
          <li key={label} className={`fresh ${tone}`}>
            <IconClock size={14} />
            <span className="tiny muted">{label}</span>
            <strong className="small">{formatDate(date) ?? "Not yet checked"}</strong>
          </li>
        );
      })}
    </ol>
  );
}
