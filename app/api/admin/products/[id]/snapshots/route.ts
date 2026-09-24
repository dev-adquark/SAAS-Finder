import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
const types = new Set(["PRICING","FEATURE","GENERAL"]);
const validUrl = (value: unknown) => { if (value === null || value === undefined || value === "") return true; try { const u = new URL(String(value)); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };

export async function GET(req: Request,{params}:{params:Promise<{id:string}>}) { if (!requireAdmin(req)) return NextResponse.json({error:"Unauthorized"},{status:401}); return NextResponse.json(await db.pricingSnapshot.findMany({where:{productId:(await params).id},orderBy:{capturedAt:"desc"}})); }
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}) {
  if (!requireAdmin(req)) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const id=(await params).id; const b=await req.json(); const summary=typeof b.summary==="string"?b.summary.trim():"";
    if(!summary) return NextResponse.json({error:"summary is required"},{status:400});
    if(b.snapshotType!==undefined&&!types.has(String(b.snapshotType))) return NextResponse.json({error:"invalid snapshotType"},{status:400});
    if(!validUrl(b.sourceUrl)) return NextResponse.json({error:"sourceUrl must be a valid http(s) URL"},{status:400});
    const capturedAt=b.capturedAt?new Date(b.capturedAt):new Date();
    if(Number.isNaN(capturedAt.getTime())) return NextResponse.json({error:"invalid capturedAt"},{status:400});
    return NextResponse.json(await db.pricingSnapshot.create({data:{productId:id,summary,sourceUrl:b.sourceUrl?String(b.sourceUrl).trim():null,snapshotType:b.snapshotType??"PRICING",capturedAt}}),{status:201});
  } catch { return NextResponse.json({error:"Product not found or invalid snapshot payload"},{status:400}); }
}
