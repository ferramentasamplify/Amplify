import { NextResponse } from "next/server";
import { AM_BY_SLUG, AM_SESSION_COOKIE, AM_SESSION_TTL_MS, publicAmData } from "@/lib/am-config";
import { checkAmPassword, makeSessionValue } from "@/lib/am-auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, password } = body;
    if (!slug) {
      return NextResponse.json({ error: "Informe o slug." }, { status: 400 });
    }
    const am = AM_BY_SLUG[slug];
    if (!am) {
      return NextResponse.json({ error: "AM não encontrado." }, { status: 404 });
    }
    const ok = await checkAmPassword(slug, password);
    if (!ok) {
      // Pequeno delay pra evitar brute force óbvio
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, am: publicAmData(am) });
    res.cookies.set(AM_SESSION_COOKIE, makeSessionValue(slug), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(AM_SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
