"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons";
import { scoreItem, type SearchItem, type SearchKind } from "@/lib/search-score";

const GROUPS: { k: SearchKind; label: string }[] = [
  { k: "product", label: "Reviews" },
  { k: "category", label: "Categories" },
  { k: "best", label: "Best-for guides" },
  { k: "compare", label: "Comparisons" },
  { k: "alternatives", label: "Alternatives" },
  { k: "faq", label: "FAQs" },
];
const GLYPH: Record<SearchKind, string> = { product: "◆", category: "▦", best: "★", compare: "⇄", alternatives: "↺", faq: "?" };
const RECENT_KEY = "sf:recent-searches";
export const OPEN_EVENT = "sf:open-search";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** ⌘K / Ctrl+K / "/" command palette over every published page. The index loads on first open. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const show = useCallback((initial = "") => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setQ(initial);
    setActive(0);
    setRecent(readRecent());
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = (e: Event) => show((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    if (!items) fetch("/api/search-index").then((r) => r.json()).then((d: SearchItem[]) => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, items]);

  const results = useMemo(() => {
    if (!items) return [];
    const scored = items.map((it) => ({ it, s: scoreItem(it, q) })).filter((x) => x.s > 0);
    if (q.trim()) scored.sort((a, b) => b.s - a.s || a.it.l.localeCompare(b.it.l));
    const perGroup = q.trim() ? 6 : 3;
    // FAQs only appear once the visitor types a query.
    return GROUPS.filter((g) => g.k !== "faq" || q.trim()).flatMap((g) => scored.filter((x) => x.it.k === g.k).slice(0, perGroup).map((x) => x.it));
  }, [items, q]);

  const close = () => {
    setOpen(false);
    restoreFocus.current?.focus?.();
  };
  const go = (item: SearchItem) => {
    if (q.trim()) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([q.trim(), ...readRecent().filter((r) => r !== q.trim())].slice(0, 5)));
      } catch {}
    }
    setOpen(false);
    router.push(item.h);
  };

  if (!open) return null;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === "Tab") e.preventDefault(); // keep focus inside the dialog
  };

  let index = -1;
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search SaaSFinder" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <IconSearch size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search tools, categories, comparisons…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `pi-${active}` : undefined}
            aria-autocomplete="list"
          />
          <kbd>Esc</kbd>
        </div>
        {!q && recent.length > 0 && (
          <div className="palette-group" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            Recent
            {recent.map((r) => <button key={r} type="button" className="chip" style={{ cursor: "pointer" }} onClick={() => setQ(r)}>{r}</button>)}
          </div>
        )}
        <ul className="palette-list" id="palette-results" role="listbox" aria-label="Results">
          {!items && [0, 1, 2, 3].map((i) => <li key={i} className="skel" style={{ height: 44, margin: 6 }} />)}
          {items && results.length === 0 && <li className="palette-empty">No matches for “{q}”.</li>}
          {GROUPS.map((g) => {
            const rows = results.filter((r) => r.k === g.k);
            if (!rows.length) return null;
            return (
              <li key={g.k} role="presentation">
                <div className="palette-group">{g.label}</div>
                <ul role="group" aria-label={g.label} style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {rows.map((r) => {
                    index++;
                    const i = index;
                    return (
                      <li key={r.h} id={`pi-${i}`} role="option" aria-selected={i === active} className="palette-item" style={{ ["--cat" as string]: `var(--cat-${r.c}, var(--primary))` }} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                        <span className="pi-icon" aria-hidden="true">{GLYPH[r.k]}</span>
                        <span>{r.l}</span>
                        <span className="pi-meta">{r.v && <span className={`ind ${r.v === "Pricing verified" ? "included" : "varies"}`} style={{ marginRight: 8 }}>{r.v}</span>}{r.m}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
        <div className="palette-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span><span style={{ marginLeft: "auto" }}>{items ? `${items.length} pages indexed` : "Loading index…"}</span></div>
      </div>
    </div>
  );
}

/** Button (or fake input) that opens the palette. */
export function SearchTrigger({ className = "search-trigger", label = "Search tools, comparisons…" }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))} aria-label="Open search">
      <IconSearch size={16} />
      <span className="label">{label}</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
