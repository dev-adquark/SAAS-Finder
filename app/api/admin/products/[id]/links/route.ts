import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
export async function GET(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;return NextResponse.json(await db.affiliateLink.findMany({where:{productId:id},orderBy:{createdAt:"desc"}}))}
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;const b=await req.json();if(!b.label||!b.url)return NextResponse.json({error:"label and url are required"},{status:400});return NextResponse.json(await db.affiliateLink.create({data:{productId:id,label:b.label,url:b.url,provider:b.provider??null,active:Boolean(b.active)}}),{status:201})}
