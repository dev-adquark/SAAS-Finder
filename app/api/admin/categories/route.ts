import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isNonEmptyString, slugify } from "@/lib/validation";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  }));
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!isNonEmptyString(body.name, 120)) return NextResponse.json({ error: "valid name is required" }, { status: 400 });
    const slug = slugify(body.slug ?? body.name);
    if (!slug || slug.length > 120) return NextResponse.json({ error: "valid slug is required" }, { status: 400 });
    if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "description must be a string" }, { status: 400 });
    }

    return NextResponse.json(await db.category.create({
      data: {
        name: body.name.trim(),
        slug,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
      },
    }), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Category already exists or payload is invalid" }, { status: 409 });
  }
}
