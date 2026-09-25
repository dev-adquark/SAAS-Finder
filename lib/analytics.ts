import { PAGE_TYPES, type PageType, isValidSlug, normalizePath } from "@/lib/seo/routes";

export const EVENT_NAMES = ["page_view", "outbound_click", "cta_click", "sponsor_click", "cpl_submit"] as const;
export type EventName = (typeof EVENT_NAMES)[number];
// Historic name recorded before `outbound_click` existed; still reported, never accepted.
export const LEGACY_EVENT_NAMES = ["affiliate_click"] as const;

export const CTA_TYPES = ["button", "inline", "plan", "comparison", "hero"] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const MAX_BODY_BYTES = 4_000;
export const MAX_METADATA_BYTES = 1_000;
const MAX_PATH = 300;
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// Metadata keys that must never be stored (no personal or sensitive data).
const FORBIDDEN_KEY = /(email|phone|name|address|ip|token|password|secret|card|ssn|auth|cookie|session)/i;

export type Campaign = {
  product: string | null;
  pageType: PageType | null;
  pageSlug: string | null;
  ctaType: CtaType | null;
  placement: string | null;
};

const isEvent = (v: unknown): v is EventName => typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);
const token = (v: unknown): string | null => (typeof v === "string" && TOKEN.test(v) ? v : null);
const slug = (v: unknown): string | null => (isValidSlug(v) ? v : null);

export function parseCampaign(input: Record<string, unknown>): Campaign {
  return {
    product: slug(input.product),
    pageType: pick(input.pageType, PAGE_TYPES),
    pageSlug: slug(input.pageSlug),
    ctaType: pick(input.ctaType, CTA_TYPES),
    placement: token(input.placement),
  };
}

/** Reads campaign metadata from `/go` or `/sponsor` query params (short keys keep URLs tidy). */
export function campaignFromSearchParams(params: URLSearchParams, product: string | null): Campaign {
  return parseCampaign({ product, pageType: params.get("pt"), pageSlug: params.get("ps"), ctaType: params.get("ct"), placement: params.get("pl") });
}

export function campaignQuery(c: Partial<Omit<Campaign, "product">>): string {
  const q = new URLSearchParams();
  if (c.pageType) q.set("pt", c.pageType);
  if (c.pageSlug) q.set("ps", c.pageSlug);
  if (c.ctaType) q.set("ct", c.ctaType);
  if (c.placement) q.set("pl", c.placement);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function cleanMetadata(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 10)) {
    if (!TOKEN.test(k) || FORBIDDEN_KEY.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export type AnalyticsRecord = {
  event: EventName;
  path: string | null;
  productSlug: string | null;
  placement: string | null;
  pageType: string | null;
  pageSlug: string | null;
  ctaType: string | null;
  sponsorId: string | null;
  metadata: Record<string, string | number | boolean> | null;
};

export type ParseResult = { ok: true; record: AnalyticsRecord } | { ok: false; error: string; status: number };

/** Validates an untrusted analytics payload from the browser. */
export function parseAnalyticsPayload(raw: string): ParseResult {
  if (raw.length > MAX_BODY_BYTES) return { ok: false, error: "request_too_large", status: 413 };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid_json", status: 400 };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_request", status: 400 };
  const b = body as Record<string, unknown>;
  if (!isEvent(b.event)) return { ok: false, error: "invalid_event", status: 400 };
  const metadata = cleanMetadata(b.data);
  if (metadata && JSON.stringify(metadata).length > MAX_METADATA_BYTES) return { ok: false, error: "metadata_too_large", status: 413 };
  const campaign = parseCampaign(b);
  const path = typeof b.path === "string" && b.path.startsWith("/") ? normalizePath(b.path).slice(0, MAX_PATH) : null;
  return {
    ok: true,
    record: {
      event: b.event,
      path,
      productSlug: campaign.product,
      placement: campaign.placement,
      pageType: campaign.pageType,
      pageSlug: campaign.pageSlug,
      ctaType: campaign.ctaType,
      sponsorId: token(b.sponsorId),
      metadata,
    },
  };
}
