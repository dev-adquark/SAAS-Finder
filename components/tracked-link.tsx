"use client";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/events";

type Props = {
  href: string;
  rel: string;
  className?: string;
  children: ReactNode;
  campaign: { product: string; pageType: string; pageSlug: string; ctaType: string; placement: string };
};

/** Outbound CTA anchor: records `cta_click` in the browser; `/go` records `outbound_click` server-side. */
export function TrackedLink({ href, rel, className, children, campaign }: Props) {
  return (
    <a href={href} rel={rel} target="_blank" className={className} onClick={() => trackEvent({ event: "cta_click", ...campaign })}>
      {children}
    </a>
  );
}
