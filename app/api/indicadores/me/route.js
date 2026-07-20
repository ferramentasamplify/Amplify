import { NextResponse } from "next/server";
import { readIndicadorSession } from "@/lib/indicador-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readIndicadorSession();
  return NextResponse.json({ indicador: session });
}
