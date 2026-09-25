import type { SVGProps } from "react";

// Inline SVG icon set: server-rendered, no icon-font or client JS. Decorative by default.
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconBrowser = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /><path d="M8 14h5M8 17h8" /></Svg>;
export const IconPen = (p: P) => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const IconUsers = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5" /></Svg>;
export const IconChart = (p: P) => <Svg {...p}><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></Svg>;
export const IconKanban = (p: P) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18M15 3v18" /><path d="M5.5 7h1.5M11 7h2M17 7h1.5M11 11h2" /></Svg>;
export const IconGrid = (p: P) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconArrow = (p: P) => <Svg {...p}><path d="M7 17 17 7M8 7h9v9" /></Svg>;
export const IconRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const IconSpark = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconScale = (p: P) => <Svg {...p}><path d="M12 3v18M5 21h14" /><path d="m5 7 7-2 7 2" /><path d="M5 7 2.5 13a3 3 0 0 0 5 0Z M19 7l-2.5 6a3 3 0 0 0 5 0Z" /></Svg>;
export const IconLayers = (p: P) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>;
export const IconTag = (p: P) => <Svg {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="8" cy="8" r="1.5" /></Svg>;
export const IconMenu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const IconLink = (p: P) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconStar = (p: P) => <Svg {...p}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" /></Svg>;
export const IconCompass = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></Svg>;

const CATEGORY_ICONS: Record<string, (p: P) => React.ReactElement> = {
  "website-builders": IconBrowser,
  design: IconPen,
  crm: IconUsers,
  marketing: IconChart,
  "project-management": IconKanban,
};

export function CategoryIcon({ slug, ...p }: P & { slug: string }) {
  const I = CATEGORY_ICONS[slug] ?? IconGrid;
  return <I {...p} />;
}

export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  // Atlas mark: a graticule globe with one meridian highlighted.
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14.5" fill="#16161a" />
      <ellipse cx="16" cy="16" rx="6.5" ry="14.5" fill="none" stroke="#f6f2ea" strokeWidth="1.2" />
      <path d="M1.5 16h29M4 9h24M4 23h24" stroke="#f6f2ea" strokeWidth="1" opacity=".55" />
      <path d="M16 1.5v29" stroke="#2f5bff" strokeWidth="2" />
      <circle cx="22.5" cy="10.5" r="2.4" fill="#e8583a" />
    </svg>
  );
}
