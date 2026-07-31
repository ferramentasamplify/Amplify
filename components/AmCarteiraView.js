"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { NAV_TABS } from "@/lib/config";
import { tiktokProfileUrl } from "@/lib/tiktok-profile-url";
import PartnerCenterDateSelector from "@/components/PartnerCenterDateSelector";

const fmtBRL = (n) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const clampPct = (n) => Math.max(0, Math.min(100, Number(n || 0)));
const fmtShortBRL = (n) => {
  const value = Number(n || 0);
  if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  return fmtBRL(value);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (dateString) => {
  if (!dateString) return "—";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayISO());
  const [applied, setApplied] = useState({ from: "", to: todayISO() });
  const [selectedCreators, setSelectedCreators] = useState([]);
  const [showCreatorSelector, setShowCreatorSelector] = useState(false);
  const [showCarteiraLine, setShowCarteiraLine] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      const query = params.toString();
      const res = await fetch(`/api/am/${slug}/carteira${query ? `?${query}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/club/am/login?next=${encodeURIComponent(pathname || "")}`);
          return;
        }
        throw new Error(d.error || "Erro ao carregar carteira.");
      }
      setData(d);
      if (d.dataFreshness?.requestedPeriod) {
        setStartDate((current) => current || d.dataFreshness.requestedPeriod.from || "");
        setEndDate((current) => current || d.dataFreshness.requestedPeriod.to || todayISO());
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, applied]);

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
  const goals = data?.goals || {};
  const freshness = data?.dataFreshness || {};
  const requestedPeriod = freshness.requestedPeriod || applied;
  const effectiveCoverage = freshness.effectiveCoverage || {};
  const timeline = data?.timeline || {};
  const creatorOptions = timeline.creatorOptions || [];
  const visibleCreators = selectedCreators.length ? selectedCreators : creatorOptions.slice(0, 5).map((creator) => creator.handle);
  const selectedLabel = selectedCreators.length ? `${selectedCreators.length} selecionado${selectedCreators.length === 1 ? "" : "s"}` : "Top 5 creators";
  const chartData = (timeline.points || []).map((point) => {
    const row = { date: point.date, label: fmtDate(point.date), total: Number(point.total || 0) };
    for (const handle of visibleCreators) row[handle] = Number(point.creators?.[handle] || 0);
    return row;
  });
  const chartColors = ["#25F4EE", "#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#f43f5e", "#14b8a6"];

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
              Sua carteira atualizada do Amplify Club — GMV e comissão vindos do Partner Center.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PartnerCenterDateSelector
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              onApply={(from, to) => setApplied({ from, to })}
              loading={loading}
              freshness={freshness}
              accent={am?.accentColor || "#a855f7"}
            />
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 border border-white/10"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: "Creators", value: summary.total || 0, color: "#a855f7" },
            { label: "Ativos", value: summary.ativos || 0, color: "#10b981" },
            { label: "GMV Carteira", value: fmtBRL(summary.gmvTotal), color: "#1B3FE4" },
            { label: "Comissão Creator", value: fmtBRL(summary.comissaoTotal), color: "#D97706" },
            { label: "Receita Amplify", value: fmtBRL(summary.receitaTotal), color: "#25F4EE" },
            { label: "Comissão média", value: fmtPct(summary.comissaoMediaCreator), color: "#f59e0b" },
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

        <section className="grid gap-3 lg:grid-cols-2">
          {[goals.period, goals.august].filter(Boolean).map((goal) => {
            const progress = clampPct(goal.progressPct);
            const periodLabel = goal.period
              ? `${fmtDate(goal.period.from)} → ${fmtDate(goal.period.to)}`
              : goal.previousPeriod
                ? `${fmtDate(goal.previousPeriod.from)} → ${fmtDate(goal.previousPeriod.to)}`
                : "—";
            return (
              <div key={goal.label} className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                      Progresso de meta
                    </div>
                    <h2 className="mt-1 text-lg font-black text-white">{goal.label}</h2>
                    <p className="mt-1 text-xs text-white/40">{periodLabel}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      goal.status === "Meta batida"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : goal.status === "Não iniciada"
                          ? "border-white/10 bg-white/5 text-white/50"
                          : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {goal.status}
                  </span>
                </div>
                <div className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl font-extrabold tracking-tight" style={{ color: am?.accentColor || "#25F4EE" }}>
                        {fmtPct(goal.progressPct)}
                      </div>
                      <div className="text-[11px] text-white/40">realizado da meta</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{fmtBRL(goal.realizedGmv)}</div>
                      <div className="text-[11px] text-white/40">de {fmtBRL(goal.targetGmv)}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: am?.accentColor || "#25F4EE" }}
                    />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/35">Realizado</div>
                    <div className="mt-1 font-bold text-white">{fmtShortBRL(goal.realizedGmv)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/35">Meta</div>
                    <div className="mt-1 font-bold text-white">{fmtShortBRL(goal.targetGmv)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/35">Falta</div>
                    <div className="mt-1 font-bold text-white">{fmtShortBRL(goal.gap)}</div>
                  </div>
                </div>
                {goal.rule && <p className="mt-3 text-[11px] leading-relaxed text-white/35">{goal.rule}</p>}
              </div>
            );
          })}
        </section>

        <section className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Evolução de GMV
              </div>
              <h2 className="mt-1 text-xl font-black">Carteira e creators selecionados</h2>
              <p className="mt-1 text-xs text-white/40">
                Carteira no eixo direito; creators no eixo esquerdo.
              </p>
            </div>
            <div className="flex flex-wrap justify-start lg:justify-end gap-2">
              <button
                onClick={() => setShowCarteiraLine((current) => !current)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  showCarteiraLine ? "border-[#1B3FE4] bg-[#1B3FE4]/15 text-[#7EA2FF]" : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                Carteira inteira
              </button>
              <button
                onClick={() => {
                  setSelectedCreators([]);
                  setShowCreatorSelector(false);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  selectedCreators.length === 0 ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                Top 5
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowCreatorSelector((current) => !current)}
                  className="min-w-[220px] px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white/75 text-left flex items-center justify-between gap-3"
                >
                  <span>Creators: {selectedLabel}</span>
                  <span className="text-white/40">▾</span>
                </button>
                {showCreatorSelector && (
                  <div className="absolute right-0 top-10 z-30 w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-white/10 bg-[#0A0B12] p-2 shadow-2xl">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 pb-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Selecionar creators</span>
                      <button
                        onClick={() => setSelectedCreators([])}
                        className="text-[10px] font-bold text-white/50 hover:text-white"
                      >
                        Top 5
                      </button>
                    </div>
                    {creatorOptions.map((creator) => {
                      const active = selectedCreators.includes(creator.handle);
                      return (
                        <label
                          key={creator.handle}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold ${
                            active ? "bg-[#25F4EE]/10 text-[#25F4EE]" : "text-white/65 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              setSelectedCreators((current) =>
                                current.includes(creator.handle)
                                  ? current.filter((item) => item !== creator.handle)
                                  : [...current, creator.handle],
                              );
                            }}
                            className="accent-[#25F4EE]"
                          />
                          <span className="truncate">@{creator.handle}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
                <YAxis yAxisId="creators" orientation="left" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtShortBRL} />
                <YAxis yAxisId="carteira" orientation="right" tick={{ fill: "rgba(126,162,255,0.75)", fontSize: 10 }} tickLine={false} axisLine={false} width={78} tickFormatter={fmtShortBRL} />
                <Tooltip
                  contentStyle={{ background: "#0A0B12", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff" }}
                  labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                  formatter={(value, name) => [fmtBRL(value), name === "total" ? "Carteira completa" : `@${name}`]}
                />
                {showCarteiraLine && (
                  <Line yAxisId="carteira" type="monotone" dataKey="total" name="total" stroke={am?.accentColor || "#1B3FE4"} strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                )}
                {visibleCreators.map((handle, index) => (
                  <Line
                    key={handle}
                    yAxisId="creators"
                    type="monotone"
                    dataKey={handle}
                    name={handle}
                    stroke={chartColors[index % chartColors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="bg-[#14161F] border border-white/10 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Período contabilizado
              </div>
              <div className="text-sm font-bold text-white mt-1">
                Pedido: {fmtDate(requestedPeriod?.from)} → {fmtDate(requestedPeriod?.to)}
              </div>
              <div className="text-xs text-white/45 mt-0.5">
                Usado no cálculo: {fmtDate(effectiveCoverage?.from)} → {fmtDate(effectiveCoverage?.to)}
              </div>
            </div>
            <div className="text-right text-[11px] text-white/40 max-w-xl">
              <div>Base canonica Retencao/TikTok Shop · snapshots empacotados no hub.</div>
              <div>
                {(effectiveCoverage?.snapshots || []).length} snapshot{(effectiveCoverage?.snapshots || []).length === 1 ? "" : "s"} · {effectiveCoverage?.mode === "overlap_approximation" ? "aproximação por cobertura disponível" : "cobertura exata/contida"}
              </div>
            </div>
          </div>
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
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-widest text-white/40">
                <tr>
                  <th className="text-left px-4 py-3">Creator</th>
                  <th className="text-left px-4 py-3">Nicho</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-right px-4 py-3">GMV</th>
                  <th className="text-right px-4 py-3">Comissão Creator</th>
                  <th className="text-right px-4 py-3">Média</th>
                  <th className="text-right px-4 py-3">Receita Amplify</th>
                  <th className="text-left px-4 py-3">Insight</th>
                  <th className="text-left px-4 py-3">Última att</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-white/40 text-xs">
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
                          <div className="flex items-center gap-2 text-[10px] text-white/40">
                            <a href={tiktokProfileUrl(c.handle)} target="_blank" rel="noreferrer" className="hover:text-[#25F4EE] hover:underline">
                              @{c.handle}
                            </a>
                            {c.source === "partner_center_only" && (
                              <span className="text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1">
                                sem cadastro
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">
                          {c.nicho || "A definir"}
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
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: c.commissionRate < 10 ? "#f59e0b" : "#10b981" }}>
                          {fmtPct(c.commissionRate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: "#25F4EE" }}>
                          {fmtBRL(c.amplifyRevenue)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60 max-w-[260px]">
                          {c.insight || "Sem historico suficiente."}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50 font-mono">
                          {c.lastUpdate || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/club/am/${slug}/creator/${encodeURIComponent(c.handle)}`}
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#25F4EE]/10 hover:bg-[#25F4EE]/20 text-[#25F4EE]"
                            >
                              Ver perfil
                            </Link>
                            {c.notionUrl ? (
                              <a
                                href={c.notionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 hover:bg-[#a855f7]/20 hover:text-[#a855f7] text-white/60"
                              >
                                Notion
                              </a>
                            ) : null}
                          </div>
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

        {(data?.warning || data?.warnings?.length > 0) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-100">
            <div className="font-bold mb-1">Fonte de dados em atenção</div>
            {data?.warning && <div className="text-amber-100/80">• {data.warning}</div>}
            <div className="space-y-1 text-amber-100/80">
              {(data.warnings || []).map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
