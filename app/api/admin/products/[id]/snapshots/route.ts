import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
export async function GET(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;return NextResponse.json(await db.pricingSnapshot.findMany({where:{productId:id},orderBy:{capturedAt:"desc"}}))}
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;const b=await req.json();if(!b.summary)return NextResponse.json({error:"summary is required"},{status:400});return NextResponse.json(await db.pricingSnapshot.create({data:{productId:id,summary:b.summary,sourceUrl:b.sourceUrl??null,snapshotType:b.snapshotType??"PRICING",capturedAt:b.capturedAt?new Date(b.capturedAt):new Date()}}),{status:201})}
