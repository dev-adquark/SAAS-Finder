"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the current server page on an interval while `active` (e.g. a sync in progress). */
export function AutoRefresh({ active, seconds = 15 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [active, seconds, router]);
  return null;
}
