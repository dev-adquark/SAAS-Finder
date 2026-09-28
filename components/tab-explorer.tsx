"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type TabItem = { id: string; label: string; sub?: string; icon?: ReactNode };

/**
 * Accessible tabs over server-rendered panels. Progressive enhancement: every panel is in the HTML
 * and visible until hydration, so content, anchors and no-JS visitors are unaffected. `#<id>` deep
 * links (and hash changes from in-page chips) select the matching tab.
 */
export function TabExplorer({ items, panels, label }: { items: TabItem[]; panels: ReactNode[]; label: string }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fromHash = () => {
      const i = items.findIndex((t) => `#${t.id}` === decodeURIComponent(location.hash));
      if (i >= 0) {
        setActive(i);
        requestAnimationFrame(() => root.current?.scrollIntoView({ block: "start" }));
      }
    };
    fromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch from "all panels" (SSR/no-JS) to tabbed mode
    setReady(true);
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items]);
  const select = (i: number, focus = false) => {
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const last = items.length - 1;
    const next = e.key === "ArrowRight" ? (active === last ? 0 : active + 1) : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };
  return (
    <div className={`tabx${ready ? " is-ready" : ""}`} ref={root}>
      <div className="tabx-list" role="tablist" aria-label={label} onKeyDown={onKey}>
        {items.map((t, i) => (
          <button key={t.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-controls={t.id} aria-selected={ready ? i === active : undefined} tabIndex={ready && i !== active ? -1 : 0} className={`tabx-tab${ready && i === active ? " active" : ""}`} onClick={() => select(i)}>
            {t.icon}
            <span><strong>{t.label}</strong>{t.sub && <small>{t.sub}</small>}</span>
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={items[i].id} id={items[i].id} role={ready ? "tabpanel" : undefined} aria-labelledby={ready ? `tab-${items[i].id}` : undefined} hidden={ready && i !== active} className="tabx-panel">
          {panel}
        </div>
      ))}
    </div>
  );
}
