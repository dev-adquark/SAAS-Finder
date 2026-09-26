"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin/guard";
import { adminKey, createSessionToken, safeEqual, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/admin/session";
import { storedComparisonKeys } from "@/lib/content/comparison-schema";
import { ensureRefreshTasks } from "@/lib/freshness";
import {
  formToObject, InputError, parseAlternative, parseCategory, parseChangelog, parseFaq, parseLink, parsePair, parseProduct, parseRefresh,
  parseSnapshot, parseSponsor, parseUseCase, parseUseCaseProduct, read, parseSource, parseFact, parseRelationship,
} from "@/lib/admin/inputs";
import * as svc from "@/lib/admin/services";
import { advanceSyncs, startSync, SyncError } from "@/lib/sync/run";
import { acceptChange, keepExisting, rejectChange, revertChange } from "@/lib/sync/review";
import { advanceInBackground } from "@/lib/sync/schedule";

const BACK = /^\/admin(?:\/[A-Za-z0-9_-]+)*$/;

function backTo(fd: FormData, fallback: string) {
  const b = String(fd.get("back") ?? "");
  return BACK.test(b) ? b : fallback;
}

function message(e: unknown) {
  if (e instanceof InputError) return e.problems.join("; ");
  if (e instanceof svc.NotFoundError) return e.message || "Not found";
  if (e instanceof SyncError) return e.message;
  if (e instanceof Error && e.message === "Unauthorized") return "Your session expired. Sign in again.";
  console.error("[admin-action]", e instanceof Error ? e.name : "error");
  return "Save failed. Please try again.";
}

/** Runs a mutation and redirects back with a flash message. `redirect` is called outside try/catch. */
async function perform(back: string, ok: string, fn: () => Promise<unknown>, next?: (result: unknown) => string | null) {
  await assertAdmin();
  let target = back;
  let flash: string;
  try {
    const result = await fn();
    target = next?.(result) ?? back;
    flash = `ok=${encodeURIComponent(ok)}`;
  } catch (e) {
    flash = `error=${encodeURIComponent(message(e))}`;
  }
  redirect(`${target}?${flash}`);
}

const need = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new InputError([`missing ${key}`]);
  return v;
};
const confirmed = (fd: FormData) => {
  if (fd.get("confirm") !== "on") throw new InputError(["Tick the confirmation box to delete"]);
};

// ---------- Session ----------

export async function login(fd: FormData) {
  const key = adminKey();
  const password = String(fd.get("password") ?? "");
  if (!key || !password || !safeEqual(password, key)) {
    // Slow down guessing; serverless instances make in-memory lockouts unreliable.
    await new Promise((r) => setTimeout(r, 800));
    redirect("/admin/login?error=" + encodeURIComponent(key ? "Invalid credentials" : "Admin access is not configured (ADMIN_API_KEY must be at least 16 characters)"));
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(key), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_TTL_MS / 1000 });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- Products ----------

function productForm(fd: FormData) {
  const o = formToObject(fd);
  const category = typeof o.categorySlugForSchema === "string" ? o.categorySlugForSchema : "";
  const comparison: Record<string, string> = {};
  for (const key of storedComparisonKeys(category)) comparison[key] = String(o[`cmp_${key}`] ?? "");
  const extra = String(o.comparisonExtra ?? "");
  return { ...o, comparison: extra.trim() ? `${Object.entries(comparison).map(([k, v]) => `${k}: ${v}`).join("\n")}\n${extra}` : comparison };
}

export async function createProductAction(fd: FormData) {
  await perform("/admin/products/new", "Product created as draft", () => svc.createProduct(parseProduct(formToObject(fd), true)), (p) => `/admin/products/${(p as { id: string }).id}`);
}

export async function updateProductAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Product saved", () => svc.updateProduct(id, parseProduct(productForm(fd), false)));
}

export async function setProductStatusAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Status updated", () => svc.updateProduct(id, parseProduct({ status: fd.get("status") }, false)));
}

export async function deleteProductAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Product deleted", async () => (confirmed(fd), svc.deleteProduct(id)), () => "/admin/products");
}

// ---------- FAQs ----------

export async function addFaqAction(fd: FormData) {
  const owner = String(fd.get("ownerType"));
  const ownerId = need(fd, "ownerId");
  const key = owner === "category" ? "categoryId" : owner === "useCase" ? "useCaseId" : "productId";
  await perform(backTo(fd, "/admin"), "FAQ added", () => svc.addFaq({ [key]: ownerId } as svc.FaqOwner, parseFaq(formToObject(fd))));
}

export async function updateFaqAction(fd: FormData) {
  await perform(backTo(fd, "/admin"), "FAQ saved", () => svc.updateFaq(need(fd, "faqId"), parseFaq(formToObject(fd))));
}

export async function deleteFaqAction(fd: FormData) {
  await perform(backTo(fd, "/admin"), "FAQ deleted", async () => (confirmed(fd), svc.deleteFaq(need(fd, "faqId"))));
}

// ---------- Pricing ----------

