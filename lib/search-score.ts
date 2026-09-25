// Client-safe search types and ranking (no server imports).
export type SearchKind = "product" | "category" | "compare" | "alternatives" | "best" | "faq";
/** k kind, l label, h href, m meta line, c category slug, x extra keywords, v verification badge. */
export type SearchItem = { k: SearchKind; l: string; h: string; m: string; c: string; x: string; v?: string };

/** Lightweight ranking: prefix > word-prefix > substring > subsequence (label), then keywords. */
export function scoreItem(item: SearchItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const l = item.l.toLowerCase();
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (l.includes(q)) return 45;
  const x = `${item.m} ${item.x}`.toLowerCase();
  if (x.includes(q)) return 25;
  let i = 0;
  for (const ch of l) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
}
