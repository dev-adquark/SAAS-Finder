"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Progressive reveal: content is visible by default (no-JS, crawlers, print). With JS, only
// elements below the fold are hidden and then revealed as they scroll into view.
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".reveal, .reveal-stagger > *"));
    const fold = window.innerHeight * 0.92;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          e.target.classList.remove("pre");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const pending: HTMLElement[] = [];
    targets.forEach((el, i) => {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add("pre");
      el.style.setProperty("--d", `${(i % 4) * 70}ms`);
      io.observe(el);
      pending.push(el);
    });
    // Failsafe: a real scroll always reveals below-the-fold content, but a tool that captures the
    // page without one (a "full page" screenshot extension, some scrapers, print-to-PDF, an unusual
    // renderer) never fires the intersection callback, which would otherwise leave this content —
    // the actual page content, not decoration — invisible forever. Force it visible after a short
    // wait so it can never get stuck hidden, without touching the reveal-on-scroll experience for
    // everyone else.
    const failsafe = window.setTimeout(() => {
      for (const el of pending) {
        el.classList.add("in");
        el.classList.remove("pre");
      }
      io.disconnect();
    }, 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);
  return null;
}
