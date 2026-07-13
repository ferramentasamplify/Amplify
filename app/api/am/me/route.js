import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { publicAmData } from "@/lib/am-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ am: null });
  return NextResponse.json({ am: publicAmData(s.am) });
}