import { NextResponse } from "next/server";
import { listGamifications, listUpdatesForGamification } from "@/lib/gamifications";
export const dynamic = "force-dynamic";
export async function GET(_request,{params}){ try { const {id}=await params; const {items}=await listGamifications(); const item=items.find(g=>g.id===id||g.slug===id); if(!item) return NextResponse.json({success:false,error:"Gamificação não encontrada."},{status:404}); const updates=await listUpdatesForGamification(item.id); return NextResponse.json({success:true,item,updates,updatedAt:new Date().toISOString()}); } catch(error){ return NextResponse.json({success:false,error:error.message},{status:500}); } }