export async function addSnapshotAction(fd: FormData) {
  const id = need(fd, "id");
  const verify = fd.get("verify") === "on";
  await perform(backTo(fd, `/admin/products/${id}`), verify ? "Pricing recorded and verified" : "Pricing snapshot queued for review", () => svc.addSnapshot(id, parseSnapshot(formToObject(fd)), { verify, by: "admin" }));
}

export async function reviewSnapshotAction(fd: FormData) {
  const id = need(fd, "snapshotId");
  const decision = String(fd.get("decision"));
  await perform(backTo(fd, "/admin/pricing"), `Snapshot ${decision === "verify" ? "verified" : decision === "retire" ? "retired" : "rejected"}`, () =>
    decision === "verify" ? svc.verifySnapshot(id, "admin") : decision === "retire" ? svc.retireSnapshot(id) : svc.rejectSnapshot(id),
  );
}

// ---------- Refreshes ----------

export async function resolveRefreshAction(fd: FormData) {
  const note = read(formToObject(fd)).str("note", { max: 500, nullable: true }).done<{ note?: string | null }>().note ?? "";
  await perform(backTo(fd, "/admin/refreshes"), "Marked as checked — no change", () => svc.resolveRefreshNoChange(need(fd, "refreshId"), note));
}

export async function reopenRefreshAction(fd: FormData) {
  await perform(backTo(fd, "/admin/refreshes"), "Refresh reopened", () => svc.reopenRefresh(need(fd, "refreshId")));
}

export async function addRefreshAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(backTo(fd, `/admin/products/${id}`), "Refresh scheduled", () => svc.addRefresh(id, parseRefresh(formToObject(fd))));
}

export async function runRefreshQueueAction() {
  await perform("/admin/refreshes", "Freshness queue updated", () => ensureRefreshTasks());
}

export async function addChangelogAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Change-log entry added", () => svc.addChangelog(id, parseChangelog(formToObject(fd))));
}

// ---------- Affiliate links ----------

export async function addLinkAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(backTo(fd, `/admin/products/${id}`), "Affiliate link saved", () => svc.addLink(id, parseLink({ ...formToObject(fd), active: fd.get("active") === "on" }, true)));
}

export async function toggleLinkAction(fd: FormData) {
  await perform(backTo(fd, "/admin/affiliates"), "Affiliate link updated", () => svc.updateLink(need(fd, "linkId"), parseLink({ active: fd.get("active") === "true" }, false)));
}

export async function deleteLinkAction(fd: FormData) {
  await perform(backTo(fd, "/admin/affiliates"), "Affiliate link deleted", async () => (confirmed(fd), svc.deleteLink(need(fd, "linkId"))));
}

// ---------- Alternatives ----------

export async function addAlternativeAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(backTo(fd, `/admin/products/${id}`), "Alternative added", () => svc.addAlternative(id, parseAlternative(formToObject(fd), true)));
}

export async function updateAlternativeAction(fd: FormData) {
  await perform(backTo(fd, "/admin/alternatives"), "Alternative saved", () => svc.updateAlternative(need(fd, "altId"), parseAlternative({ ...formToObject(fd), active: fd.get("active") === "on" }, false)));
}

export async function deleteAlternativeAction(fd: FormData) {
  await perform(backTo(fd, "/admin/alternatives"), "Alternative removed", async () => (confirmed(fd), svc.deleteAlternative(need(fd, "altId"))));
}

// ---------- Categories ----------

export async function createCategoryAction(fd: FormData) {
  const o = formToObject(fd);
  await perform("/admin/categories", "Category created", () => svc.createCategory(parseCategory({ ...o, slug: o.slug || o.name }, true)));
}

export async function updateCategoryAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/categories/${id}`, "Category saved", () => svc.updateCategory(id, parseCategory(formToObject(fd), false)));
}

export async function deleteCategoryAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/categories/${id}`, "Category deleted", async () => (confirmed(fd), svc.deleteCategory(id)), () => "/admin/categories");
}

// ---------- Comparisons ----------

export async function createPairAction(fd: FormData) {
  await perform("/admin/comparisons", "Comparison created", () => svc.createPair(parsePair(formToObject(fd), true)));
}

export async function updatePairAction(fd: FormData) {
  await perform("/admin/comparisons", "Comparison saved", () => svc.updatePair(need(fd, "pairId"), parsePair({ ...formToObject(fd), active: fd.get("active") === "on" }, false)));
}

export async function deletePairAction(fd: FormData) {
  await perform("/admin/comparisons", "Comparison deleted", async () => (confirmed(fd), svc.deletePair(need(fd, "pairId"))));
}

// ---------- Use cases ----------

export async function createUseCaseAction(fd: FormData) {
  await perform("/admin/use-cases", "Use case created as draft", () => svc.createUseCase(parseUseCase(formToObject(fd), true)), (u) => `/admin/use-cases/${(u as { id: string }).id}`);
}

export async function updateUseCaseAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/use-cases/${id}`, "Use case saved", () => svc.updateUseCase(id, parseUseCase(formToObject(fd), false)));
}

export async function deleteUseCaseAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/use-cases/${id}`, "Use case deleted", async () => (confirmed(fd), svc.deleteUseCase(id)), () => "/admin/use-cases");
}

