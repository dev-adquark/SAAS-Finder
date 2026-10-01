"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * A remote logo tile (the existing `.mono.logo` markup). On a failed load it retries once (Logo.dev
 * can briefly refuse bursts of requests), then renders `fallback` — the static-icon or monogram tile
 * the server already prepared, at the same size — so a failure never shows a broken image or shifts
 * layout. Loads that failed before hydration are caught on mount via `complete`/`naturalWidth`.
 */
export function LogoImage({ src, alt, px, fallback, className, style }: { src: string; alt: string; px: number; fallback: ReactNode; className: string; style?: CSSProperties }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  const onError = () => {
    if (attempt === 0) setTimeout(() => setAttempt(1), 1200);
    else setFailed(true);
  };

  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the pre-hydration state matters here
  }, []);

  if (failed) return <>{fallback}</>;
  return (
    <span className={className} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Logo.dev serves sized, cached images; next/image would proxy them for no gain */}
      <img ref={img} src={attempt ? `${src}&retry=1` : src} alt={alt} width={px} height={px} loading="lazy" decoding="async" onError={onError} />
    </span>
  );
}
