"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { NAV_TABS } from "@/lib/config";

const fmtBRL  = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtBRLd = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWeek = (iso) => { const d = new Date(iso + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const toLocal = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const CAT_CONFIG = {
  Diamond: { color: "#2563EB", badge: "💎" },
  Gold:    { color: "#D97706", badge: "🥇" },
  Silver:  { color: "#64748B", badge: "🥈" },
  Start:   { color: "#1B3FE4", badge: "🚀" },
  Safira:  { color: "#7C3AED", badge: "💜" },
  Origens: { color: "#059669", badge: "🌱" },
};

const LIGA_77_URL = "https://liga77-retencao.netlify.app";
const VIRADA_CLUB_URL = "https://amplify-club-retencao.netlify.app/";
const VIRADA_CATEGORIES = ["Start", "Silver", "Gold", "Diamond", "Safira", "Royal"];

const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;

function AccessCard({ href, title, description, tag, external = false, accent = "#25F4EE" }) {
  const className = "group rounded-lg border border-white/10 bg-[#10141E] p-4 hover:bg-white/[0.04] transition-colors";
  const style = { "--accent": accent };
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-white">{title}</span>
        <span className="text-white/30 group-hover:text-[var(--accent)] transition-colors">{external ? "↗" : "→"}</span>
      </div>
      <p className="text-xs text-white/40 mt-2 min-h-[32px]">{description}</p>
      {tag && (
        <span className="mt-3 inline-flex rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
          {tag}
        </span>
      )}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} style={style}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}

function ViradaDashboard({ data, loading, error }) {
  if (loading) {
    return (
      <section id="virada-club-dashboard" className="bg-[#10141E] border border-white/10 rounded-lg p-6">
        <div className="h-40 flex items-center justify-center text-sm text-white/40">Carregando dashboard da virada...</div>
      </section>
    );
  }

  if (error || !data?.totals) {
    return (
      <section id="virada-club-dashboard" className="bg-[#10141E] border border-red-500/30 rounded-lg p-6 text-sm text-red-300">
        {error || "Dashboard da virada indisponivel."}
      </section>
    );
  }

  const categories = VIRADA_CATEGORIES
    .map((name) => data.categories?.[name])
    .filter(Boolean);
  const maxRevenue = Math.max(...categories.map((c) => c.amplify_commission || c.partner_commission || 0), 1);
  const expiring = (data.high_value_expiring || []).slice(0, 8);

  return (
    <section id="virada-club-dashboard" className="bg-[#10141E] border border-white/10 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Virada mensal</p>
          <h2 className="text-xl font-extrabold tracking-tight">Dashboard Club GMV</h2>
          <p className="text-xs text-white/40 mt-1">
            Ref: <strong className="text-white/80">{data.reference?.label || "periodo fechado"}</strong>
            {data.reference?.generated_at ? ` · atualizado ${data.reference.generated_at}` : ""}
          </p>
        </div>
        <a
          href={VIRADA_CLUB_URL}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-colors"
        >
          Tela cheia ↗
        </a>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Creators ativos", value: Number(data.totals.creators || 0).toLocaleString("pt-BR"), color: "#fff" },
            { label: "GMV total", value: fmtBRLd(data.totals.gmv), color: "#10b981" },
            { label: "Comissão Amplify", value: fmtBRLd(data.totals.amplify_commission || data.totals.partner_commission), color: "#25F4EE" },
            { label: "Contratos 90d", value: String((data.high_value_expiring || []).length), color: "#f59e0b" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[.85fr_1.15fr] gap-4">
          <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold">Comissão por categoria</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">P&L</span>
            </div>
            <div className="space-y-3">
              {categories.map((c) => {
                const revenue = c.amplify_commission || c.partner_commission || 0;
                const pct = Math.max(4, (revenue / maxRevenue) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="font-bold text-white/80">{c.emoji} {c.name}</span>
                      <span className="font-mono text-white/60">{fmtBRL(revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color || "#25F4EE" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0A0B12] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">Categorias</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">clique no dash completo para detalhes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead className="bg-white/[0.02]">
                  <tr>
                    {["Categoria", "Creators", "GMV", "Comissão", "Take rate"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {categories.map((c) => (
                    <tr key={c.name} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-sm font-bold text-white">{c.emoji} {c.name}</td>
                      <td className="px-4 py-3 text-sm text-white/70">{Number(c.creators?.length || 0).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-sm font-mono text-emerald-300">{fmtBRL(c.gmv)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-cyan-300">{fmtBRL(c.amplify_commission || c.partner_commission)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white/60">{fmtPct(c.avg_take_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0A0B12] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">Contratos prioritários</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Top {expiring.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-white/[0.02]">
                <tr>
                  {["Creator", "Categoria", "GMV", "Comissão", "Fim", "Dias"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expiring.map((c) => (
                  <tr key={`${c.arroba}-${c.relation_id || c.contract_end}`} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-sm font-bold text-white">@{c.arroba}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{c.category}</td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-300">{fmtBRL(c.gmv)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-cyan-300">{fmtBRL(c.amplify_commission || c.partner_commission)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-white/60">{c.contract_end || "-"}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${c.days_left <= 15 ? "text-red-300" : c.days_left <= 45 ? "text-amber-300" : "text-white/60"}`}>{c.days_left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ClubView() {
  const pathname = usePathname();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [metric,  setMetric]  = useState("gmv");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [applied,   setApplied]   = useState({ start: "", end: "" });
  const [search,    setSearch]    = useState("");
  const [viradaData, setViradaData] = useState(null);
  const [viradaLoading, setViradaLoading] = useState(true);
  const [viradaError, setViradaError] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (applied.start) params.set("startDate", applied.start);
    if (applied.end)   params.set("endDate",   applied.end);
    fetch(`/api/club-full?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar."); setLoading(false); });
  }, [applied]);

  useEffect(() => {
    setViradaLoading(true);
    fetch("/api/club-virada")
      .then(r => r.json())
      .then(d => {
        if (d.error) setViradaError(d.error);
        else setViradaData(d);
        setViradaLoading(false);
      })
      .catch(() => {
        setViradaError("Erro ao carregar dashboard da virada.");
        setViradaLoading(false);
      });
  }, []);

  const { summary: s, creators = [], weeklyAmplifyData = [] } = data || {};

  const filteredCreators = creators.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.handle.toLowerCase().includes(search.toLowerCase())
  );

  const lastWeek = weeklyAmplifyData[weeklyAmplifyData.length - 1];
  const prevWeek = weeklyAmplifyData[weeklyAmplifyData.length - 2];
  const diff = lastWeek && prevWeek ? (lastWeek[metric] || 0) - (prevWeek[metric] || 0) : 0;
  const pct  = prevWeek?.[metric] ? (diff / prevWeek[metric] * 100) : 0;

  const CHART_METRICS = [
    { key: "gmv",           label: "GMV",         color: "#1B3FE4" },
    { key: "comissao",      label: "Comissão",    color: "#D97706" },
    { key: "amplifyRevenue",label: "Receita",     color: "#a855f7" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap">
            ← Hub
          </Link>
          {NAV_TABS.map(t => (
            <Link key={t.href} href={t.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${pathname === t.href ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              <span>{t.icon}</span> {t.label}
            </Link>
          ))}
          <Link href="/superafiliado"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 whitespace-nowrap">
            🤝 Super Afiliado
          </Link>
          <Link href="/club"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white whitespace-nowrap">
            💎 Club
          </Link>
          <Link href="/club/am"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 whitespace-nowrap">
            🛡️ Carteira AM
          </Link>
        </div>
      </nav>

      <div className="max-w-[1480px] mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Retenção · Operação Club</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Amplify Club</h1>
          </div>
        </div>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_.8fr] gap-4 items-start">
          <div className="bg-[#14161F] border border-white/10 rounded-lg p-5">
            <div className="mb-4">
              <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">Principais acessos</p>
              <h2 className="text-xl font-extrabold tracking-tight">Operação do Club</h2>
              <p className="text-sm text-white/40 mt-1 max-w-2xl">Rotinas usadas no dia a dia da retenção e da virada mensal.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AccessCard
                href="#virada-club-dashboard"
                title="Virada Club GMV"
                description="Dashboard mensal com categorias, comissão, contratos e leitura para AMs."
                tag="Rotina mensal"
                accent="#25F4EE"
              />
              <AccessCard
                href="/club/am"
                title="Carteira AM"
                description="Acesso individual por Account Manager e central da corrida."
                tag="Operação"
                accent="#a855f7"
              />
            </div>
          </div>

          <div className="bg-[#14161F] border border-white/10 rounded-lg p-5">
            <div className="mb-4">
              <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">Projetos</p>
              <h2 className="text-xl font-extrabold tracking-tight">Campanhas e iniciativas</h2>
              <p className="text-sm text-white/40 mt-1">Frentes pontuais ficam separadas da operação principal.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AccessCard
                href="/club/datas-duplas"
                title="Datas Duplas"
                description="Campanhas pontuais com acompanhamento especial de creators."
                tag="Projeto"
                accent="#25F4EE"
              />
              <AccessCard
                href={LIGA_77_URL}
                title="Liga 7.7"
                description="Dashboard por creator e gestão macro da campanha."
                tag="Projeto"
                external
                accent="#25F4EE"
              />
            </div>
          </div>
        </section>

        <ViradaDashboard data={viradaData} loading={viradaLoading} error={viradaError} />

        <section className="bg-[#10141E] border border-white/10 rounded-lg p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">Performance do Club</p>
              <h2 className="text-lg font-extrabold tracking-tight">Base atual e evolução semanal</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-[#0A0B12] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#a855f7]"/>
              <span className="text-white/30 text-xs">→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-[#0A0B12] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#a855f7]"/>
              <button onClick={() => { setLoading(true); setApplied({ start: startDate, end: endDate }); }}
                className="px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: "#a855f7" }}>
                Filtrar
              </button>
              {(applied.start || applied.end) && (
                <button onClick={() => { setStartDate(""); setEndDate(""); setApplied({ start: "", end: "" }); }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-bold">× Limpar</button>
              )}
            </div>
          </div>
        </section>

        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 text-red-300 text-sm">⚠️ {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Carregando…</div>
        ) : s && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Creators", value: String(s.total),                    color: "#a855f7" },
                { label: "Ativos (período)", value: String(s.active),                 color: "#10b981" },
                { label: "GMV Total",       value: fmtBRL(s.totalGmv),               color: "#10b981" },
                { label: "Receita Amplify", value: fmtBRL(s.amplifyTotal),            color: "#25F4EE" },
              ].map(k => (
                <div key={k.label} className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
                  <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Por categoria */}
            {s.byCategoria && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.byCategoria).map(([cat, count]) => {
                  const cfg = CAT_CONFIG[cat] || { color: "#fff", badge: "⭐" };
                  return (
                    <div key={cat} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#14161F]">
                      <span>{cfg.badge}</span>
                      <span className="text-xs font-bold" style={{ color: cfg.color }}>{cat}</span>
                      <span className="text-xs text-white/50 font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gráfico semanal */}
            {weeklyAmplifyData.length > 1 && (
              <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">Evolução semanal</span>
                  <div className="flex gap-2">
                    {CHART_METRICS.map(m => (
                      <button key={m.key} onClick={() => setMetric(m.key)}
                        className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                        style={{ background: metric === m.key ? m.color : "rgba(255,255,255,0.05)", color: metric === m.key ? "white" : "rgba(255,255,255,0.4)" }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weeklyAmplifyData}>
                    <defs>
                      <linearGradient id="clubGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_METRICS.find(m => m.key === metric)?.color} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={CHART_METRICS.find(m => m.key === metric)?.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                    <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={v => [fmtBRLd(v), CHART_METRICS.find(m => m.key === metric)?.label]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Area type="monotone" dataKey={metric}
                      stroke={CHART_METRICS.find(m => m.key === metric)?.color}
                      strokeWidth={2.5} fill="url(#clubGrad)"
                      dot={{ r: 3, fill: CHART_METRICS.find(m => m.key === metric)?.color, strokeWidth: 0 }}/>
                  </AreaChart>
                </ResponsiveContainer>
                {lastWeek && prevWeek && (
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-white/40">Última semana: <strong className="text-white">{fmtBRLd(lastWeek[metric] || 0)}</strong></span>
                    <span style={{ color: diff >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                      {diff >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs semana anterior
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tabela de creators */}
            <div className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40">Creators ({s.total})</span>
                <input type="text" placeholder="Buscar creator…" value={search} onChange={e => setSearch(e.target.value)}
                  className="bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#a855f7] w-48"/>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0A0B12]">
                    <tr>
                      {["Creator","@ TikTok","Categoria","GMV","Comissão"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCreators.map((c, i) => {
                      const cfg = CAT_CONFIG[c.categoria] || { color: "#fff", badge: "⭐" };
                      return (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-white max-w-[160px] truncate">{c.nome || "—"}</td>
                          <td className="px-4 py-3 text-xs text-white/50 font-mono">@{c.handle}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                              style={{ background: cfg.color + "22", color: cfg.color }}>
                              {cfg.badge} {c.categoria}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: c.gmv > 0 ? "#10b981" : "rgba(255,255,255,0.2)" }}>
                            {c.gmv > 0 ? fmtBRL(c.gmv) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: c.comissao > 0 ? "#D97706" : "rgba(255,255,255,0.2)" }}>
                            {c.comissao > 0 ? fmtBRL(c.comissao) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
