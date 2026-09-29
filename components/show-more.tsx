"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Progressive-disclosure wrapper for the long tail of a page (deep detail after the essentials).
 * Everything inside is always in the server-rendered HTML — no-JS visitors, crawlers and search
 * engines see it all. On mobile only, JS clips it behind a "Show more" button after hydration; a
 * deep link (#id) to anything inside auto-expands first, so in-page navigation still works.
 */
export function ShowMoreSection({ children, label }: { children: React.ReactNode; label: string }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const containsHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      return !!id && !!root.current?.querySelector(`#${CSS.escape(id)}`);
    };
    if (containsHash()) setOpen(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch from "always open" (SSR/no-JS) to collapsible
    setReady(true);
    const onHash = () => { if (containsHash()) setOpen(true); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div ref={root} className={`show-more${ready ? " is-ready" : ""}${open ? " open" : ""}`}>
      <div className="show-more-body">{children}</div>
      {ready && !open && (
        <button type="button" className="show-more-btn" onClick={() => setOpen(true)}>
          {label} <span className="arrow-down" aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  );
}
