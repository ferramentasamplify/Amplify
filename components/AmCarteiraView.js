"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_TABS } from "@/lib/config";

const fmtBRL = (n) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const CAT_CONFIG = {
  Diamond: { color: "#2563EB", badge: "💎" },
  Gold: { color: "#D97706", badge: "🥇" },
  Silver: { color: "#64748B", badge: "🥈" },
  Start: { color: "#1B3FE4", badge: "🚀" },
  Safira: { color: "#7C3AED", badge: "💜" },
  Origens: { color: "#059669", badge: "🌱" },
};

export default function AmCarteiraView({ slug }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/am/${slug}/carteira`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/club/am/login?next=${encodeURIComponent(pathname || "")}`);
          return;
        }
        throw new Error(d.error || "Erro ao carregar carteira.");
      }
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function logout() {
    await fetch("/api/am/logout", { method: "POST" });
    router.push("/club/am/login");
    router.refresh();
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">
        Carregando carteira…
      </div>
    );
  }

  const am = data?.am;
  const creators = data?.creators || [];
  const summary = data?.summary || {};

  const filtered = creators.filter((c) => {
    const matchSearch =
      !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.handle.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoria === "todas" || c.categoria === categoria;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      {/* NAV */}
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
          <Link href="/club" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5">
            ← Club
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-sm font-bold" style={{ color: am?.accentColor }}>
            🛡️ {am?.shortName}
          </span>
          <Link
            href="/club/am/central"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/80"
          >
            🏁 Central
          </Link>
          <button
            onClick={logout}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/5"
          >
            Sair
          </button>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">
              Carteira · {am?.role}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Olá, <span style={{ color: am?.accentColor }}>{am?.shortName}</span> 👋
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Sua carteira atualizada do Amplify Club — GMV, categoria e link direto pro Notion.
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 border border-white/10"
          >
            🔄 Atualizar
          </button>
        </div>

        {data?.warning && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-200">
            ⚠️ {data.warning}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Creators", value: summary.total || 0, color: "#a855f7" },
            { label: "Ativos", value: summary.ativos || 0, color: "#10b981" },
            { label: "GMV Carteira", value: fmtBRL(summary.gmvTotal), color: "#1B3FE4" },
            { label: "Comissão", value: fmtBRL(summary.comissaoTotal), color: "#D97706" },
            { label: "Receita Amplify", value: fmtBRL(summary.receitaTotal), color: "#25F4EE" },
          ].map((k) => (
            <div key={k.label} className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">
                {k.label}
              </div>
              <div className="text-xl font-extrabold tracking-tight" style={{ color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Categorias */}
        {summary.byCategoria && Object.keys(summary.byCategoria).length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoria("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                categoria === "todas"
                  ? "bg-white text-black border-white"
                  : "bg-[#14161F] border-white/10 text-white/60 hover:text-white"
              }`}
            >
              Todas ({summary.total})
            </button>
            {Object.entries(summary.byCategoria).map(([cat, count]) => {
              const cfg = CAT_CONFIG[cat] || { color: "#fff", badge: "⭐" };
              const active = categoria === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoria(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    active ? "border-2" : "border-white/10 hover:border-white/30"
                  }`}
                  style={{
                    background: active ? `${cfg.color}20` : "#14161F",
                    borderColor: active ? cfg.color : undefined,
                    color: cfg.color,
                  }}
                >
                  <span>{cfg.badge}</span>
                  {cat} <span className="text-white/50 font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou @…"
            className="flex-1 bg-[#14161F] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#a855f7]"
          />
        </div>

        {/* Tabela */}
        <div className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-widest text-white/40">
                <tr>
                  <th className="text-left px-4 py-3">Creator</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-right px-4 py-3">GMV</th>
                  <th className="text-right px-4 py-3">Comissão</th>
                  <th className="text-right px-4 py-3">Receita</th>
                  <th className="text-left px-4 py-3">Última att</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-white/40 text-xs">
                      {creators.length === 0
                        ? "Sua carteira tá vazia. Peça pro Gabriel preencher lib/carteiras.js."
                        : "Nenhum creator com esses filtros."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const cfg = CAT_CONFIG[c.categoria] || { color: "#fff", badge: "⭐" };
                    return (
                      <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{c.nome || c.handle}</div>
                          <div className="text-[10px] text-white/40">@{c.handle}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                            style={{ background: `${cfg.color}20`, color: cfg.color }}
                          >
                            {cfg.badge} {c.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {fmtBRL(c.gmv)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-white/70">
                          {fmtBRL(c.comissao)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: "#25F4EE" }}>
                          {fmtBRL(c.amplifyRevenue)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50 font-mono">
                          {c.lastUpdate || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={c.notionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 hover:bg-[#a855f7]/20 hover:text-[#a855f7] text-white/60"
                          >
                            Notion ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {data?.updatedAt && (
          <p className="text-center text-[10px] text-white/30">
            Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  );
}