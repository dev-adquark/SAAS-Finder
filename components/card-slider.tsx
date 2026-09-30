"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal slider for a set of cards. Cards keep exactly the width the responsive grid gave them
 * (same column math, see .card-track in globals.css); the row scrolls with swipe, trackpad, keyboard
 * and the arrow buttons instead of wrapping onto more rows. Server-rendered HTML is a plain
 * scrollable row, so it works before hydration and without JS.
 */
export function CardSlider({ children, label, resetKey }: { children: ReactNode; label: string; resetKey?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const [state, setState] = useState({ prev: false, next: false, first: 1, last: 0, total: 0 });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const max = el.scrollWidth - el.clientWidth;
    const left = el.getBoundingClientRect().left;
    const visible = cards.map((c, i) => ({ i, r: c.getBoundingClientRect() })).filter(({ r }) => r.left >= left - 2 && r.right <= left + el.clientWidth + 2);
    setState({
      prev: el.scrollLeft > 2,
      next: el.scrollLeft < max - 2,
      first: (visible[0]?.i ?? 0) + 1,
      last: (visible.at(-1)?.i ?? -1) + 1,
      total: cards.length,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // A different card set (e.g. another subcategory) starts from the first card.
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    measure();
  }, [resetKey, measure]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (el.clientWidth + gap), behavior: reduce ? "auto" : "smooth" });
  };

  const scrollable = state.prev || state.next;
  return (
    <div className="card-slider">
      <div className="card-slider-bar" hidden={!scrollable}>
        <span className="card-slider-count" aria-live="polite">{state.total ? `${state.first}–${state.last} of ${state.total}` : ""}</span>
        <button type="button" className="card-slider-btn" aria-controls={id} aria-label="Previous cards" disabled={!state.prev} onClick={() => page(-1)}>
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" className="card-slider-btn" aria-controls={id} aria-label="Next cards" disabled={!state.next} onClick={() => page(1)}>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div
        id={id}
        ref={track}
        className="card-track"
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") { e.preventDefault(); page(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); page(-1); }
        }}
      >
        {children}
      </div>
    </div>
  );
}
