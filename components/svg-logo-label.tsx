"use client";
import { useEffect, useState } from "react";

/**
 * Node label inside an SVG graph: the company logo (first source that loads) followed by the name,
 * else the original "initials · name" text. Sources are verified with an HTMLImageElement preload
 * (SVG <image> error events are unreliable); a failure steps to the next source, then to the text.
 */
export function SvgLogoLabel({ sources, x, y, width, name, fallback }: { sources: string[]; x: number; y: number; width: number; name: string; fallback: string }) {
  const [i, setI] = useState(0);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const src = sources[i];
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => !cancelled && setOk(src);
    img.onerror = () => !cancelled && setI((n) => n + 1);
    img.src = src;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sources are fixed per render
  }, [i]);

  const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  if (!ok) return <text x={x} y={y + 5} textAnchor="middle">{fit(fallback, 24)}</text>;
  const size = 20;
  return (
    <>
      <image href={ok} x={x - width / 2 + 14} y={y - size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
      <text x={x + 12} y={y + 5} textAnchor="middle">{fit(name, 20)}</text>
    </>
  );
}
