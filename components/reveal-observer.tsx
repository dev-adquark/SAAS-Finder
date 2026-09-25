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
    targets.forEach((el, i) => {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add("pre");
      el.style.setProperty("--d", `${(i % 4) * 70}ms`);
      io.observe(el);
    });
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
