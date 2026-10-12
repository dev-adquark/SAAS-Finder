import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// Sitewide default social-share card: applies to every route that doesn't define its own
// opengraph-image (Next merges this file-based convention into that route's metadata automatically).
// Generated at request time from design-system colors, not a static asset, so it never drifts from
// the brand palette in app/globals.css.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#f6f2ea",
          backgroundImage: "linear-gradient(135deg, rgba(47,91,255,0.08), rgba(232,88,58,0.06))",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, backgroundColor: "#16161a", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "#f6f2ea" }} />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "#16161a" }}>
            FindMy<span style={{ color: "#6c675e", fontWeight: 400 }}>.tech</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 56, fontSize: 60, fontWeight: 600, color: "#16161a", lineHeight: 1.15, maxWidth: 920 }}>
          Find software that actually fits.
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#3b3a36", maxWidth: 820 }}>
          Independent SaaS reviews, alternatives and comparisons — traced back to official sources.
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#6c675e" }}>{SITE_NAME.toLowerCase().replace(".tech", "")}.tech</div>
      </div>
    ),
    { ...size },
  );
}
