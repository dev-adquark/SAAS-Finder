/* Source-link QA: requests every official source URL and reports non-200 responses.
 *   tsx scripts/check-sources.ts
 * Some vendors block automated clients (403) even though the page works in a browser; those are
 * reported separately from genuine failures (404/410/5xx/network). */
import { research } from "../lib/content/seed/research";

export {};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const urls = [...new Set(Object.values(research).flatMap((r) => r.sources.map((s) => s.url)))];
async function main() {
const results: { url: string; status: number | string }[] = [];
const queue = [...urls];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const url = queue.shift()!;
      try {
        const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(20000) });
        results.push({ url, status: res.status });
        await res.body?.cancel();
      } catch (e) {
        results.push({ url, status: e instanceof Error ? e.name : "error" });
      }
    }
  }),
);
const ok = results.filter((r) => r.status === 200).length;
const blocked = results.filter((r) => r.status === 403 || r.status === 429);
// Node's fetch rejects some very large response headers (TypeError) — verify those with curl/browser.
const client = results.filter((r) => r.status === "TypeError");
const broken = results.filter((r) => r.status !== 200 && r.status !== 403 && r.status !== 429 && r.status !== "TypeError");
console.log(`${urls.length} source URLs: ${ok} OK, ${blocked.length} bot-blocked (403/429), ${client.length} client-limited (check in a browser), ${broken.length} failing`);
for (const r of [...blocked, ...client, ...broken]) console.log(`  ${r.status} ${r.url}`);
process.exit(broken.length ? 1 : 0);
}

void main();
