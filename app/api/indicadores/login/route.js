import { NextResponse } from "next/server";
import {
  INDICADOR_SESSION_COOKIE,
  INDICADOR_SESSION_TTL_MS,
  checkIndicadorPassword,
  makeIndicadorSessionValue,
  normalizeIndicadorHandle,
} from "@/lib/indicador-auth";

export const dynamic = "force-dynamic";

async function fetchIndiqueData(req) {
  const internalOrigin = process.env.AMPLIFY_HUB_INTERNAL_URL || req.nextUrl.origin;
  const url = new URL("/api/indiqueeganhe-full", internalOrigin);
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Erro ao carregar indicadores.");
  return data;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const handle = normalizeIndicadorHandle(body.handle);
    const password = String(body.password || "");

    if (!handle) return NextResponse.json({ error: "Informe seu @ TikTok." }, { status: 400 });
    if (!checkIndicadorPassword(password)) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    let displayHandle = handle;
    if (handle !== 'amplify') {
    const data = await fetchIndiqueData(req);
      const indicador = (data.leads || []).find((lead) => normalizeIndicadorHandle(lead.utm) === handle);
      if (!indicador) {
        return NextResponse.json({ error: "Indicador não encontrado." }, { status: 404 });
      }
      displayHandle = String(indicador.utm || handle).trim();
    }
    const res = NextResponse.json({ ok: true, indicador: { handle, displayHandle } });
    res.cookies.set(INDICADOR_SESSION_COOKIE, makeIndicadorSessionValue(handle), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(INDICADOR_SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
