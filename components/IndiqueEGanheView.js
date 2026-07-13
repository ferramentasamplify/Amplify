"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart, ComposedChart, Line,
} from "recharts";
import { NAV_TABS } from "@/lib/config";

const STATUS_COLOR = {
  Agenciado: "#059669", "Convite Aceito": "#059669", "Convite Enviado": "#D97706",
  "Em Progresso": "#2563EB", "Em progresso": "#2563EB", "Em progresso (Atendido)": "#2563EB",
  "Enviar Convite": "#7C3AED", "Enviar Convite (Atendido)": "#7C3AED",
  "Qualificado": "#A855F7", "Qualificado (Atendido)": "#A855F7",
};

const fmtBRL = (n) => "R$" + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtWeek = (iso) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };

export default function IndiqueEGanheView() {
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState({ start: "", end: "" });
  const [activeChart, setActiveChart] = useState("indiqueEarn");

  useEffect(() => {
    const params = new URLSearchParams();
    if (applied.start) params.set("startDate", applied.start);
    if (applied.end) params.set("endDate", applied.end);
    fetch(`/api/indiqueeganhe-full?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar."); setLoading(false); });
  }, [applied]);

  const { summary: s, leads = [], byDay = [], weeklyData = [], weeklyDataByCreator = {} } = data || {};
  const statuses = Object.keys(s?.byStatus || {}).sort();
  const filtered = leads.filter(l => statusFilter === "all" ? true : (l.status || "Sem status") === statusFilter);
  const chartColors = { gmv: "#1B3FE4", indiqueEarn: "#EAB308" };
  const chartLabels = { gmv: "GMV dos creators", indiqueEarn: "Comissão Indique" };
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
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#EAB308] mb-1">Aquisição</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Indique e Ganhe</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40">Período:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#EAB308]"/>
            <span className="text-white/30 text-xs">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#EAB308]"/>
            <button onClick={() => { setLoading(true); setError(""); setApplied({ start: startDate, end: endDate }); }}
              className="px-3 py-1.5 rounded-lg bg-[#EAB308] text-black text-xs font-bold hover:opacity-90">
              Filtrar
            </button>
            {(applied.start || applied.end) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); setLoading(true); setError(""); setApplied({ start: "", end: "" }); }}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-bold">x Limpar</button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 text-red-300 text-sm">Aviso: {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Carregando...</div>
        ) : s && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Indicações", value: String(s.total), color: "#fff" },
                { label: "Total Agenciados", value: String(s.totalAgenciados || 0), color: "#10b981" },
                { label: "Conversão", value: `${s.conversionRate || 0}%`, color: "#f97316" },
                { label: "Comissão Total Gerada", value: fmtBRL(s.totalGeneratedCommission), color: "#EAB308" },
              ].map(k => (
                <div key={k.label} className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
                  <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {activeData.length > 1 && (
              <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                    {selectedCreator ? `Evolução - ${selectedCreator.nome || selectedCreator.handle}` : "Evolução semanal"}
                  </span>
                  <div className="flex gap-2">
                    {(["indiqueEarn", "gmv"]).map(k => (
                      <button key={k} onClick={() => setActiveChart(k)}
                        className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                        style={{ background: activeChart === k ? chartColors[k] : "rgba(255,255,255,0.05)", color: activeChart === k && k === "indiqueEarn" ? "black" : activeChart === k ? "white" : "rgba(255,255,255,0.4)" }}>
                        {chartLabels[k]}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedCreator && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-white/50">{selectedCreator.nome}</span>
                    <button onClick={() => setSelectedCreator(null)} className="text-xs text-white/30 hover:text-white">x limpar</button>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={activeData}>
                    <defs>
                      <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors[activeChart]} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={chartColors[activeChart]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                    <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={v => [fmtBRL(v), chartLabels[activeChart]]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Area type="monotone" dataKey={activeChart} stroke={chartColors[activeChart]} strokeWidth={2.5} fill="url(#igGrad)"
                      dot={{ r: 3, fill: chartColors[activeChart], strokeWidth: 0 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {byDay.length > 0 && (
              <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5">
                <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Indicações e convertidos por dia</div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={byDay} barCategoryGap="30%">
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={(v, name) => [v, name]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Bar dataKey="converted" name="Convertidos" fill="#10B981" radius={[4, 4, 0, 0]}/>
                    <Line type="monotone" dataKey="n" name="Indicações" stroke="#EAB308" strokeWidth={2.5}
                      dot={{ r: 3, fill: "#EAB308", strokeWidth: 0 }} activeDot={{ r: 4 }}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                  Todas as {s.total} indicações
                </span>
                <div className="flex gap-2 overflow-x-auto">
                  <button onClick={() => setStatusFilter("all")}
                    className="text-xs font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                    style={{ background: statusFilter === "all" ? "#EAB308" : "rgba(255,255,255,0.05)", color: statusFilter === "all" ? "black" : "rgba(255,255,255,0.4)" }}>
                    Todos
                  </button>
                  {statuses.map(status => (
                    <button key={status} onClick={() => setStatusFilter(status)}
                      className="text-xs font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap"
                      style={{ background: statusFilter === status ? "#EAB308" : "rgba(255,255,255,0.05)", color: statusFilter === status ? "black" : "rgba(255,255,255,0.4)" }}>
                      {status} ({s.byStatus[status]})
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0A0B12]">
                    <tr>
                      {["Creator","@ TikTok","Status","GMV","Comissao"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((l) => (
                      <tr key={l.id}
                        onClick={() => l.gmv > 0 && setSelectedCreator(selectedCreator?.id === l.id ? null : l)}
                        className={`hover:bg-white/5 transition-colors ${l.gmv > 0 ? "cursor-pointer" : ""}`}
                        style={{ borderLeft: selectedCreator?.id === l.id ? "2px solid #EAB308" : "2px solid transparent" }}>
                        <td className="px-4 py-3 text-sm font-medium text-white max-w-[140px] truncate">{l.nome || "-"}</td>
                        <td className="px-4 py-3 text-sm text-white/50 font-mono">{l.handle || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                            style={{ background: (STATUS_COLOR[l.status] || "#9CA3AF") + "22", color: STATUS_COLOR[l.status] || "#9CA3AF" }}>
                            {l.status || "Sem status"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: l.gmv > 0 ? "#10b981" : "rgba(255,255,255,0.2)" }}>
                          {fmtBRL(l.gmv)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: l.comissao > 0 ? "#EAB308" : "rgba(255,255,255,0.2)" }}>
                          {fmtBRL(l.comissao)}
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
