"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/events";

export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && !pathname.startsWith("/admin")) trackEvent({ event: "page_view", path: pathname });
  }, [pathname]);
  return null;
}
