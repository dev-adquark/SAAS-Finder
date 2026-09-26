// Editorial decisions on automated detections. Accepting applies the change through the same rules
// as manual edits (prices go through verifySnapshot); every accepted change records its prior state so
// it can be reverted. Rejected / kept proposals stay decided and are never re-proposed.
import type { BillingPeriod, DataChange, Prisma, SourceKind, SourceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { InputError } from "@/lib/admin/inputs";
import { NotFoundError, revalidateSite, retireSnapshot, verifySnapshot } from "@/lib/admin/services";
import { isOfficialUrl, officialDomains } from "@/lib/research/evidence";

const PERIODS: BillingPeriod[] = ["FREE", "MONTHLY", "ANNUAL", "ONE_TIME", "USAGE", "CUSTOM"];
const KINDS: SourceKind[] = ["PRICING", "PRODUCT", "DOCUMENTATION", "HELP_CENTER", "SECURITY", "CHANGELOG", "NEWSROOM", "ABOUT", "CONTACT", "INTEGRATIONS", "STATUS", "PRIVACY", "TERMS"];

type Payload = Record<string, unknown>;
const pl = (c: DataChange) => (c.payload ?? {}) as Payload;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

async function pending(id: string) {
  const c = await db.dataChange.findUnique({ where: { id }, include: { product: { select: { slug: true, officialUrl: true } } } });
  if (!c) throw new NotFoundError("Change not found");
  if (c.status !== "PENDING") throw new InputError([`This change is already ${c.status.toLowerCase()}`]);
  return c;
}

async function decide(id: string, status: "ACCEPTED" | "REJECTED" | "KEPT", by: string, note: string | null, applied?: Payload) {
  const r = await db.dataChange.updateMany({ where: { id, status: "PENDING" }, data: { status, reviewedAt: new Date(), reviewedBy: by, note, ...(applied ? { applied: applied as Prisma.InputJsonValue } : {}) } });
  if (!r.count) throw new InputError(["This change was already decided"]);
}

/** Accepts a detection. `billingPeriod` must be confirmed by the editor for new plans. */
export async function acceptChange(id: string, opts: { by?: string; note?: string | null; billingPeriod?: string | null } = {}) {
  const c = await pending(id);
  const by = opts.by ?? "admin";
  const note = opts.note ?? null;
  const p = pl(c);
  const domains = officialDomains(c.product.slug, c.product.officialUrl);
  let applied: Payload = {};

  switch (c.kind) {
    case "PRICE_CHANGED":
    case "NEW_PLAN": {
      const period = (opts.billingPeriod || s(p.billingPeriod)) as BillingPeriod | null;
      if (!period || !PERIODS.includes(period)) throw new InputError(["Confirm the billing period before accepting this price"]);
      const price = typeof p.price === "number" && Number.isFinite(p.price) ? p.price : null;
      const currency = s(p.currency);
      const sourceUrl = s(p.sourceUrl);
      if (price === null || !currency || !/^[A-Z]{3}$/.test(currency)) throw new InputError(["The detected price is incomplete"]);
      if (!sourceUrl || !isOfficialUrl(sourceUrl, domains)) throw new InputError(["The detected price is not from an official vendor page"]);
      if (!c.evidence) throw new InputError(["The detected price has no supporting quote"]);
      const plan = s(p.plan);
      const superseded = await db.pricingSnapshot.findMany({ where: { productId: c.productId, status: "VERIFIED", snapshotType: "PRICING", billingPeriod: period, plan: plan === null ? null : { equals: plan, mode: "insensitive" } }, select: { id: true } });
      const snap = await db.pricingSnapshot.create({
        data: {
          productId: c.productId, snapshotType: "PRICING", plan, price, currency, billingPeriod: period, unit: s(p.unit), perSeat: p.perSeat === true, sourceUrl,
          sourceType: "AUTOMATED_DETECTION", status: "PENDING", evidence: c.evidence.slice(0, 2000), summary: `Detected by the weekly official-source sync; approved by ${by}.${note ? ` ${note}` : ""}`.slice(0, 2000),
        },
      });
      try {
        await verifySnapshot(snap.id, by);
      } catch (e) {
        await db.pricingSnapshot.delete({ where: { id: snap.id } }).catch(() => {});
        throw e;
      }
      applied = { snapshotId: snap.id, supersededIds: superseded.map((x) => x.id) };
      break;
    }
    case "PLAN_NOT_FOUND": {
      if (!c.targetId) throw new InputError(["No price is linked to this change"]);
      await retireSnapshot(c.targetId);
      applied = { retiredSnapshotId: c.targetId };
      break;
    }
    case "FACT_NOT_FOUND":
    case "FACT_CHANGED": {
      const f = c.targetId ? await db.productFact.findUnique({ where: { id: c.targetId } }) : null;
      if (!f) throw new NotFoundError("Fact not found");
      const before = { value: f.value, evidence: f.evidence, sourceId: f.sourceId, status: f.status, checkedAt: f.checkedAt?.toISOString() ?? null };
      if (c.kind === "FACT_NOT_FOUND") {
        // The editor agrees the claim is no longer supported: it reverts to "Not verified" publicly.
        await db.productFact.update({ where: { id: f.id }, data: { status: "NEEDS_VERIFICATION" } });
      } else {
        const value = s(p.value);
        const sourceUrl = s(p.sourceUrl);
        if (!value || !c.evidence || !sourceUrl || !isOfficialUrl(sourceUrl, domains)) throw new InputError(["The detected value is incomplete or not from an official page"]);
        const source = await db.productSource.findUnique({ where: { productId_url: { productId: c.productId, url: sourceUrl } } });
        await db.productFact.update({ where: { id: f.id }, data: { value: value.slice(0, 300), evidence: c.evidence.slice(0, 300), sourceId: source?.id ?? f.sourceId, status: "VERIFIED", checkedAt: new Date() } });
      }
      applied = { factId: f.id, before };
      break;
    }
    case "NEW_SOURCE": {
      const url = s(p.url);
      const kind = s(p.kind) as SourceKind | null;
      if (!url || !isOfficialUrl(url, domains) || !kind || !KINDS.includes(kind)) throw new InputError(["The discovered link is not a valid official page"]);
      const existing = await db.productSource.findUnique({ where: { productId_url: { productId: c.productId, url } } });
      const name = (s(p.name) ?? kind).slice(0, 120);
      const src = existing
        ? await db.productSource.update({ where: { id: existing.id }, data: { status: "VERIFIED", checkedAt: new Date() } })
        : await db.productSource.create({ data: { productId: c.productId, url, kind, name, status: "VERIFIED", checkedAt: new Date(), notes: "Discovered on the official site by the weekly sync; approved by an editor." } });
      applied = { sourceId: src.id, created: !existing, before: existing ? { status: existing.status, checkedAt: existing.checkedAt?.toISOString() ?? null } : null };
      break;
    }
    case "SOURCE_NOT_FOUND": {
      const src = c.targetId ? await db.productSource.findUnique({ where: { id: c.targetId } }) : null;
      if (!src) throw new NotFoundError("Source not found");
      await db.productSource.update({ where: { id: src.id }, data: { status: "BROKEN" } });
      applied = { sourceId: src.id, before: { status: src.status } };
      break;
    }
    case "SOURCE_UPDATED":
      // Informational: the editor has reviewed the new announcement/changelog content.
      applied = { reviewed: true };
      break;
  }
  await decide(id, "ACCEPTED", by, note, applied);
  if (c.kind !== "PRICE_CHANGED" && c.kind !== "NEW_PLAN" && c.kind !== "SOURCE_UPDATED") {
    await db.changeLog.create({ data: { productId: c.productId, version: `sync-${new Date().toISOString().slice(0, 10)}`, summary: `${c.field}: ${c.newValue ?? "updated"} (official source re-checked).`.slice(0, 2000) } });
  }
  revalidateSite();
}

export async function rejectChange(id: string, opts: { by?: string; note?: string | null } = {}) {
  await pending(id);
  await decide(id, "REJECTED", opts.by ?? "admin", opts.note ?? null);
}

/** Keep the existing value: the proposal is closed and not proposed again. */
export async function keepExisting(id: string, opts: { by?: string; note?: string | null } = {}) {
  await pending(id);
  await decide(id, "KEPT", opts.by ?? "admin", opts.note ?? null);
}

/** Rolls back an accepted change to the exact prior state recorded when it was applied. */
export async function revertChange(id: string, opts: { by?: string } = {}) {
  const c = await db.dataChange.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Change not found");
  if (c.status !== "ACCEPTED") throw new InputError(["Only accepted changes can be reverted"]);
  const a = (c.applied ?? {}) as Payload;
  await db.$transaction(async (tx) => {
    if (typeof a.snapshotId === "string") {
      await tx.pricingSnapshot.updateMany({ where: { id: a.snapshotId, status: "VERIFIED" }, data: { status: "SUPERSEDED" } });
      const ids = Array.isArray(a.supersededIds) ? a.supersededIds.filter((x): x is string => typeof x === "string") : [];
      if (ids.length) await tx.pricingSnapshot.updateMany({ where: { id: { in: ids }, status: "SUPERSEDED" }, data: { status: "VERIFIED" } });
    }
    if (typeof a.retiredSnapshotId === "string") await tx.pricingSnapshot.updateMany({ where: { id: a.retiredSnapshotId, status: "SUPERSEDED" }, data: { status: "VERIFIED" } });
    if (typeof a.factId === "string" && a.before && typeof a.before === "object") {
      const b = a.before as Payload;
      await tx.productFact.update({ where: { id: a.factId }, data: { value: String(b.value), evidence: s(b.evidence), sourceId: s(b.sourceId), status: b.status as SourceStatus, checkedAt: s(b.checkedAt) ? new Date(String(b.checkedAt)) : null } });
    }
    if (typeof a.sourceId === "string") {
      if (a.created === true) {
        const used = await tx.productFact.count({ where: { sourceId: a.sourceId } });
        if (used) await tx.productSource.update({ where: { id: a.sourceId }, data: { status: "NEEDS_VERIFICATION" } });
        else await tx.productSource.delete({ where: { id: a.sourceId } });
      } else if (a.before && typeof a.before === "object") {
        const b = a.before as Payload;
        await tx.productSource.update({ where: { id: a.sourceId }, data: { status: b.status as SourceStatus, ...(b.checkedAt !== undefined ? { checkedAt: s(b.checkedAt) ? new Date(String(b.checkedAt)) : null } : {}) } });
      }
    }
    await tx.dataChange.update({ where: { id }, data: { status: "REVERTED", reviewedAt: new Date(), reviewedBy: opts.by ?? "admin", note: `${c.note ? `${c.note} · ` : ""}Reverted` } });
    await tx.changeLog.create({ data: { productId: c.productId, version: `sync-revert-${new Date().toISOString().slice(0, 10)}`, summary: `Reverted: ${c.field} — restored the previous value.`.slice(0, 2000) } });
  });
  revalidateSite();
}
