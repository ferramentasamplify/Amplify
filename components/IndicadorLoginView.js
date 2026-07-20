"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function IndicadorLoginView() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawNext = sp.get("next") || "/indiqueeganhe/indicador";
  const isSuper = rawNext.startsWith("/superafiliado");

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/indicadores/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no login.");
      const next = rawNext.startsWith("/") && !rawNext.startsWith("/indiqueeganhe/indicador/login")
        ? rawNext
        : "/indiqueeganhe/indicador";
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  const accent = isSuper ? "#2F6BFF" : "#2563EB";
  const accentText = isSuper ? "text-[#7DB7FF]" : "text-[#2563EB]";
  const shellBg = isSuper
    ? "bg-[radial-gradient(circle_at_20%_10%,rgba(47,107,255,.38),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(36,214,199,.18),transparent_30%),linear-gradient(135deg,#06152f_0%,#071b3d_48%,#031026_100%)]"
    : "bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,.42),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(233,30,99,.22),transparent_28%),linear-gradient(135deg,#06163A_0%,#0A1F4C_45%,#1E3A8A_100%)]";

  return (
    <div className={`min-h-screen ${shellBg} text-white flex items-center justify-center px-4 py-10`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[12%] h-24 w-24 rounded-full border border-white/10" />
        <div className="absolute right-[12%] top-[22%] h-36 w-36 rounded-full border border-white/10" />
        <div className="absolute bottom-[16%] left-[18%] h-2 w-2 rounded-full bg-white/35 shadow-[0_0_34px_rgba(255,255,255,.55)]" />
        <div className="absolute bottom-[26%] right-[22%] h-1.5 w-1.5 rounded-full bg-[#E91E63]/70 shadow-[0_0_28px_rgba(233,30,99,.55)]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-fit items-center justify-center rounded-2xl border border-white/15 bg-white px-4 shadow-2xl">
            <Image
              src="/brand/amplify-ugc-logo.jpg"
              alt="Amplify UGC"
              width={738}
              height={178}
              priority
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase text-white/75 shadow-2xl">
            <span className="h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 18px ${accent}` }} />
            {isSuper ? "Super Afiliado" : "Indique e Ganhe"}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">{isSuper ? "Acesse seu painel de performance" : "Bem-vindo de volta"}</h1>
          <p className="text-sm text-white/70 mt-2">
            {isSuper ? "Entre com seu login para acompanhar indicações, GMV e comissão." : "Acesse seu painel de indicações e comissão."}
          </p>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white p-6 text-[#101828] shadow-[0_30px_90px_rgba(4,19,54,.38)]">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase text-slate-500">{isSuper ? "Seu login" : "@ TikTok"}</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder={isSuper ? "ex: amplify ou seu @" : "@tiktok"}
                autoFocus
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase text-slate-500">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !handle || !password}
              className="w-full rounded-2xl py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(37,99,235,.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              style={{ background: isSuper ? "linear-gradient(135deg,#2F6BFF,#24D6C7)" : "linear-gradient(135deg,#2563EB,#1D4ED8)" }}
            >
              {loading ? "Entrando..." : isSuper ? "Entrar no painel" : "Entrar"}
            </button>
          </form>
          {!isSuper && (
            <p className="mt-4 text-center text-xs text-slate-500">
              Primeiro acesso? Use seu @ TikTok cadastrado no programa.
            </p>
          )}
        </div>

        <p className={`mt-4 text-center text-[11px] ${accentText}/80`}>
          Sessão segura · expira em 8h.
        </p>
      </div>
    </div>
  );
}
