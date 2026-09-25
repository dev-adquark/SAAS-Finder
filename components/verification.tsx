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
};

const RESOURCE_ORDER: SourceKind[] = ["PRODUCT", "PRICING", "DOCUMENTATION", "HELP_CENTER", "SECURITY", "CHANGELOG", "NEWSROOM", "INTEGRATIONS", "STATUS", "CONTACT", "ABOUT"];

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
              <span className="src-kind">{SOURCE_LABEL[s.kind]}</span>
              <ExtLink href={s.url}>{s.name}</ExtLink>
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

/** Plan comparison: one row per plan, monthly vs annual billing columns, exactly as captured. */
export function PlanTable({ product }: { product: Product }) {
  const plans = [...new Set(product.pricing.map((p) => p.plan ?? "—"))];
  if (!plans.length) return null;
  const cell = (plan: string, period: string) => product.pricing.find((p) => (p.plan ?? "—") === plan && p.billingPeriod === period);
  const hasMonthly = product.pricing.some((p) => p.billingPeriod === "MONTHLY");
  const hasAnnual = product.pricing.some((p) => p.billingPeriod === "ANNUAL");
  const show = (pt: ReturnType<typeof cell>) =>
    pt ? (
      <span className="cell">
        <strong>{formatPrice(pt)}</strong>
        {pt.unit && <span className="tiny muted">{pt.unit}</span>}
        {pt.promotional && <span className="ind varies">Promotional</span>}
        {pt.perSeat && <span className="ind verify">Per seat</span>}
      </span>
    ) : <span className="muted">—</span>;
  return (
    <div className="table-wrap section-gap">
      <table className="compare">
        <thead>
          <tr>
            <th scope="col">Plan</th>
            {hasMonthly && <th scope="col">Billed monthly</th>}
            {hasAnnual && <th scope="col">Billed annually</th>}
            <th scope="col">Other</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const free = cell(plan, "FREE");
            const custom = cell(plan, "CUSTOM");
            return (
              <tr key={plan}>
                <th scope="row">{plan}</th>
                {hasMonthly && <td>{show(cell(plan, "MONTHLY"))}</td>}
                {hasAnnual && <td>{show(cell(plan, "ANNUAL"))}</td>}
                <td>{free ? <span className="ind included">Free</span> : custom ? <span className="ind verify">Custom — contact vendor</span> : <span className="muted">—</span>}</td>
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
