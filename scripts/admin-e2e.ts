export {};

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const KEY = process.env.ADMIN_API_KEY ?? "";
let cookie = "";
const fail: string[] = [];

async function formPost(pagePath: string, formIndex: number, fields: Record<string, string>, override?: (form: string) => string) {
  const page = await fetch(BASE + pagePath, { headers: { cookie } });
  const html = await page.text();
  const forms = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)];
  const form = override ? override(html) : forms[formIndex][0];
  const fd = new FormData();
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) fd.append(name, value.replace(/&amp;/g, "&"));
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const res = await fetch(BASE + pagePath, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
  const set = res.headers.get("set-cookie");
  if (set?.startsWith("sf_admin=")) cookie = set.split(";")[0];
  return res;
}

// Admin UI end-to-end over real no-JS form posts:  BASE_URL=... ADMIN_API_KEY=... npm run test:admin-e2e
(async () => {
  // Wrong password
  let r = await formPost("/admin/login", 0, { password: "wrong-password-xyz" });
  const loc1 = r.headers.get("x-action-redirect") ?? r.headers.get("location") ?? "";
  if (!loc1.includes("error=")) fail.push("wrong password not rejected: " + r.status + " " + loc1);
  if (cookie) fail.push("cookie set on failed login");
  // Right password
  r = await formPost("/admin/login", 0, { password: KEY });
  if (!cookie) fail.push("login did not set session cookie; status " + r.status);
  for (const p of ["/admin", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/use-cases", "/admin/alternatives", "/admin/comparisons", "/admin/pricing", "/admin/affiliates", "/admin/sponsors", "/admin/refreshes", "/admin/analytics", "/admin/faqs", "/admin/quality", "/admin/relationships"]) {
    const res = await fetch(BASE + p, { headers: { cookie }, redirect: "manual" });
    const body = await res.text();
    if (res.status !== 200 || /Application error|Internal Server Error/.test(body)) fail.push(`${p}: ${res.status}`);
  }
  // Edit a product through the real editor form: change the tagline, save.
  const list = await (await fetch(BASE + "/admin/products", { headers: { cookie } })).text();
  const id = list.match(/href="\/admin\/products\/([a-z0-9]{20,})"/)?.[1];
  if (!id) fail.push("no product link in admin list");
  const editor = await (await fetch(BASE + `/admin/products/${id}`, { headers: { cookie } })).text();
  if (!editor.includes('name="cmp_')) fail.push("editor lacks comparison schema fields");
  // Submit the main product form with all current values (textareas/inputs/selects) + a changed tagline.
  const main = editor.match(/<form[^>]*>[\s\S]*?Save product[\s\S]*?<\/form>/)![0];
  const fields: Record<string, string> = {};
  for (const m of main.matchAll(/<input[^>]*>/g)) {
    const tag = m[0];
    if (/type="(hidden|checkbox)"/.test(tag)) continue;
    const name = tag.match(/name="([^"]+)"/)?.[1];
    if (name) fields[name] = (tag.match(/value="([^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  }
  for (const m of main.matchAll(/<textarea[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) fields[m[1]] = m[2].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/^\n/, "");
  for (const m of main.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) fields[m[1]] = m[2].match(/<option[^>]*value="([^"]*)"[^>]*selected/)?.[1] ?? m[2].match(/<option[^>]*value="([^"]*)"/)?.[1] ?? "";
  const originalTagline = fields.tagline;
  fields.tagline = originalTagline + " (edited)";
  r = await formPost(`/admin/products/${id}`, 0, fields, () => main);
  const loc = r.headers.get("x-action-redirect") ?? r.headers.get("location") ?? "";
  if (!loc.includes("ok=")) fail.push("save failed: " + r.status + " " + decodeURIComponent(loc));
  // Publish gate through UI: set required field empty → error flash
  r = await formPost(`/admin/products/${id}`, 0, { ...fields, limitations: "" }, () => main);
  const loc2 = decodeURIComponent(r.headers.get("x-action-redirect") ?? r.headers.get("location") ?? "");
  if (!loc2.includes("error=") || !loc2.includes("limitation")) fail.push("publish gate not enforced in UI: " + loc2);
  // Restore
  fields.tagline = originalTagline;
  r = await formPost(`/admin/products/${id}`, 0, fields, () => main);
  // Action without session must fail
  const saved = cookie; cookie = "";
  r = await formPost(`/admin/products/${id}`, 0, fields, () => main);
  const loc3 = r.headers.get("x-action-redirect") ?? r.headers.get("location") ?? "";
  if (loc3.includes("ok=")) fail.push("server action accepted without session");
  cookie = saved;
  if (fail.length) { console.error("FAIL\n- " + fail.join("\n- ")); process.exit(1); }
  console.log("admin UI e2e passed (login, 15 sections, save, publish gate, unauthenticated action rejected)");
})();
