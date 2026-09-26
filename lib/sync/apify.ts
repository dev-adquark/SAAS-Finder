// Minimal Apify REST client (server-side only). The token is read from APIFY_API_TOKEN, sent only in
// the Authorization header, and never logged, returned or embedded in URLs.

const API = "https://api.apify.com/v2";
export const DEFAULT_ACTOR = "apify~playwright-scraper";

export class ApifyError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message);
    this.name = "ApifyError";
  }
}

export const apifyConfigured = () => Boolean(process.env.APIFY_API_TOKEN?.trim());
export const apifyActor = () => (process.env.APIFY_ACTOR_ID?.trim() || DEFAULT_ACTOR).replace("/", "~");
/** Overridable for tests (mock server); production always uses the public API. */
const base = () => process.env.APIFY_API_BASE?.replace(/\/+$/, "") || API;

function token(): string {
  const t = process.env.APIFY_API_TOKEN?.trim();
  if (!t) throw new ApifyError("APIFY_API_TOKEN is not configured");
  return t;
}

/** Strips anything token-like from text that may end up in logs or the database. */
export function scrub(text: string): string {
  const t = process.env.APIFY_API_TOKEN?.trim();
  let out = t ? text.split(t).join("[redacted]") : text;
  out = out.replace(/apify_api_[A-Za-z0-9]{10,}/g, "[redacted]").replace(/([?&]token=)[^&\s]+/gi, "$1[redacted]");
  return out.slice(0, 500);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Opts = { method?: string; body?: unknown; timeoutMs?: number; retries?: number };

async function call<T>(path: string, { method = "GET", body, timeoutMs = 20_000, retries = 3 }: Opts = {}): Promise<T> {
  let lastError: ApifyError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base() + path, {
        method,
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${token()}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      const text = await res.text().catch(() => "");
      let msg = `Apify API ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: { message?: string } };
        if (j.error?.message) msg += `: ${j.error.message}`;
      } catch {
        // Non-JSON error body: status code is enough.
      }
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new ApifyError(scrub(msg), res.status, retryable);
      if (!retryable || attempt === retries) throw lastError;
      // Honour Retry-After (seconds) on rate limits, otherwise exponential backoff.
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** attempt);
    } catch (e) {
      if (e instanceof ApifyError && !e.retryable) throw e;
      lastError = e instanceof ApifyError ? e : new ApifyError(scrub(e instanceof Error && e.name === "AbortError" ? `Apify API timed out after ${timeoutMs} ms` : `Apify API request failed: ${e instanceof Error ? e.message : "network error"}`), undefined, true);
      if (attempt === retries) throw lastError;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new ApifyError("Apify API request failed");
}

export type ApifyRun = { id: string; status: string; defaultDatasetId: string; startedAt?: string; finishedAt?: string | null };
export const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

export type Webhook = { requestUrl: string; secret: string };

/** Starts an actor run asynchronously; returns immediately with the run id and dataset id. */
export async function startActorRun(input: unknown, opts: { timeoutSecs: number; memoryMbytes: number; webhook?: Webhook }): Promise<ApifyRun> {
  const q = new URLSearchParams({ timeout: String(opts.timeoutSecs), memory: String(opts.memoryMbytes) });
  if (opts.webhook) {
    const hooks = [{
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
      requestUrl: opts.webhook.requestUrl,
      headersTemplate: JSON.stringify({ "x-sync-signature": opts.webhook.secret }),
      payloadTemplate: '{"runId": {{resource.id}}, "status": {{resource.status}}}',
    }];
    q.set("webhooks", Buffer.from(JSON.stringify(hooks)).toString("base64"));
  }
  // Starting a run is not idempotent: never retry it blindly (a timeout may still have started one).
  const r = await call<{ data: ApifyRun }>(`/acts/${encodeURIComponent(apifyActor())}/runs?${q}`, { method: "POST", body: input, retries: 0, timeoutMs: 30_000 });
  return r.data;
}

export async function getRun(runId: string): Promise<ApifyRun> {
  return (await call<{ data: ApifyRun }>(`/actor-runs/${encodeURIComponent(runId)}`)).data;
}

export async function abortRun(runId: string): Promise<void> {
  await call(`/actor-runs/${encodeURIComponent(runId)}/abort`, { method: "POST", retries: 1 });
}

/** One page of dataset items (the actor's results). */
export async function datasetItems(datasetId: string, offset: number, limit: number): Promise<unknown[]> {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit), clean: "true", format: "json" });
  const r = await call<unknown>(`/datasets/${encodeURIComponent(datasetId)}/items?${q}`, { timeoutMs: 45_000 });
  return Array.isArray(r) ? r : [];
}
