import { adminRoute, readJson } from "@/lib/admin/api";
import { read } from "@/lib/admin/inputs";
import { reopenRefresh, resolveRefreshNoChange } from "@/lib/admin/services";

type P = { id: string; refreshId: string };
// { "completed": true, "note": "..." } → verified unchanged; { "completed": false } → reopen.
export const PATCH = adminRoute<P>(async (req, { id, refreshId }) => {
  const b = read(await readJson(req)).bool("completed").str("note", { max: 500, nullable: true }).done<{ completed?: boolean; note?: string | null }>();
  return b.completed === false ? reopenRefresh(refreshId, id) : resolveRefreshNoChange(refreshId, b.note ?? "", id);
});
