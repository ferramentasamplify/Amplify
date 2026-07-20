import { NextResponse } from "next/server";
import {
  INDIQUE_ADMIN_SESSION_COOKIE,
  INDIQUE_ADMIN_SESSION_TTL_MS,
  checkIndiqueAdminPassword,
  makeIndiqueAdminSessionValue,
} from "@/lib/indique-admin-auth";
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
    const username = normalizeIndicadorHandle(body.username || body.user || body.handle);
    const password = String(body.password || "");

    if (!username) {
      return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
    }

    if (username === "amplify") {
      const ok = checkIndiqueAdminPassword(password);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 400));
        return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
      }

      const res = NextResponse.json({ ok: true, role: "admin", next: "/indiqueeganhe" });
      res.cookies.set(INDIQUE_ADMIN_SESSION_COOKIE, makeIndiqueAdminSessionValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.floor(INDIQUE_ADMIN_SESSION_TTL_MS / 1000),
      });
      res.cookies.set(INDICADOR_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    if (!checkIndicadorPassword(password)) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const data = await fetchIndiqueData(req);
    const indicador = (data.leads || []).find((lead) => normalizeIndicadorHandle(lead.utm) === username);
    if (!indicador) {
      return NextResponse.json({ error: "Indicador não encontrado." }, { status: 404 });
    }

    const displayHandle = String(indicador.utm || username).trim();
    const res = NextResponse.json({
      ok: true,
      role: "indicador",
      next: "/indiqueeganhe/indicador",
      indicador: { handle: username, displayHandle },
    });
    res.cookies.set(INDICADOR_SESSION_COOKIE, makeIndicadorSessionValue(username), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(INDICADOR_SESSION_TTL_MS / 1000),
    });
    res.cookies.set(INDIQUE_ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
