// Scratch: downloads the best vendor-declared icon per product and reports its real pixel size.
import fs from "node:fs";
import path from "node:path";
import { seedProducts } from "./lib/content/seed/products";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const found = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const outDir = process.argv[3];
const get = (u: string) => fetch(u, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
function pngSize(b: Buffer) { return b.slice(1, 4).toString() === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; }
(async () => {
  const report: Record<string, unknown> = {};
  for (const p of seedProducts) {
    const f = found[p.slug] ?? {};
    const cands: { url: string; how: string; declaredBy: string }[] = [];
    // 1) web app manifest icons
    try {
      const html = await (await get(f.base ?? p.officialUrl)).text();
      const m = html.match(/<link\b[^>]*rel=["']manifest["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)/i)?.[1];
      if (m) {
        const murl = new URL(m.replace(/&amp;/g, "&"), f.base ?? p.officialUrl).toString();
        const man = await (await get(murl)).json();
        for (const i of (man.icons ?? []).sort((a: { sizes?: string }, b: { sizes?: string }) => parseInt(b.sizes ?? "0") - parseInt(a.sizes ?? "0"))) cands.push({ url: new URL(i.src, murl).toString(), how: `manifest ${i.sizes ?? ""}`, declaredBy: murl });
      }
    } catch {}
    // 2) declared <link> icons: largest png/svg first, ico last
    const rank = (i: { url: string; sizes: string | null }) => (/\.svg(\?|$)/i.test(i.url) ? 5000 : /\.ico(\?|$)/i.test(i.url) ? 1 : parseInt(i.sizes ?? "100"));
    for (const i of [...(f.icons ?? [])].filter((i: { url: string }) => !i.url.startsWith("data:")).sort((a: never, b: never) => rank(b) - rank(a))) cands.push({ url: i.url, how: `${i.rel}${i.sizes ? ` ${i.sizes}` : ""}`, declaredBy: f.base ?? p.officialUrl });
    // 3) conventional path on the official host
    cands.push({ url: new URL("/apple-touch-icon.png", f.base ?? p.officialUrl).toString(), how: "conventional /apple-touch-icon.png", declaredBy: new URL(f.base ?? p.officialUrl).origin });
    let chosen: Record<string, unknown> | null = null;
    const tried: string[] = [];
    for (const c of cands) {
      try {
        const r = await get(c.url);
        const type = r.headers.get("content-type") ?? "";
        if (!r.ok || !/image\//.test(type)) { tried.push(`${r.status} ${type.slice(0, 20)} ${c.how}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        const svg = /svg/.test(type);
        const size = svg ? { w: 999, h: 999 } : pngSize(buf);
        const ext = svg ? "svg" : /png/.test(type) ? "png" : /x-icon|vnd.microsoft/.test(type) ? "ico" : /webp/.test(type) ? "webp" : /jpe?g/.test(type) ? "jpg" : "img";
        const rec = { file: `${p.slug}.${ext}`, url: r.url, how: c.how, declaredBy: c.declaredBy, type, bytes: buf.length, size };
        if (!chosen || (size && (!chosen.size || (size as { w: number }).w > ((chosen.size as { w: number } | null)?.w ?? 0)))) { chosen = rec; fs.writeFileSync(path.join(outDir, `${p.slug}.${ext}`), buf); }
        if (svg || (size && size.w >= 180)) break;
      } catch (e) { tried.push(`err ${c.how}`); }
    }
    report[p.slug] = chosen ?? { none: true, tried };
    console.log(p.slug.padEnd(14), chosen ? `${chosen.file} ${JSON.stringify(chosen.size)} via ${chosen.how} (${String(chosen.url).slice(0, 70)})` : `NONE ${tried.slice(0, 3).join("; ")}`);
  }
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
})();
