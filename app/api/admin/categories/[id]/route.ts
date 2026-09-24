import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonEmptyString, slugify } from "@/lib/validation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const category = await db.category.findUnique({ where: { id: (await params).id } });
  return category ? NextResponse.json(category) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    if (!isNonEmptyString(body.name, 120)) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const slug = slugify(body.slug ?? body.name);
    if (!slug || slug.length > 120) return NextResponse.json({ error: "valid slug is required" }, { status: 400 });
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "description must be a string" }, { status: 400 });
    }

    return NextResponse.json(await db.category.update({
      where: { id },
      data: {
        name: body.name.trim(),
        slug,
        description: body.description === null ? null : typeof body.description === "string" ? body.description.trim() || null : undefined,
      },
    }));
  } catch {
    return NextResponse.json({ error: "Category not found or slug already exists" }, { status: 409 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await db.category.delete({ where: { id: (await params).id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Category cannot be deleted while products reference it" }, { status: 409 });
  }
}
