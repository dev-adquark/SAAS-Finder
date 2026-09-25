// Category-specific comparison columns. Product `comparison` values are keyed by `key`.
// Fields marked `computed: "pricing"` are never stored; they are derived from verified pricing.

export type ComparisonField = { key: string; label: string; computed?: "pricing" };

const pricing: ComparisonField = { key: "pricing", label: "Pricing", computed: "pricing" };

export const COMPARISON_SCHEMAS: Record<string, ComparisonField[]> = {
  "website-builders": [
    { key: "templates", label: "Templates" },
    { key: "hosting", label: "Hosting" },
    { key: "export", label: "Export options" },
    { key: "seo", label: "SEO controls" },
    pricing,
    { key: "ease", label: "Ease of use" },
    { key: "customization", label: "Customization" },
  ],
  crm: [
    { key: "pipeline", label: "Pipeline management" },
    { key: "automation", label: "Automation" },
    { key: "reporting", label: "Reporting" },
    { key: "freePlan", label: "Free plan" },
    { key: "customization", label: "Customization" },
    { key: "setup", label: "Setup effort" },
    pricing,
  ],
  design: [
    { key: "templates", label: "Templates" },
    { key: "collaboration", label: "Collaboration" },
    { key: "brand", label: "Brand controls" },
    { key: "precision", label: "Design precision" },
    { key: "learning", label: "Learning curve" },
    { key: "export", label: "Export formats" },
    pricing,
  ],
  marketing: [
    { key: "keywords", label: "Keyword research" },
    { key: "backlinks", label: "Backlink data" },
    { key: "siteAudit", label: "Site audit" },
    { key: "rankTracking", label: "Rank tracking" },
    { key: "content", label: "Content tools" },
    { key: "scope", label: "Toolkit scope" },
    pricing,
  ],
  "project-management": [
    { key: "views", label: "Views" },
    { key: "automation", label: "Automation" },
    { key: "dependencies", label: "Dependencies" },
    { key: "reporting", label: "Reporting" },
    { key: "customization", label: "Customization" },
    { key: "learning", label: "Learning curve" },
    pricing,
  ],
  analytics: [
    { key: "tracking", label: "Event tracking" },
    { key: "reports", label: "Reporting" },
    { key: "integrations", label: "Integrations" },
    { key: "privacy", label: "Privacy controls" },
    pricing,
  ],
};

const FALLBACK_SCHEMA: ComparisonField[] = [pricing];

export function comparisonSchemaFor(categorySlug: string): ComparisonField[] {
  return COMPARISON_SCHEMAS[categorySlug] ?? FALLBACK_SCHEMA;
}

/** Stored (non-computed) keys an editor must fill for a product in this category. */
export function storedComparisonKeys(categorySlug: string): string[] {
  return comparisonSchemaFor(categorySlug).filter((f) => !f.computed).map((f) => f.key);
}
