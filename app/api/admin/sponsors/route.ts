import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
export async function GET(req: Request){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json(await db.sponsorSlot.findMany({orderBy:{createdAt:"desc"}}))}
export async function POST(req: Request){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();if(!b.name)return NextResponse.json({error:"name is required"},{status:400});return NextResponse.json(await db.sponsorSlot.create({data:{name:b.name,label:b.label??"Sponsored",placement:b.placement??"default",active:Boolean(b.active),url:b.url??null,startsAt:b.startsAt?new Date(b.startsAt):null,endsAt:b.endsAt?new Date(b.endsAt):null}}),{status:201})}
