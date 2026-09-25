import { adminRoute, readJson } from "@/lib/admin/api";
import { InputError, read } from "@/lib/admin/inputs";
import { rejectSnapshot, retireSnapshot, verifySnapshot } from "@/lib/admin/services";

type P = { id: string };
export const PATCH = adminRoute<P>(async (req, { id }) => {
  const { action, verifiedBy } = read(await readJson(req)).oneOf("action", ["verify", "reject", "retire"] as const, { required: true }).str("verifiedBy", { max: 120, nullable: true }).done<{ action: "verify" | "reject" | "retire"; verifiedBy?: string | null }>();
  if (action === "verify") return verifySnapshot(id, verifiedBy ?? "api");
  if (action === "reject") return rejectSnapshot(id);
  if (action === "retire") return retireSnapshot(id);
  throw new InputError(["unknown action"]);
});
