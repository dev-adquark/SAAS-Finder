// Stateless admin session: `${expiresAtMs}.${hmacSha256(expiresAtMs)}` keyed by ADMIN_API_KEY.
// Uses Web Crypto so it works in both the Node runtime and the proxy. The key itself is never
// placed in the cookie.

export const SESSION_COOKIE = "sf_admin";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const MIN_ADMIN_KEY_LENGTH = 16;

const enc = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function adminKey(): string | null {
  const key = process.env.ADMIN_API_KEY;
  return key && key.length >= MIN_ADMIN_KEY_LENGTH ? key : null;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${await hmac(secret, `admin-session:${expires}`)}`;
}

export async function verifySessionToken(token: string | undefined | null, secret: string | null, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !/^\d{10,16}$/.test(expires) || Number(expires) < now) return false;
  return safeEqual(sig, await hmac(secret, `admin-session:${expires}`));
}
