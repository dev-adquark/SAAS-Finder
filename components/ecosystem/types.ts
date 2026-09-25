export type EcoNode = { slug: string; name: string; href: string; count: number; color: string; products: string[] };

// Mirrors the CSS --cat-* tokens for WebGL materials.
export const CATEGORY_HEX: Record<string, string> = {
  "website-builders": "#22d3ee",
  design: "#ff5cc8",
  crm: "#7c6cff",
  marketing: "#fbbf24",
  "project-management": "#34d399",
};
