import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const validUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;return NextResponse.json(await db.affiliateLink.findMany({where:{productId:id},orderBy:{createdAt:"desc"}}))}
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){if(!requireAdmin(req))return NextResponse.json({error:"Unauthorized"},{status:401});const {id}=await params;try{const b=await req.json();if(typeof b.label!=="string"||!b.label.trim()||!validUrl(b.url))return NextResponse.json({error:"label and a valid http(s) url are required"},{status:400});if(b.provider!==undefined&&b.provider!==null&&typeof b.provider!=="string")return NextResponse.json({error:"provider must be a string"},{status:400});if(b.active!==undefined&&typeof b.active!=="boolean")return NextResponse.json({error:"active must be boolean"},{status:400});return NextResponse.json(await db.affiliateLink.create({data:{productId:id,label:b.label.trim(),url:b.url.trim(),provider:typeof b.provider==="string"?b.provider.trim()||null:null,active:b.active===true}}),{status:201})}catch{return NextResponse.json({error:"Invalid affiliate link payload or product is invalid"},{status:400})}}
