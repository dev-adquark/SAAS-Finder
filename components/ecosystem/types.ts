export type EcoNode = { slug: string; name: string; href: string; count: number; color: string; products: { name: string; href: string }[] };

// Mirrors the CSS --cat-* tokens for WebGL materials.
export const CATEGORY_HEX: Record<string, string> = {
  "website-builders": "#22d3ee",
  design: "#a855f7",
  crm: "#10b981",
  marketing: "#f97316",
  "project-management": "#6366f1",
};
