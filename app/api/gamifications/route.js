import { NextResponse } from "next/server";
import { listGamifications } from "@/lib/gamifications";
export const dynamic = "force-dynamic";
export async function GET(){ try { const payload=await listGamifications(); return NextResponse.json({success:true,...payload}); } catch(error){ return NextResponse.json({success:false,error:error.message},{status:500}); } }
