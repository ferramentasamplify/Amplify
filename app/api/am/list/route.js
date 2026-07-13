import { NextResponse } from "next/server";
import { ACCOUNT_MANAGERS, publicAmData } from "@/lib/am-config";

export const dynamic = "force-dynamic";

/** Lista pública dos AMs (sem hashes) — usada só na tela de login */
export async function GET() {
  return NextResponse.json({
    ams: ACCOUNT_MANAGERS.map(publicAmData),
  });
}