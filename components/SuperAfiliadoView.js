"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart,
} from "recharts";
import { NAV_TABS } from "@/lib/config";

const STATUS_COLOR = {
  Agenciado: "#059669", "Convite Aceito": "#059669", "Convite Enviado": "#D97706",
  "Em Progresso": "#2563EB", "Em progresso": "#2563EB", "Em progresso (Atendido)": "#2563EB",
  "Enviar Convite": "#7C3AED", "Enviar Convite (Atendido)": "#7C3AED",
};
const STATUS_LABEL = {
  Agenciado: "Agenciado", "Convite Aceito": "Agenciado", "Convite Enviado": "Convite Enviado",
  "Em Progresso": "Em Progresso", "Em progresso": "Em Progresso", "Em progresso (Atendido)": "Em Progresso",
  "Enviar Convite": "Enviar Convite", "Enviar Convite (Atendido)": "Enviar Convite",
};
const INSIDE = new Set(["Agenciado", "Convite Aceito"]);

const fmtBRL = (n) => "R$" + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtWeek = (iso) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
const toLocal = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export default function SuperAfiliadoView() {
  const pathname = usePathname();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filter,  setFilter]  = useState("all");
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [applied,   setApplied]   = useState({ start: "", end: "" });
  const [activeChart, setActiveChart] = useState("giseleEarn");

  useEffect(() => {
    setLoading(true);
    // Busca todos os UTMs (sem filtro de usuário — visão admin)
    const params = new URLSearchParams();
    if (applied.start) params.set("startDate", applied.start);
    if (applied.end)   params.set("endDate",   applied.end);
    fetch(`/api/superafiliado-full?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar."); setLoading(false); });
  }, [applied]);

  const { summary: s, leads = [], byDay = [], weeklyData = [], weeklyDataByCreator = {} } = data || {};
  const filtered = leads.filter(l => filter === "all" ? true : filter === "inside" ? INSIDE.has(l.status) : !INSIDE.has(l.status));
  const chartColors = { gmv: "#1B3FE4", giseleEarn: "#059669" };
  const chartLabels = { gmv: "GMV dos creators", giseleEarn: "Comissão" };
  const activeData = selectedCreator && weeklyDataByCreator[selectedCreator.handle] ? weeklyDataByCreator[selectedCreator.handle] : weeklyData;

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
          <Link href="/hub" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white whitespace-nowrap">
            🤝 Super Afiliado
          </Link>
          <Link href="/club"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 whitespace-nowrap">
            💎 Club
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#EA1A4E] mb-1">Aquisição</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Super Afiliado</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40">Período:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#EA1A4E]"/>
            <span className="text-white/30 text-xs">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#EA1A4E]"/>
            <button onClick={() => { setLoading(true); setApplied({ start: startDate, end: endDate }); }}
              className="px-3 py-1.5 rounded-lg bg-[#EA1A4E] text-white text-xs font-bold hover:opacity-90">
              Filtrar
            </button>
            {(applied.start || applied.end) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); setApplied({ start: "", end: "" }); }}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-bold">× Limpar</button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 text-red-300 text-sm">⚠️ {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Carregando…</div>
        ) : s && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Indicações", value: String(s.total), color: "#fff" },
                { label: "Agenciados", value: String(s.agenciados), color: "#EA1A4E" },
                { label: "Conversão", value: `${s.conversion}%`, color: "#f97316" },
                { label: "GMV Total", value: fmtBRL(s.totalGmv), color: "#10b981" },
              ].map(k => (
                <div key={k.label} className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
                  <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Gráfico semanal */}
            {activeData.length > 1 && (
              <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                    {selectedCreator ? `Evolução — ${selectedCreator.nome || selectedCreator.handle}` : "Evolução semanal"}
                  </span>
                  <div className="flex gap-2">
                    {(["giseleEarn", "gmv"]).map(k => (
                      <button key={k} onClick={() => setActiveChart(k)}
                        className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                        style={{ background: activeChart === k ? chartColors[k] : "rgba(255,255,255,0.05)", color: activeChart === k ? "white" : "rgba(255,255,255,0.4)" }}>
                        {chartLabels[k]}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedCreator && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-white/50">{selectedCreator.nome}</span>
                    <button onClick={() => setSelectedCreator(null)} className="text-xs text-white/30 hover:text-white">× limpar</button>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={activeData}>
                    <defs>
                      <linearGradient id="saGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors[activeChart]} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={chartColors[activeChart]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                    <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={v => [fmtBRL(v), chartLabels[activeChart]]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Area type="monotone" dataKey={activeChart} stroke={chartColors[activeChart]} strokeWidth={2.5} fill="url(#saGrad)"
                      dot={{ r: 3, fill: chartColors[activeChart], strokeWidth: 0 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gráfico por dia */}
            {byDay.length > 0 && (
              <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Indicações por dia</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={byDay} barCategoryGap="30%">
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={v => [v + " indicações", ""]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Bar dataKey="n" fill="#EA1A4E" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela */}
            <div className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                  Todas as {s.total} indicações
                </span>
                <div className="flex gap-2">
                  {[["all","Todos"],["inside","Agenciados"],["other","Pendentes"]].map(([f, lbl]) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                      style={{ background: filter === f ? "#EA1A4E" : "rgba(255,255,255,0.05)", color: filter === f ? "white" : "rgba(255,255,255,0.4)" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0A0B12]">
                    <tr>
                      {["Creator","@ TikTok","Status","GMV"].map((h, i) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((l, i) => (
                      <tr key={l.id}
                        onClick={() => INSIDE.has(l.status) && setSelectedCreator(selectedCreator?.id === l.id ? null : l)}
                        className={`hover:bg-white/5 transition-colors ${INSIDE.has(l.status) ? "cursor-pointer" : ""}`}
                        style={{ borderLeft: selectedCreator?.id === l.id ? "2px solid #EA1A4E" : "2px solid transparent" }}>
                        <td className="px-4 py-3 text-sm font-medium text-white max-w-[140px] truncate">{l.nome || "—"}</td>
                        <td className="px-4 py-3 text-sm text-white/50 font-mono">{l.handle || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                            style={{ background: (STATUS_COLOR[l.status] || "#9CA3AF") + "22", color: STATUS_COLOR[l.status] || "#9CA3AF" }}>
                            {STATUS_LABEL[l.status] || l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: l.gmv > 0 ? "#10b981" : "rgba(255,255,255,0.2)" }}>
                          {INSIDE.has(l.status) ? fmtBRL(l.gmv) : "—"}
                        </td>
                      </tr>
                    ))}
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
