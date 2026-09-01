"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
const fmtDecimal = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateParts = (iso) => {
  const [year, month, day] = String(iso || "").slice(0, 10).split("-").map(Number);
  return year && month && day ? { year, month, day } : null;
};
const fmtDate = (iso) => {
  const parts = dateParts(iso);
  if (!parts) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
};
const fmtWeek = (iso) => {
  const parts = dateParts(iso);
  return parts ? `${parts.day}/${parts.month}` : "-";
};
const fmtTableDate = (value) => {
  const date = String(value || "").slice(0, 10);
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
};
const isAgenciado = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "agenciado" || normalized === "convite aceito";
};
const isConvertido = (status) => {
  return isAgenciado(status);
};
const normalizeSearch = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/^@/, "")
  .trim();
const SUPER_AFILIADO_UTMS = new Set([
  "giselecorreia",
  "jota_",
  "andreeleia_",
  "glow.fit1",
  "alex_",
  "marinaportelach",
  "alwaysfit",
  "laizmacaneiro",
]);
const isSuperAfiliadoUtm = (utm) => SUPER_AFILIADO_UTMS.has(normalizeSearch(utm));
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const monthStartISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};
const tableColumns = [
  { key: "date", label: "Data" },
  { key: "handle", label: "@ TikTok" },
  { key: "status", label: "Status" },
  { key: "gmvRange", label: "Faixa GMV" },
  { key: "generatedCommission", label: "Comissao", align: "right" },
];
const utmCommissionColumns = [
  { key: "utm", label: "Indicador" },
  { key: "total", label: "Indicações", align: "right" },
  { key: "agenciados", label: "Agenciados", align: "right" },
  { key: "generatedCommission", label: "Comissao Total", align: "right" },
];

