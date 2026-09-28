"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Sticky in-page navigation over existing sections; highlights the section in view. */
export function SectionNav({ sections, lead, label }: { sections: { id: string; label: string }[]; lead?: ReactNode; label: string }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  useEffect(() => {
    // Active = the last section whose top has passed 35% of the viewport (deterministic on any screen).
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let id = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) id = s.id;
      }
      setCurrent(id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [sections]);
  return (
    <nav className="section-nav" aria-label={label}>
      <div className="container section-nav-inner">
        {lead && <span className="section-nav-lead">{lead}</span>}
        <div className="section-nav-links">
          {sections.map((s) => <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? "true" : undefined} className={current === s.id ? "active" : undefined}>{s.label}</a>)}
        </div>
      </div>
    </nav>
  );
}
