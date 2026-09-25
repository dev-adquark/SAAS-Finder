/** Lightweight CSS-3D prism (no WebGL): decorative, category-tinted, paused with reduced motion. */
export function Prism({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`prism-scene ${className}`} style={{ ["--ps" as string]: `${size}px` }} aria-hidden="true">
      <div className="prism">
        {["front", "back", "right", "left", "top", "bottom"].map((f) => <span key={f} className={`pf pf-${f}`} />)}
      </div>
    </div>
  );
}

/** CSS-3D orbit rings (e.g. behind the VS badge). */
export function Rings({ className = "" }: { className?: string }) {
  return (
    <div className={`rings3d ${className}`} aria-hidden="true">
      <span /><span /><span />
    </div>
  );
}
