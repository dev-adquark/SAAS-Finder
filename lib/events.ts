// Browser-side analytics transport. Fire-and-forget; never throws and never blocks navigation.
export type ClientEvent = {
  event: "page_view" | "cta_click" | "cpl_submit";
  path?: string;
  product?: string;
  pageType?: string;
  pageSlug?: string;
  ctaType?: string;
  placement?: string;
  data?: Record<string, string | number | boolean>;
};

export function trackEvent(payload: ClientEvent) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ path: location.pathname, ...payload });
    if (navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never affect the page.
  }
}
