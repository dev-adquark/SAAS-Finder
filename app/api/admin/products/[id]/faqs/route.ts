import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
export async function GET(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;return NextResponse.json(await db.faq.findMany({where:{productId:id},orderBy:{sortOrder:"asc"}}))}
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;const b=await req.json();if(!b.question||!b.answer)return NextResponse.json({error:"question and answer are required"},{status:400});return NextResponse.json(await db.faq.create({data:{productId:id,question:b.question,answer:b.answer,sortOrder:b.sortOrder??0}}),{status:201})}
