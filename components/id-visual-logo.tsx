"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Centre tile of the product identity visual: the Logo.dev image, else the static icon on file,
 * else the initials. SVG <image> error events are unreliable (and are missed entirely before
 * hydration), so each source is verified with an HTMLImageElement preload: a failed remote image is
 * retried once, then the tile steps down the chain in place, keeping its size.
 */
export function IdVisualLogo({ remote, local, letters, between }: { remote: string | null; local: string | null; letters: string; between?: ReactNode }) {
  const sources = [remote, local].filter((s): s is string => !!s);
  const [i, setI] = useState(0);
  const [href, setHref] = useState<string | null>(sources[0] ?? null);

  useEffect(() => {
    const src = sources[i];
    if (!src) return void setHref(null);
    let cancelled = false;
    let retried = false;
    const probe = (url: string) => {
      const img = new Image();
      img.onload = () => { if (!cancelled) setHref(url); };
      img.onerror = () => {
        if (cancelled) return;
        if (src === remote && !retried) {
          retried = true;
          setTimeout(() => !cancelled && probe(`${src}&retry=1`), 1200);
        } else setI((n) => n + 1);
      };
      img.src = url;
    };
    probe(src);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sources are fixed per render of a product page
  }, [i]);

  return (
    <>
      <rect className={href ? "iv-logo-tile float-a" : "iv-a float-a"} x="70" y="100" width="190" height="190" rx="26" />
      {between}
      {href ? (
        <image className="float-a" href={href} x="110" y="140" width="110" height="110" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text className="iv-t" x="165" y="232" textAnchor="middle">{letters}</text>
      )}
    </>
  );
}
