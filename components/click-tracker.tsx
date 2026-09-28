"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/events";

// Page type of the current URL, matching lib/seo/routes PAGE_TYPES.
function pageOf(pathname: string): { pageType: string; pageSlug?: string } {
  const [a, b] = pathname.split("/").filter(Boolean);
  if (!a) return { pageType: "home" };
  if (a === "category") return { pageType: pathname.endsWith("/faq") ? "faq" : "category", pageSlug: b };
  if (a === "compare") return { pageType: "compare", pageSlug: b };
  if (a === "alternatives") return b ? { pageType: "alternatives", pageSlug: b } : { pageType: "index" };
  if (a === "best") return b ? { pageType: "best", pageSlug: b } : { pageType: "index" };
  if (a === "methodology" || a === "disclosure") return { pageType: a };
  if (["products", "categories", "comparisons"].includes(a)) return { pageType: "index" };
  return { pageType: "product", pageSlug: a };
}

const DESTINATION: [RegExp, string][] = [[/^\/compare\/[^/]+$/, "comparison"], [/^\/alternatives\/[^/]+$/, "alternatives"], [/^\/best\/[^/]+$/, "best_for"]];

/**
 * One delegated listener for engagement events that no other component records. CTA links through
 * /go and /sponsor are skipped: those are counted once, server-side, by the redirect itself.
 */
export function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button > 1) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || location.pathname.startsWith("/admin")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin === location.origin) {
        if (/^\/(go|sponsor)\//.test(url.pathname)) return;
        const to = DESTINATION.find(([re]) => re.test(url.pathname));
        if (to && url.pathname !== location.pathname) trackEvent({ event: "nav_click", ...pageOf(location.pathname), path: url.pathname, data: { to: to[1] } });
        return;
      }
      if (url.protocol === "https:" || url.protocol === "http:") {
        const here = pageOf(location.pathname);
        trackEvent({ event: "source_click", ...here, product: here.pageType === "product" ? here.pageSlug : undefined, data: { host: url.host.replace(/^www\./, "").slice(0, 100) } });
      }
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.getAttribute("role") !== "search" || location.pathname.startsWith("/admin")) return;
      trackEvent({ event: "search_submit", ...pageOf(location.pathname) });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