export async function addUseCaseProductAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/use-cases/${id}`, "Pick added", () => svc.addUseCaseProduct(id, parseUseCaseProduct(formToObject(fd), true)));
}

export async function updateUseCaseProductAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/use-cases/${id}`, "Pick saved", () => svc.updateUseCaseProduct(need(fd, "rowId"), parseUseCaseProduct({ ...formToObject(fd), active: fd.get("active") === "on" }, false)));
}

export async function deleteUseCaseProductAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/use-cases/${id}`, "Pick removed", async () => (confirmed(fd), svc.deleteUseCaseProduct(need(fd, "rowId"))));
}

// ---------- Sponsors ----------

export async function createSponsorAction(fd: FormData) {
  await perform("/admin/sponsors", "Sponsor slot created", () => svc.createSponsor(parseSponsor({ ...formToObject(fd), active: fd.get("active") === "on" }, true)));
}

export async function updateSponsorAction(fd: FormData) {
  await perform("/admin/sponsors", "Sponsor slot saved", () => svc.updateSponsor(need(fd, "sponsorId"), parseSponsor({ ...formToObject(fd), active: fd.get("active") === "on" }, false)));
}

export async function deleteSponsorAction(fd: FormData) {
  await perform("/admin/sponsors", "Sponsor slot deleted", async () => (confirmed(fd), svc.deleteSponsor(need(fd, "sponsorId"))));
}

// ---------- Maintenance ----------

export async function revalidateAllAction() {
  await perform("/admin", "All public pages revalidated", async () => svc.revalidateSite());
}


// ---------- Sources & facts ----------

export async function addSourceAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Source added", () => svc.addSource(id, parseSource(formToObject(fd), true)));
}

export async function updateSourceAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Source saved", () => svc.updateSource(need(fd, "sourceId"), parseSource(formToObject(fd), false)));
}

export async function verifySourceAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Source verified", () => svc.verifySource(need(fd, "sourceId")));
}

export async function deleteSourceAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Source deleted", async () => (confirmed(fd), svc.deleteSource(need(fd, "sourceId"))));
}

export async function upsertFactAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Fact saved", () => svc.upsertFact(id, parseFact(formToObject(fd))));
}

export async function deleteFactAction(fd: FormData) {
  const id = need(fd, "id");
  await perform(`/admin/products/${id}`, "Fact deleted", async () => (confirmed(fd), svc.deleteFact(need(fd, "factId"))));
}

// ---------- Brand relationships ----------

export async function createRelationshipAction(fd: FormData) {
  await perform("/admin/relationships", "Relationship recorded", () => svc.createRelationship(parseRelationship(formToObject(fd), true)));
}

export async function updateRelationshipAction(fd: FormData) {
  await perform("/admin/relationships", "Relationship saved", () => svc.updateRelationship(need(fd, "relId"), parseRelationship(formToObject(fd), false)));
}

export async function deleteRelationshipAction(fd: FormData) {
  await perform("/admin/relationships", "Relationship deleted", async () => (confirmed(fd), svc.deleteRelationship(need(fd, "relId"))));
}

// ---------- Automated research sync ----------

const SYNC_BACK = "/admin/sync";
const note = (fd: FormData) => read(formToObject(fd)).str("note", { max: 500, nullable: true }).done<{ note?: string | null }>().note ?? null;

export async function startFullSyncAction() {
  await perform(SYNC_BACK, "Full sync started — official pages are being fetched", async () => {
    await startSync({ trigger: "MANUAL_FULL" });
  });
}

export async function startProductSyncAction(fd: FormData) {
  const id = need(fd, "productId");
  await perform(backTo(fd, SYNC_BACK), "Product sync started", async () => {
    await startSync({ trigger: "MANUAL_PRODUCT", productId: id });
  });
}

/** Checks the crawl and processes finished results for one time budget; continues in the background. */
export async function advanceSyncAction() {
  await perform(SYNC_BACK, "Sync progress updated", async () => {
    const r = await advanceSyncs({ budgetMs: 25_000 });
    if (r.more) advanceInBackground();
  });
}

export async function acceptChangeAction(fd: FormData) {
  const period = String(fd.get("billingPeriod") ?? "") || null;
  await perform(backTo(fd, SYNC_BACK), "Change accepted and published", () => acceptChange(need(fd, "changeId"), { by: "admin", note: note(fd), billingPeriod: period }));
}

export async function rejectChangeAction(fd: FormData) {
  await perform(backTo(fd, SYNC_BACK), "Change rejected", () => rejectChange(need(fd, "changeId"), { by: "admin", note: note(fd) }));
}

export async function keepChangeAction(fd: FormData) {
  await perform(backTo(fd, SYNC_BACK), "Existing value kept", () => keepExisting(need(fd, "changeId"), { by: "admin", note: note(fd) }));
}

export async function revertChangeAction(fd: FormData) {
  await perform(backTo(fd, SYNC_BACK), "Change reverted to the previous value", async () => (confirmed(fd), revertChange(need(fd, "changeId"), { by: "admin" })));
}
