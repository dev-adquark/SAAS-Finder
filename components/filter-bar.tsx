"use client";
import { useState } from "react";

/**
 * Filters server-rendered cards in place (cards carry `data-filter`). All content stays in the
 * HTML for crawlers; this only toggles `hidden`.
 */
export function FilterBar({ targetId, options, label }: { targetId: string; options: string[]; label: string }) {
  const [active, setActive] = useState("All");
  const apply = (value: string) => {
    setActive(value);
    document.getElementById(targetId)?.querySelectorAll<HTMLElement>("[data-filter]").forEach((el) => {
      el.hidden = value !== "All" && el.dataset.filter !== value;
    });
  };
  if (options.length < 2) return null;
  return (
    <div className="filters" role="group" aria-label={label}>
      {["All", ...options].map((o) => (
        <button key={o} type="button" aria-pressed={active === o} onClick={() => apply(o)}>{o}</button>
      ))}
    </div>
  );
}
