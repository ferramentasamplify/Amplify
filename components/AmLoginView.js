"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AmLoginView() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawNext = sp.get("next") || "/club/am";

  const [ams, setAms] = useState([]);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Lista os AMs públicos pra mostrar como cards selecionáveis
    fetch("/api/am/list")
      .then((r) => r.json())
      .then((d) => {
        setAms(d.ams || []);
        if (!slug && d.ams?.[0]) setSlug(d.ams[0].slug);
      })
      .catch(() => setError("Não consegui listar os AMs."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/am/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no login.");
      const fallbackPath = data.am?.isAdmin
        ? "/club/am/central"
        : `/club/am/${data.am?.slug || slug}`;
      const next = rawNext.startsWith("/") && !rawNext.startsWith("/club/am/login")
        ? rawNext
        : "/club/am";
      router.push(next === "/club/am" ? fallbackPath : next);
      router.refresh();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  const selectedAm = ams.find((a) => a.slug === slug);

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[#a855f7] mb-1">Amplify Club</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Acesso do Account Manager</h1>
          <p className="text-sm text-white/40 mt-2">Selecione seu perfil e entre com sua senha.</p>
        </div>

        <div className="bg-[#14161F] border border-white/10 rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-2 mb-5">
            {ams.map((a) => (
              <button
                key={a.slug}
                type="button"
                onClick={() => setSlug(a.slug)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  slug === a.slug
                    ? "border-2 scale-[1.02]"
                    : "border-white/10 hover:border-white/30"
                }`}
                style={{
                  borderColor: slug === a.slug ? a.accentColor : undefined,
                  background: slug === a.slug ? `${a.accentColor}10` : undefined,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden"
                  style={{
                    background: a.photo ? "transparent" : `${a.accentColor}30`,
                    color: a.accentColor,
                  }}
                >
                  {a.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo} alt={a.displayName} className="w-full h-full object-cover" />
                  ) : (
                    a.emoji || a.displayName[0]
                  )}
                </div>
                <div className="text-xs font-bold">{a.shortName}</div>
              </button>
            ))}
          </div>

          {selectedAm && (
            <div className="text-center mb-4">
              <p className="text-sm font-bold" style={{ color: selectedAm.accentColor }}>
                {selectedAm.displayName}
              </p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                {selectedAm.role}
              </p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              autoFocus
              className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#a855f7]"
            />
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                ⚠️ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !slug || !password}
              className="w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: selectedAm?.accentColor || "#a855f7" }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-white/30 mt-4">
          🔒 Sessão expira em 8h. Apenas AMs autorizados.
        </p>
      </div>
    </div>
  );
}
