import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const slugify = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const category = await db.category.findUnique({ where: { id } });
  return category ? NextResponse.json(category) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = slugify(body.slug ?? body.name);
    if (!name || !slug) return NextResponse.json({ error: "name and a valid slug are required" }, { status: 400 });
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "description must be a string" }, { status: 400 });
    }
    return NextResponse.json(await db.category.update({
      where: { id },
      data: { name, slug, description: body.description === null ? null : body.description?.trim() ?? null },
    }));
  } catch {
    return NextResponse.json({ error: "Category not found or slug already exists" }, { status: 409 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Category cannot be deleted while products reference it" }, { status: 409 });
  }
}
