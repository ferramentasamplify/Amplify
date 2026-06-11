"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/config";

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n, dec = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtBRL = (n) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (n) => (n == null ? "—" : `${Number(n).toFixed(2)}%`);

const toLocalDate = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");

// ─── KPI Card ────────────────────────────────────────────────
function KPI({ label, value, sub, color = "#25F4EE" }) {
  return (
    <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-3xl font-extrabold tracking-tight" style={{ color }}>
        {value}
      </span>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  );
}

// ─── Cores por campanha ──────────────────────────────────────
const CAMP_COLORS = [
  "#25F4EE", "#EA1A4E", "#1742E6", "#10b981",
  "#f97316", "#a855f7", "#eab308", "#64748b",
];
function campColor(name, idx) {
  if (name.toLowerCase().includes("marca")) return "#EA1A4E";
  if (name.toLowerCase().includes("farm"))  return "#25F4EE";
  if (name.toLowerCase().includes("winner")) return "#1742E6";
  return CAMP_COLORS[idx % CAMP_COLORS.length];
}

// ─── Componente principal ─────────────────────────────────────
export default function MetaAdsView() {
  const pathname = usePathname();

  // Datas: padrão últimos 7 dias
  const today = toLocalDate(new Date());
  const minus7 = toLocalDate(new Date(Date.now() - 7 * 86400000));

  const [since, setSince] = useState(minus7);
  const [until, setUntil] = useState(today);
  const [level, setLevel] = useState("ad");
  const [data,  setData]  = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [search,  setSearch]  = useState("");
  const [expandedCamps, setExpandedCamps] = useState(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/meta?since=${since}&until=${until}&level=${level}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []);
      setTotals(json.totals || null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [since, until, level]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Preset buttons ──────────────────────────────────────
  const applyPreset = (days) => {
    const u = toLocalDate(new Date());
    const s = toLocalDate(new Date(Date.now() - days * 86400000));
    setSince(s);
    setUntil(u);
  };

  // ─── Sort ─────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sorted = [...data]
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        r.campaign_name.toLowerCase().includes(q) ||
        r.adset_name.toLowerCase().includes(q) ||
        r.ad_name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const va = a[sortCol] ?? -Infinity;
      const vb = b[sortCol] ?? -Infinity;
      return sortDir === "asc" ? va - vb : vb - va;
    });

  // Agrupar por campanha para exibição
  const byCampaign = sorted.reduce((acc, r) => {
    const k = r.campaign_name;
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  const campNames = Object.keys(byCampaign);

  const toggleCamp = (name) => {
    setExpandedCamps((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-white/20 ml-1">↕</span>;
    return <span className="ml-1 text-[#25F4EE]">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const thClass = "px-3 py-3 text-left text-xs font-mono uppercase tracking-wider text-white/40 cursor-pointer hover:text-white/70 select-none whitespace-nowrap";
  const tdClass = "px-3 py-3 text-sm text-white/80 whitespace-nowrap";

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">

      {/* ── Nav ── */}
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
          {NAV_TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${pathname === t.href
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <span>{t.icon}</span> {t.label}
            </Link>
          ))}
          <Link
            href="/meta"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${pathname === "/meta"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            <span>📣</span> Meta Ads
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header + controles ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Performance</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Meta Ads</h1>
            {lastUpdated && (
              <p className="text-xs text-white/30 mt-1">
                Atualizado às {lastUpdated.toLocaleTimeString("pt-BR")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Presets */}
            {[
              { label: "Hoje",    days: 0 },
              { label: "7 dias",  days: 7 },
              { label: "30 dias", days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => days === 0 ? (setSince(today), setUntil(today)) : applyPreset(days)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 text-white/60 hover:border-[#25F4EE] hover:text-[#25F4EE] transition-colors"
              >
                {label}
              </button>
            ))}

            {/* Range customizado */}
            <div className="flex items-center gap-2 bg-[#14161F] border border-white/10 rounded-xl px-3 py-1.5">
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="bg-transparent text-sm text-white/70 focus:outline-none"
              />
              <span className="text-white/30 text-xs">→</span>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="bg-transparent text-sm text-white/70 focus:outline-none"
              />
            </div>

            {/* Level */}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="bg-[#14161F] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-[#25F4EE]"
            >
              <option value="ad">Por anúncio</option>
              <option value="adset">Por conjunto</option>
              <option value="campaign">Por campanha</option>
            </select>

            <button
              onClick={fetchData}
              className="px-4 py-1.5 rounded-xl bg-[#1742E6] text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
            >
              ↻ Atualizar
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* ── KPIs ── */}
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KPI label="Gasto"        value={fmtBRL(totals.spend)}      color="#EA1A4E" />
            <KPI label="Leads"        value={fmt(totals.leads)}          color="#25F4EE" />
            <KPI label="CPL"          value={fmtBRL(totals.cpl)}         color="#25F4EE" />
            <KPI label="Impressões"   value={fmt(totals.impressions)}    color="#fff" />
            <KPI label="Alcance"      value={fmt(totals.reach)}          color="#fff" />
            <KPI label="Freq."        value={fmt(totals.frequency, 2)}   color="#f97316" />
            <KPI label="Cliques"      value={fmt(totals.clicks)}         color="#fff" />
            <KPI label="CTR"          value={fmtPct(totals.ctr)}         color={totals.ctr > 1 ? "#10b981" : "#f97316"} />
          </div>
        )}

        {/* ── Busca ── */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar campanha, conjunto ou anúncio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[#14161F] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#25F4EE]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-white/40 hover:text-white text-sm">
              ✕ Limpar
            </button>
          )}
        </div>

        {/* ── Tabela ── */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">
            Carregando dados do Meta Ads…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/30 text-sm">
            Nenhum dado encontrado para o período selecionado.
          </div>
        ) : (
          <div className="space-y-4">
            {campNames.map((campName, ci) => {
              const rows = byCampaign[campName];
              const isExpanded = expandedCamps.has(campName);
              const color = campColor(campName, ci);

              // Totais da campanha
              const ct = rows.reduce(
                (acc, r) => ({
                  impressions: acc.impressions + r.impressions,
                  reach:       acc.reach       + r.reach,
                  clicks:      acc.clicks      + r.clicks,
                  spend:       acc.spend       + r.spend,
                  leads:       acc.leads       + r.leads,
                }),
                { impressions: 0, reach: 0, clicks: 0, spend: 0, leads: 0 }
              );
              ct.ctr = ct.impressions > 0 ? (ct.clicks / ct.impressions) * 100 : 0;
              ct.cpm = ct.impressions > 0 ? (ct.spend / ct.impressions) * 1000 : 0;
              ct.cpc = ct.clicks > 0 ? ct.spend / ct.clicks : 0;
              ct.cpl = ct.leads  > 0 ? ct.spend / ct.leads  : null;
              ct.frequency = ct.reach > 0 ? ct.impressions / ct.reach : 0;

              return (
                <div key={campName} className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden">

                  {/* Cabeçalho da campanha */}
                  <button
                    onClick={() => toggleCamp(campName)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="font-semibold text-sm text-white">{campName}</span>
                      <span className="text-xs text-white/30 font-mono">{rows.length} anúncios</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-white/50 font-mono">{fmtBRL(ct.spend)}</span>
                      <span style={{ color }} className="font-bold font-mono">
                        {ct.leads} leads
                      </span>
                      {ct.cpl != null && (
                        <span className="text-white/40 font-mono text-xs">CPL {fmtBRL(ct.cpl)}</span>
                      )}
                      <span className="text-white/30 text-lg">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Tabela detalhada */}
                  {isExpanded && (
                    <div className="overflow-x-auto border-t border-white/10">
                      <table className="w-full">
                        <thead className="bg-[#0A0B12]">
                          <tr>
                            {level === "ad"    && <th className={thClass}>Anúncio</th>}
                            {level !== "campaign" && level !== "ad" && <th className={thClass}>Conjunto</th>}
                            <th className={thClass} onClick={() => handleSort("spend")}>Gasto <SortIcon col="spend"/></th>
                            <th className={thClass} onClick={() => handleSort("leads")}>Leads <SortIcon col="leads"/></th>
                            <th className={thClass} onClick={() => handleSort("cpl")}>CPL <SortIcon col="cpl"/></th>
                            <th className={thClass} onClick={() => handleSort("impressions")}>Impress. <SortIcon col="impressions"/></th>
                            <th className={thClass} onClick={() => handleSort("reach")}>Alcance <SortIcon col="reach"/></th>
                            <th className={thClass} onClick={() => handleSort("frequency")}>Freq. <SortIcon col="frequency"/></th>
                            <th className={thClass} onClick={() => handleSort("clicks")}>Cliques <SortIcon col="clicks"/></th>
                            <th className={thClass} onClick={() => handleSort("ctr")}>CTR <SortIcon col="ctr"/></th>
                            <th className={thClass} onClick={() => handleSort("cpm")}>CPM <SortIcon col="cpm"/></th>
                            <th className={thClass} onClick={() => handleSort("cpc")}>CPC <SortIcon col="cpc"/></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                              {level === "ad" && (
                                <td className={tdClass}>
                                  <span className="max-w-[200px] block truncate" title={r.ad_name}>
                                    {r.ad_name}
                                  </span>
                                  <span className="text-xs text-white/30">{r.adset_name}</span>
                                </td>
                              )}
                              {level !== "campaign" && level !== "ad" && (
                                <td className={tdClass}>{r.adset_name}</td>
                              )}
                              <td className={`${tdClass} font-mono`}>{fmtBRL(r.spend)}</td>
                              <td className={`${tdClass} font-bold`} style={{ color: r.leads > 0 ? color : "rgba(255,255,255,0.3)" }}>
                                {r.leads || "—"}
                              </td>
                              <td className={`${tdClass} font-mono`}>{r.cpl != null ? fmtBRL(r.cpl) : "—"}</td>
                              <td className={`${tdClass} font-mono`}>{fmt(r.impressions)}</td>
                              <td className={`${tdClass} font-mono`}>{fmt(r.reach)}</td>
                              <td className={`${tdClass} font-mono`}>{fmt(r.frequency, 2)}</td>
                              <td className={`${tdClass} font-mono`}>{fmt(r.clicks)}</td>
                              <td className={`${tdClass} font-mono`} style={{ color: r.ctr > 1 ? "#10b981" : r.ctr > 0.5 ? "#f97316" : "#ef4444" }}>
                                {fmtPct(r.ctr)}
                              </td>
                              <td className={`${tdClass} font-mono`}>{fmtBRL(r.cpm)}</td>
                              <td className={`${tdClass} font-mono`}>{fmtBRL(r.cpc)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
