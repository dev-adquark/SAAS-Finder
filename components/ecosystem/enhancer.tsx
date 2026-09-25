"use client";
import { useEffect, useRef } from "react";
import type { EcoNode } from "@/components/ecosystem/types";

/** Decides whether the device should get the 3D scene, then loads Three.js on idle. */
export function EcosystemEnhancer({ nodes }: { nodes: EcoNode[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>("[data-eco]");
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 860px)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
    if (reduced || small || weak) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

    let dispose: (() => void) | undefined;
    let cancelled = false;
    const start = () =>
      import("@/components/ecosystem/scene")
        .then(({ mountEcosystem }) => {
          if (!cancelled) dispose = mountEcosystem(host, nodes);
        })
        .catch(() => {});
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      if (!w.requestIdleCallback) window.clearTimeout(id);
      dispose?.();
    };
  }, [nodes]);
  return <span ref={ref} hidden />;
}
