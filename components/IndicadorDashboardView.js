"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const STATUS_COLOR = {
  Agenciado: "#059669", "Convite Aceito": "#059669", "Convite Enviado": "#D97706",
  "Em Progresso": "#2563EB", "Em progresso": "#2563EB", "Em progresso (Atendido)": "#2563EB",
  "Enviar Convite": "#7C3AED", "Enviar Convite (Atendido)": "#7C3AED",
  "Qualificado": "#A855F7", "Qualificado (Atendido)": "#A855F7",
};

const fmtBRL = (n) => "R$" + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtWeek = (iso) => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
const fmtTableDate = (value) => {
  const date = String(value || "").slice(0, 10);
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
};
const tableColumns = [
  { key: "date", label: "Data" },
  { key: "handle", label: "@ TikTok" },
  { key: "status", label: "Status" },
  { key: "gmvRange", label: "Faixa GMV" },
  { key: "generatedCommission", label: "Comissao", align: "right" },
];

export default function IndicadorDashboardView({ variant = "indicador" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState({ start: "", end: "" });
  const [activeChart, setActiveChart] = useState("indiqueEarn");
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (applied.start) params.set("startDate", applied.start);
      if (applied.end) params.set("endDate", applied.end);
      const query = params.toString();
      const res = await fetch(`/api/indicadores/dashboard${query ? `?${query}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/indiqueeganhe/indicador/login?next=${encodeURIComponent(pathname || (variant === "super" ? "/superafiliado" : "/indiqueeganhe/indicador"))}`);
          return;
        }
        throw new Error(d.error || "Erro ao carregar dashboard.");
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
  }, [applied]);

  async function logout() {
    await fetch("/api/indicadores/logout", { method: "POST" });
    router.push(variant === "super" ? "/indiqueeganhe/indicador/login?next=/superafiliado" : "/indiqueeganhe/indicador/login");
    router.refresh();
  }

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    if (applied.start || applied.end) setApplied({ start: "", end: "" });
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">
        Carregando...
      </div>
    );
  }

  const indicador = data?.indicador || {};
  const s = data?.summary || {};
  const leads = data?.leads || [];
  const byDay = data?.byDay || [];
  const weeklyData = data?.weeklyData || [];
  const displayHandle = String(indicador.displayHandle || indicador.handle || "").replace(/^@/, "");
  const statuses = Object.keys(s.byStatus || {}).sort();
  const filtered = leads.filter((lead) => statusFilter === "all" ? true : (lead.status || "Sem status") === statusFilter);
  const sortedLeads = [...filtered].sort((a, b) => {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const valueFor = (lead) => {
      if (sortConfig.key === "date") return lead.createdDate || String(lead.created || "").slice(0, 10) || "";
      if (sortConfig.key === "generatedCommission") return Number(lead.generatedCommission || 0);
      if (sortConfig.key === "status") return lead.status || "Sem status";
      if (sortConfig.key === "gmvRange") return lead.gmvRange || "Não informado";
      return lead.handle || "";
    };
    const av = valueFor(a);
    const bv = valueFor(b);
    if (typeof av === "number" || typeof bv === "number") return (Number(av) - Number(bv)) * dir;
    return String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
  });
  function toggleSort(key) {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }
  const chartColors = { gmv: "#2563EB", indiqueEarn: "#E91E63" };
  const chartLabels = { gmv: "GMV dos indicados", indiqueEarn: "Comissão Indique" };
  const isIndique = variant !== "super";
  const pageBg = isIndique ? "bg-[#F4F7FB] text-[#101828]" : "bg-[#0A0B12] text-white";
  const panelClass = isIndique
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#14161F] border border-white/10";
  const mutedText = isIndique ? "text-slate-500" : "text-white/40";
  const strongMutedText = isIndique ? "text-slate-700" : "text-white/65";
  const tableHeadBg = isIndique ? "bg-slate-50" : "bg-[#0A0B12]";
  const tableDivider = isIndique ? "divide-y divide-slate-100" : "divide-y divide-white/5";

  return (
    <div className={`min-h-screen font-sans ${pageBg}`}>
      <nav className={`sticky top-0 z-20 backdrop-blur ${isIndique ? "border-b border-slate-200 bg-white/95" : "border-b border-white/10 bg-[#0A0B12]/95"}`}>
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-2 h-14">
          {isIndique ? (
            <Image src="/brand/amplify-ugc-logo.jpg" alt="Amplify UGC" width={738} height={178} priority className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-sm font-bold text-[#2F6BFF]">Super Afiliado</span>
          )}
          <span className={isIndique ? "text-slate-300" : "text-white/20"}>·</span>
          <span className={`text-sm truncate ${isIndique ? "text-slate-600" : "text-white/70"}`}>@{displayHandle}</span>
          <button onClick={logout} className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-bold transition ${isIndique ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
            Sair
          </button>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`mb-1 text-xs font-black uppercase ${isIndique ? "text-[#2563EB]" : "text-[#2F6BFF]"}`}>{variant === "super" ? "Painel Super Afiliado" : "Programa Indique e Ganhe"}</p>
            <h1 className="text-3xl font-extrabold tracking-tight">@{displayHandle}</h1>
            <p className={`mt-1 text-sm ${isIndique ? "text-slate-500" : "text-white/45"}`}>{variant === "super" && displayHandle === "amplify" ? "Visão admin de todos os super afiliados." : "Acompanhe suas indicações, agenciados e comissão gerada."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs ${mutedText}`}>Período:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={`rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${isIndique ? "border-slate-200 bg-white text-slate-950 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" : "border-white/10 bg-[#14161F] text-white focus:border-[#2F6BFF]"}`}/>
            <span className={`text-xs ${isIndique ? "text-slate-300" : "text-white/30"}`}>→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className={`rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${isIndique ? "border-slate-200 bg-white text-slate-950 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" : "border-white/10 bg-[#14161F] text-white focus:border-[#2F6BFF]"}`}/>
            <button onClick={() => setApplied({ start: startDate, end: endDate })}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-90 ${isIndique ? "bg-[#2563EB] text-white" : "bg-[#2F6BFF] text-white"}`}>
              Filtrar
            </button>
            {(applied.start || applied.end) && (
              <button onClick={clearFilters}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${isIndique ? "bg-slate-100 text-slate-500" : "bg-white/5 text-white/50"}`}>x Limpar</button>
            )}
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Aviso: {error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Indicações", value: String(s.total || 0), color: isIndique ? "#101828" : "#fff" },
            { label: "Total Agenciados", value: String(s.totalAgenciados || 0), color: "#10b981" },
            { label: "Conversão", value: `${s.conversionRate || 0}%`, color: "#2563EB" },
            { label: "Comissão Total Gerada", value: fmtBRL(s.totalGeneratedCommission), color: "#E91E63" },
          ].map(k => (
            <div key={k.label} className={`${panelClass} rounded-2xl p-5`}>
              <div className={`mb-1 text-[10px] font-black uppercase ${mutedText}`}>{k.label}</div>
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {weeklyData.length > 1 && (
          <div className={`${panelClass} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className={`text-xs font-black uppercase ${mutedText}`}>Evolução semanal</span>
              <div className="flex gap-2">
                {(["indiqueEarn", "gmv"]).map(k => (
                  <button key={k} onClick={() => setActiveChart(k)}
                    className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                    style={{ background: activeChart === k ? chartColors[k] : isIndique ? "#F1F5F9" : "rgba(255,255,255,0.05)", color: activeChart === k ? "white" : isIndique ? "#64748B" : "rgba(255,255,255,0.4)" }}>
                    {chartLabels[k]}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="indicadorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors[activeChart]} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={chartColors[activeChart]} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isIndique ? "rgba(148,163,184,0.22)" : "rgba(255,255,255,0.05)"} vertical={false}/>
                <XAxis dataKey="date" tickFormatter={fmtWeek} tick={{ fontSize: 10, fill: isIndique ? "#64748B" : "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={v => [fmtBRL(v), chartLabels[activeChart]]} labelFormatter={l => fmtDate(l)}
                  contentStyle={{ background: isIndique ? "#FFFFFF" : "#14161F", border: isIndique ? "1px solid #E2E8F0" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: isIndique ? "#101828" : "#FFFFFF" }}/>
                <Area type="monotone" dataKey={activeChart} stroke={chartColors[activeChart]} strokeWidth={2.5} fill="url(#indicadorGrad)"
                  dot={{ r: 3, fill: chartColors[activeChart], strokeWidth: 0 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {byDay.length > 0 && (
          <div className={`${panelClass} rounded-2xl p-5`}>
            <div className={`mb-4 text-xs font-black uppercase ${mutedText}`}>Indicações e agenciados por dia</div>
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={byDay} barCategoryGap="30%">
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 9, fill: isIndique ? "#64748B" : "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip formatter={(v, name) => [v, name]} labelFormatter={l => fmtDate(l)}
                  contentStyle={{ background: isIndique ? "#FFFFFF" : "#14161F", border: isIndique ? "1px solid #E2E8F0" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: isIndique ? "#101828" : "#FFFFFF" }}/>
                <Bar dataKey="converted" name="Agenciados" fill="#10B981" radius={[4, 4, 0, 0]}/>
                <Line type="monotone" dataKey="n" name="Indicações" stroke="#2563EB" strokeWidth={2.5}
                  dot={{ r: 3, fill: "#2563EB", strokeWidth: 0 }} activeDot={{ r: 4 }}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`${panelClass} overflow-hidden rounded-2xl`}>
          <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 ${isIndique ? "border-slate-100" : "border-white/5"}`}>
            <span className={`text-xs font-black uppercase ${mutedText}`}>
              {displayHandle === "amplify" ? `Todas as ${s.total || 0} indicações` : `Suas ${s.total || 0} indicações`}
            </span>
            <label className={`flex items-center gap-2 text-xs ${mutedText}`}>
              Status
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className={`min-w-[210px] rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${isIndique ? "border-slate-200 bg-white text-slate-950 focus:border-[#2563EB]" : "border-white/10 bg-[#0A0B12] text-white focus:border-[#2F6BFF]"}`}>
                <option value="all">Todos ({s.total || 0})</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status} ({s.byStatus[status]})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={tableHeadBg}>
                <tr>
                  {tableColumns.map((column) => (
                    <th key={column.key} className={`px-4 py-3 text-[10px] font-black uppercase ${mutedText} ${column.align === "right" ? "text-right" : "text-left"}`}>
                      <button type="button" onClick={() => toggleSort(column.key)}
                        className={`inline-flex items-center gap-1 transition-colors ${isIndique ? "hover:text-slate-950" : "hover:text-white"} ${column.align === "right" ? "justify-end" : "justify-start"}`}>
                        {column.label}
                        <span className={isIndique ? "text-slate-300" : "text-white/25"}>
                          {sortConfig.key === column.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={tableDivider}>
                {sortedLeads.map((lead) => (
                  <tr key={lead.id} className={`transition-colors ${isIndique ? "hover:bg-slate-50" : "hover:bg-white/5"}`}>
                    <td className={`whitespace-nowrap px-4 py-3 font-mono text-sm ${isIndique ? "text-slate-500" : "text-white/55"}`}>{fmtTableDate(lead.createdDate || lead.created)}</td>
                    <td className={`px-4 py-3 font-mono text-sm ${isIndique ? "text-slate-600" : "text-white/50"}`}>{lead.handle || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                        style={{ background: (STATUS_COLOR[lead.status] || "#9CA3AF") + "22", color: STATUS_COLOR[lead.status] || "#9CA3AF" }}>
                        {lead.status || "Sem status"}
                      </span>
                    </td>
                    <td className={`max-w-[160px] truncate px-4 py-3 text-sm font-semibold ${strongMutedText}`}>
                      {lead.gmvRange || "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#E91E63]">
                      {fmtBRL(lead.generatedCommission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