export default function IndiqueEGanheView() {
  const pathname = usePathname();
  const router = useRouter();
  const defaultStartDate = monthStartISO();
  const defaultEndDate = todayISO();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [applied, setApplied] = useState({ start: defaultStartDate, end: defaultEndDate });
  const [activeChart, setActiveChart] = useState("indiqueEarn");
  const [tableMode, setTableMode] = useState("leads");
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });

  useEffect(() => {
    const params = new URLSearchParams();
    if (applied.start) params.set("startDate", applied.start);
    if (applied.end) params.set("endDate", applied.end);
    fetch(`/api/indiqueeganhe-full?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar."); setLoading(false); });
  }, [applied]);

  useEffect(() => {
    setSelectedCreator(null);
    setStatusFilter("all");
  }, [creatorFilter]);

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setCreatorFilter("");
    setStatusFilter("all");
    setSelectedCreator(null);
    if (applied.start || applied.end) {
      setLoading(true);
      setError("");
      setApplied({ start: "", end: "" });
    }
  }

  const { leads = [], weeklyData = [], weeklyDataByCreator = {} } = data || {};
  const creatorOptions = useMemo(() => {
    return [...new Set(leads.map(l => String(l.utm || "").trim()).filter(utm => utm && !isSuperAfiliadoUtm(utm)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [leads]);
  const scopedLeads = useMemo(() => {
    const query = normalizeSearch(creatorFilter);
    if (!query) return leads;
    return leads.filter(l => normalizeSearch(l.utm).includes(query));
  }, [creatorFilter, leads]);
  const s = useMemo(() => {
    const byStatus = scopedLeads.reduce((acc, lead) => {
      const status = lead.status || "Sem status";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const leadsWithGmv = scopedLeads.filter(l => l.gmv > 0).length;
    const totalAgenciados = scopedLeads.filter(l => isAgenciado(l.status)).length;
    const activeDays = new Set(scopedLeads.map(l => l.createdDate || l.created?.slice(0, 10)).filter(Boolean)).size;
    const totalGmv = scopedLeads.reduce((sum, lead) => sum + Number(lead.gmv || 0), 0);
    const totalCom = scopedLeads.reduce((sum, lead) => sum + Number(lead.comissao || 0), 0);
    const totalGeneratedCommission = scopedLeads.reduce((sum, lead) => {
      return isAgenciado(lead.status) ? sum + Number(lead.generatedCommission || 0) : sum;
    }, 0);
    return {
      total: scopedLeads.length,
      totalAgenciados,
      avgEntriesPerDay: activeDays ? scopedLeads.length / activeDays : 0,
      conversionRate: scopedLeads.length ? Math.round(totalAgenciados / scopedLeads.length * 100) : 0,
      totalGeneratedCommission,
      leadsWithGmv,
      matchRate: scopedLeads.length ? Math.round(leadsWithGmv / scopedLeads.length * 100) : 0,
      totalGmv,
      totalCom,
      indiqueEarn: totalCom * 0.10 * 0.20,
      byStatus,
    };
  }, [scopedLeads]);
  const byDay = useMemo(() => {
    const grouped = scopedLeads.reduce((acc, lead) => {
      const date = lead.createdDate || lead.created?.slice(0, 10);
      if (!date) return acc;
      if (!acc[date]) acc[date] = { n: 0, converted: 0 };
      acc[date].n += 1;
      if (isConvertido(lead.status)) acc[date].converted += 1;
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [scopedLeads]);
  const scopedWeeklyData = useMemo(() => {
    if (!creatorFilter.trim()) return weeklyData;
    const byDate = {};
    scopedLeads.forEach((lead) => {
      const points = weeklyDataByCreator[lead.handle] || [];
      points.forEach((point) => {
        if (!byDate[point.date]) byDate[point.date] = { date: point.date, gmv: 0, comissao: 0, indiqueEarn: 0 };
        byDate[point.date].gmv += Number(point.gmv || 0);
        byDate[point.date].comissao += Number(point.comissao || 0);
        byDate[point.date].indiqueEarn += Number(point.indiqueEarn || 0);
      });
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [creatorFilter, scopedLeads, weeklyData, weeklyDataByCreator]);
  const statuses = Object.keys(s?.byStatus || {}).sort();
  const filtered = scopedLeads.filter(l => statusFilter === "all" ? true : (l.status || "Sem status") === statusFilter);
  const utmCommissionRows = useMemo(() => {
    const grouped = scopedLeads.reduce((acc, lead) => {
      const utm = String(lead.utm || "").trim() || "Sem UTM";
      if (!acc[utm]) acc[utm] = { utm, total: 0, agenciados: 0, generatedCommission: 0 };
      acc[utm].total += 1;
      if (isAgenciado(lead.status)) {
        acc[utm].agenciados += 1;
        acc[utm].generatedCommission += Number(lead.generatedCommission || 0);
      }
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => {
      return b.generatedCommission - a.generatedCommission || b.agenciados - a.agenciados || a.utm.localeCompare(b.utm, "pt-BR");
    });
  }, [scopedLeads]);
  const sortedLeads = useMemo(() => {
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;
    const valueFor = (lead) => {
      if (key === "date") return lead.createdDate || lead.created?.slice(0, 10) || "";
      if (key === "generatedCommission") return Number(lead.generatedCommission || 0);
      if (key === "status") return lead.status || "Sem status";
      if (key === "gmvRange") return lead.gmvRange || "Não informado";
      return lead.handle || "";
    };

    return [...filtered].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "number" || typeof bv === "number") return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [filtered, sortConfig]);
  function toggleSort(key) {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }
  const sortedUtmCommissionRows = useMemo(() => {
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;
    const valueFor = (row) => {
      if (key === "total" || key === "agenciados" || key === "generatedCommission") return Number(row[key] || 0);
      return row.utm || "";
    };

    return [...utmCommissionRows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "number" || typeof bv === "number") return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [sortConfig, utmCommissionRows]);
  const currentTableColumns = tableMode === "utmCommission" ? utmCommissionColumns : tableColumns;
  const currentTableTotal = tableMode === "utmCommission" ? sortedUtmCommissionRows.length : sortedLeads.length;
  async function exportCurrentTable() {
    const XLSX = await import("xlsx");
    const rows = tableMode === "utmCommission"
      ? sortedUtmCommissionRows.map(row => ({
          Indicador: row.utm,
          Indicacoes: row.total,
          Agenciados: row.agenciados,
          "Comissao Total": row.generatedCommission,
        }))
      : sortedLeads.map(lead => ({
          Data: fmtTableDate(lead.createdDate || lead.created),
          "@ TikTok": lead.handle || "",
          Status: lead.status || "Sem status",
          "Faixa GMV": lead.gmvRange || "Não informado",
          Comissao: Number(lead.generatedCommission || 0),
          UTM_Source: lead.utm || "",
        }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableMode === "utmCommission" ? "Comissao por Indicador" : "Indicacoes");
    XLSX.writeFile(workbook, `indique-e-ganhe-${tableMode === "utmCommission" ? "comissao-indicador" : "indicacoes"}.xlsx`);
  }
  async function logout() {
    await fetch("/api/indiqueeganhe-admin/logout", { method: "POST" });
    router.push("/indiqueeganhe/login");
    router.refresh();
  }
  const chartColors = { gmv: "#1B3FE4", indiqueEarn: "#EAB308" };
  const chartLabels = { gmv: "GMV dos creators", indiqueEarn: "Comissão Indique" };
  const activeData = selectedCreator && weeklyDataByCreator[selectedCreator.handle] ? weeklyDataByCreator[selectedCreator.handle] : scopedWeeklyData;

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
          <button onClick={logout} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap">
            Sair
          </button>
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
            <label htmlFor="creator-filter" className="text-xs text-white/40">Criador:</label>
            <input id="creator-filter" list="creator-options" value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}
              placeholder="Digite UTM"
              className="bg-[#14161F] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#EAB308] max-w-[190px]"/>
            <datalist id="creator-options">
              {creatorOptions.map(creator => (
                <option key={creator} value={creator}>{creator}</option>
              ))}
            </datalist>
            <button onClick={() => { setLoading(true); setError(""); setApplied({ start: startDate, end: endDate }); }}
              className="px-3 py-1.5 rounded-lg bg-[#EAB308] text-black text-xs font-bold hover:opacity-90">
              Filtrar
            </button>
            {(applied.start || applied.end || creatorFilter.trim()) && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-bold">x Limpar</button>
            )}
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 text-red-300 text-sm">Aviso: {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Carregando...</div>
        ) : s && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Total Indicações", value: String(s.total), color: "#fff" },
                { label: "Média Entradas/Dia", value: fmtDecimal(s.avgEntriesPerDay), color: "#25F4EE" },
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
                <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Indicações e agenciados por dia</div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={byDay} barCategoryGap="30%">
                    <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false}/>
                    <YAxis hide/>
                    <Tooltip formatter={(v, name) => [v, name]} labelFormatter={l => fmtDate(l)}
                      contentStyle={{ background: "#14161F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}/>
                    <Bar dataKey="converted" name="Agenciados" fill="#10B981" radius={[4, 4, 0, 0]}/>
                    <Line type="monotone" dataKey="n" name="Indicações" stroke="#EAB308" strokeWidth={2.5}
                      dot={{ r: 3, fill: "#EAB308", strokeWidth: 0 }} activeDot={{ r: 4 }}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                    {tableMode === "utmCommission" ? `${currentTableTotal} indicadores com comissão` : `Todas as ${s.total} indicações`}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/40">
                      Visualização
                      <select value={tableMode} onChange={e => {
                        setTableMode(e.target.value);
                        setSortConfig(e.target.value === "utmCommission"
                          ? { key: "generatedCommission", direction: "desc" }
                          : { key: "date", direction: "desc" });
                      }}
                        className="min-w-[210px] rounded-lg border border-white/10 bg-[#0A0B12] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#EAB308]">
                        <option value="leads">Indicações detalhadas</option>
                        <option value="utmCommission">Comissão total por Indicador</option>
                      </select>
                    </label>
                    {tableMode === "leads" && (
                      <label className="flex items-center gap-2 text-xs text-white/40">
                        Status
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                          className="min-w-[210px] rounded-lg border border-white/10 bg-[#0A0B12] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#EAB308]">
                          <option value="all">Todos ({s.total})</option>
                          {statuses.map(status => (
                            <option key={status} value={status}>{status} ({s.byStatus[status]})</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button type="button" onClick={exportCurrentTable}
                      className="px-3 py-2 rounded-lg bg-[#EAB308] text-black text-xs font-bold hover:opacity-90">
                      Exportar Excel
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0A0B12]">
                      <tr>
                        {currentTableColumns.map((column) => (
                          <th key={column.key} className={`px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-white/40 ${column.align === "right" ? "text-right" : "text-left"}`}>
                            <button type="button" onClick={() => toggleSort(column.key)}
                              className={`inline-flex items-center gap-1 transition-colors hover:text-white ${column.align === "right" ? "justify-end" : "justify-start"}`}>
                              {column.label}
                              <span className="text-white/25">
                                {sortConfig.key === column.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tableMode === "utmCommission" ? (
                        sortedUtmCommissionRows.map((row) => (
                          <tr key={row.utm} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-sm text-white/65 font-mono">{row.utm}</td>
                            <td className="px-4 py-3 text-sm text-white/55 text-right font-semibold">{row.total}</td>
                            <td className="px-4 py-3 text-sm text-[#10B981] text-right font-semibold">{row.agenciados}</td>
                            <td className="px-4 py-3 text-sm font-bold text-right text-[#EAB308]">{fmtBRL(row.generatedCommission)}</td>
                          </tr>
                        ))
                      ) : (
                        sortedLeads.map((l) => (
                          <tr key={l.id}
                            onClick={() => l.gmv > 0 && setSelectedCreator(selectedCreator?.id === l.id ? null : l)}
                            className={`hover:bg-white/5 transition-colors ${l.gmv > 0 ? "cursor-pointer" : ""}`}
                            style={{ borderLeft: selectedCreator?.id === l.id ? "2px solid #EAB308" : "2px solid transparent" }}>
                            <td className="px-4 py-3 text-sm text-white/55 font-mono whitespace-nowrap">{fmtTableDate(l.createdDate || l.created)}</td>
                            <td className="px-4 py-3 text-sm text-white/50 font-mono">{l.handle || "-"}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                                style={{ background: (STATUS_COLOR[l.status] || "#9CA3AF") + "22", color: STATUS_COLOR[l.status] || "#9CA3AF" }}>
                                {l.status || "Sem status"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-white/65 max-w-[160px] truncate">
                              {l.gmvRange || "Não informado"}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-right text-[#EAB308]">
                              {fmtBRL(l.generatedCommission)}
                            </td>
                          </tr>
                        ))
                      )}
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
