"use client";
import { useEffect, useRef } from "react";

/** Subtle depth response to the pointer (fine pointers only; disabled with reduced motion). */
export function AtlasMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>("[data-atlas]");
    const stage = host?.querySelector<HTMLElement>(".atlas-stage");
    if (!host || !stage || !window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
        const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
        stage.style.setProperty("--rx", x.toFixed(3));
        stage.style.setProperty("--ry", (-y * 3).toFixed(3));
      });
    };
    const leave = () => {
      stage.style.setProperty("--rx", "0");
      stage.style.setProperty("--ry", "0");
    };
    window.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <span ref={ref} hidden />;
}
