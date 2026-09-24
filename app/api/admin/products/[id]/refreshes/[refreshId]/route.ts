import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; refreshId: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, refreshId } = await params;
  try {
    const body = await req.json();
    const refresh = await db.contentRefresh.findFirst({ where: { id: refreshId, productId: id } });
    if (!refresh) return NextResponse.json({ error: "Refresh task not found" }, { status: 404 });
    if (body.completed === false) {
      return NextResponse.json(await db.contentRefresh.update({ where: { id: refreshId }, data: { completedAt: null } }));
    }
    return NextResponse.json(await db.contentRefresh.update({ where: { id: refreshId }, data: { completedAt: new Date() } }));
  } catch {
    return NextResponse.json({ error: "Invalid refresh update" }, { status: 400 });
  }
}
