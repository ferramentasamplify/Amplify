"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { NAV_TABS } from "@/lib/config";
import { getAmForHandle } from "@/lib/carteiras";
import { tiktokProfileUrl } from "@/lib/tiktok-profile-url";

const fmtBRL  = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtBRLd = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSignedBRL = (n) => {
  const value = Number(n || 0);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}R$ ${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtWeek = (iso) => { const d = new Date(iso + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtFullDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "sem data";
const toLocal = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const CAT_CONFIG = {
  Diamond: { color: "#2563EB", badge: "💎" },
  Gold:    { color: "#D97706", badge: "🥇" },
  Silver:  { color: "#64748B", badge: "🥈" },
  Start:   { color: "#1B3FE4", badge: "🚀" },
  Safira:  { color: "#7C3AED", badge: "💜" },
  Royal:   { color: "#F43F5E", badge: "👑" },
  Origens: { color: "#059669", badge: "🌱" },
};

const LIGA_77_URL = "https://liga77-retencao.netlify.app";
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

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
        <div className="h-40 flex items-center justify-center text-sm text-white/40">Carregando TikTok Shop Retenção...</div>
      </section>
    );
  }

  if (error || !data?.totals || data?.kind !== "tiktok_shop_retencao_dashboard") {
    return (
      <section id="virada-club-dashboard" className="bg-[#10141E] border border-red-500/30 rounded-lg p-6 text-sm text-red-300">
        {error || "Dashboard TikTok Shop indisponivel."}
      </section>
    );
  }

  const latest = data.monthly?.at(-1) || {};
  const sourceMix = data.source_mix?.at(-1) || {};
  const topCreators = data.top_creators || [];
  const topProducts = data.top_products || [];
  const topVideos = data.top_videos || [];
  const topLives = data.top_lives || [];
  const statusOk = data.status === "OK";

  return (
    <section id="virada-club-dashboard" className="bg-[#10141E] border border-white/10 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Partner Center · Retenção</p>
          <h2 className="text-xl font-extrabold tracking-tight">TikTok Shop Retenção</h2>
          <p className="text-xs text-white/40 mt-1">
            Ref: <strong className="text-white/80">{data.reference?.label || "Jan-Jul/2026"}</strong>
            {data.generated_at ? ` · atualizado ${new Date(data.generated_at).toLocaleString("pt-BR")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${statusOk ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-300" : "bg-amber-500/10 border-amber-400/20 text-amber-300"}`}>
            Status {data.status || "DEGRADED"}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            {data.version || "sem versao"}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          {[
            { label: "GMV oficial", value: fmtBRLd(data.totals.latest_gmv), color: "#10b981" },
            { label: "Comissão estimada", value: fmtBRLd(data.totals.latest_commission), color: "#25F4EE" },
            { label: "Pedidos", value: fmtInt(data.totals.latest_orders), color: "#fff" },
            { label: "Creators", value: fmtInt(data.totals.latest_creators), color: "#a855f7" },
            { label: "Com venda", value: fmtInt(data.totals.latest_partners_with_sales), color: "#f59e0b" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {!statusOk && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Última atualização falhou ou ficou parcial. Exibindo a última versão aprovada: {data.version || "sem versão"}.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-4">
          <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold">Evolução mensal oficial</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">GMV e comissão</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000000)}M`} tick={{ fill: "rgba(255,255,255,.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#10141E", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, color: "#fff" }}
                    formatter={(value, name) => [fmtBRLd(value), name === "official_gmv" ? "GMV" : "Comissão"]}
                  />
                  <Area type="monotone" dataKey="official_gmv" stroke="#10b981" fill="#10b98122" strokeWidth={2} />
                  <Area type="monotone" dataKey="official_commission_estimated" stroke="#25F4EE" fill="#25F4EE18" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold">Mix por origem</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">diagnóstico</span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Live", value: sourceMix.live_revenue, share: sourceMix.live_share, color: "#25F4EE" },
                { label: "Vídeo", value: sourceMix.video_revenue, share: sourceMix.video_share, color: "#a855f7" },
                { label: "Product card", value: sourceMix.product_card_revenue, share: sourceMix.product_card_share, color: "#f59e0b" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1">
                    <span className="font-bold text-white/80">{item.label}</span>
                    <span className="font-mono text-white/60">{fmtBRL(item.value)} · {fmtPct(item.share)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, Number(item.share || 0) * 100)}%`, background: item.color }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-white/35 pt-2">
                Esta quebra vem de `home_shop_aggregation` e fica marcada como diagnóstico; não substitui o GMV oficial.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0A0B12] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">Top creators do mês</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">{latest.month}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-white/[0.02]">
                <tr>
                  {["#", "Creator", "GMV", "Comissão", "Pedidos", "Live", "Vídeo"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topCreators.slice(0, 10).map((c) => (
                  <tr key={`${c.month}-${c.creator_id}`} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-sm font-mono text-white/40">{c.gmv_rank}</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">
                      <a href={tiktokProfileUrl(c.creator_name)} target="_blank" rel="noreferrer" className="hover:text-[#25F4EE] hover:underline">
                        @{c.creator_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-300">{fmtBRL(c.gmv)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-cyan-300">{fmtBRL(c.commission_estimated)}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{fmtInt(c.orders)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-white/60">{fmtBRL(c.live_gmv)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-white/60">{fmtBRL(c.video_gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {[
            { title: "Produtos", rows: topProducts, keyField: "product_id", nameField: "product_name", metric: "attributed_gmv", rank: "product_rank" },
            { title: "Vídeos", rows: topVideos, keyField: "video_id", nameField: "video_title", metric: "video_gmv", rank: "video_rank" },
            { title: "Lives", rows: topLives, keyField: "live_id", nameField: "live_title", metric: "attributed_gmv", rank: "live_rank" },
          ].map((block) => (
            <div key={block.title} className="rounded-lg border border-white/10 bg-[#0A0B12] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold">Top {block.title}</h3>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Top 5</span>
              </div>
              <div className="divide-y divide-white/5">
                {block.rows.slice(0, 5).map((row) => (
                  <div key={`${block.title}-${row[block.keyField]}`} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{row[block.rank]}. {row[block.nameField] || row.creator_username || row.creator_nickname}</div>
                        <div className="text-xs text-white/35 truncate">{row.creator_username || row.creator_nickname || row.shop_name || row.video_create_time || row.start_time}</div>
                      </div>
                      <div className="text-sm font-mono text-emerald-300 shrink-0">{fmtBRL(row[block.metric])}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const CATEGORY_ORDER = ["Start", "Silver", "Gold", "Diamond", "Safira", "Royal"];

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const categoryForGmv = (gmv) => {
  const value = Number(gmv || 0);
  if (value >= 1000000) return "Royal";
  if (value >= 500000) return "Safira";
  if (value >= 100000) return "Diamond";
  if (value >= 30000) return "Gold";
  if (value >= 5000) return "Silver";
  return "Start";
};

const normalizeCreator = (creator, index = 0) => {
  const name = creator.creator_name || creator.nome || creator.handle || "sem nome";
  const handle = String(name || "").replace(/^@/, "").toLowerCase();
  const gmv = Number(creator.gmv || 0);
  const commission = Number(creator.commission_estimated || creator.comissao || 0);
  const commissionBase = Number(creator.commission_base || creator.commissionBase || gmv || 0);
  return {
    creator_id: creator.creator_id || creator.id || `${handle}-${index}`,
    creator_name: name,
    handle,
    gmv,
    commission_estimated: commission,
    amplify_commission: Number(creator.amplify_commission || commission * 0.1),
    orders: Number(creator.orders || 0),
    live_gmv: Number(creator.live_gmv || creator.liveGmv || 0),
    video_gmv: Number(creator.video_gmv || creator.videoGmv || 0),
    direct_gmv: Number(creator.direct_gmv || creator.directGmv || 0),
    avg_commission_rate: commissionBase > 0 ? commission / commissionBase : 0,
    notion_url: creator.notion_url || creator.notionUrl || "",
    category: creator.category || creator.categoria || categoryForGmv(gmv),
    rank: Number(creator.rank || creator.gmv_rank || index + 1),
  };
};

const summarizeCreators = (creators) => {
  const sorted = creators
    .map(normalizeCreator)
    .sort((a, b) => b.gmv - a.gmv)
    .map((creator, index) => ({ ...creator, rank: index + 1 }));
  const totals = sorted.reduce((acc, creator) => {
    acc.latest_gmv += creator.gmv;
    acc.latest_commission += creator.commission_estimated;
    acc.latest_amplify_commission += creator.amplify_commission;
    acc.latest_orders += creator.orders;
    acc.live_gmv += creator.live_gmv;
    acc.video_gmv += creator.video_gmv;
    acc.direct_gmv += creator.direct_gmv;
    if (creator.gmv > 0) acc.latest_partners_with_sales += 1;
    return acc;
  }, {
    latest_gmv: 0,
    latest_commission: 0,
    latest_amplify_commission: 0,
    latest_orders: 0,
    live_gmv: 0,
    video_gmv: 0,
    direct_gmv: 0,
    latest_partners_with_sales: 0,
  });
  totals.latest_creators = sorted.length;
  totals.latest_average_commission_rate = totals.latest_gmv > 0 ? totals.latest_commission / totals.latest_gmv : 0;

  const categories = CATEGORY_ORDER.map((name) => {
    const rows = sorted.filter((creator) => creator.category === name);
    const gmv = rows.reduce((acc, creator) => acc + creator.gmv, 0);
    const commission = rows.reduce((acc, creator) => acc + creator.commission_estimated, 0);
    const orders = rows.reduce((acc, creator) => acc + creator.orders, 0);
    const top5Gmv = rows.slice(0, 5).reduce((acc, creator) => acc + creator.gmv, 0);
    return {
      name,
      creator_count: rows.length,
      active_count: rows.filter((creator) => creator.gmv > 0).length,
      gmv,
      commission_estimated: commission,
      amplify_commission: commission * 0.1,
      orders,
      avg_commission_rate: gmv > 0 ? commission / gmv : 0,
      share: totals.latest_gmv > 0 ? gmv / totals.latest_gmv : 0,
      top5_share: gmv > 0 ? top5Gmv / gmv : 0,
    };
  });

  return { creators: sorted, totals, categories };
};

const findSnapshotAtOrBefore = (snapshots, iso) =>
  snapshots.filter((snapshot) => snapshot.period_end <= iso).at(-1) || null;

const clampISO = (iso, min, max) => {
  if (!iso) return iso;
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
};

const startOfWeekISO = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
};

const startOfMonthISO = (iso) => `${iso.slice(0, 7)}-01`;

const daysInMonth = (monthISO) => {
  const [year, month] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

function PartnerCenterDateSelector({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onApply,
  onClear,
  hasAppliedPeriod,
  loading,
  periodSelector,
  loadSelector,
  reference,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("custom");
  const availableDates = (periodSelector?.available_dates || []).slice().sort();
  const minDate = availableDates[0] || reference?.period_start || startDate;
  const maxDate = availableDates.at(-1) || reference?.period_end || endDate;
  const activeMonth = (endDate || maxDate || startDate || "").slice(0, 7);
  const monthDays = activeMonth ? Array.from({ length: daysInMonth(activeMonth) }, (_, i) => `${activeMonth}-${String(i + 1).padStart(2, "0")}`) : [];
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

  async function applyRange(from, to) {
    const selector = periodSelector || await loadSelector();
    const available = (selector?.available_dates || []).slice().sort();
    const first = available[0] || minDate;
    const last = available.at(-1) || maxDate;
    const nextFrom = clampISO(from, first, last);
    const nextTo = clampISO(to, first, last);
    setStartDate(nextFrom);
    setEndDate(nextTo);
    await onApply(nextFrom, nextTo, selector);
    setOpen(false);
  }

  function setDraftRange(from, to) {
    setStartDate(clampISO(from, minDate, maxDate));
    setEndDate(clampISO(to, minDate, maxDate));
  }

  function selectDay(day) {
    if (day < minDate || day > maxDate) return;
    setMode("day");
    setDraftRange(day, day);
  }

  function selectWeek(day) {
    if (day < minDate || day > maxDate) return;
    const from = clampISO(startOfWeekISO(day), minDate, maxDate);
    const to = clampISO(addDays(from, 6), minDate, maxDate);
    setMode("week");
    setDraftRange(from, to);
  }

  function selectMonth(monthISO = activeMonth) {
    if (!monthISO) return;
    const from = clampISO(`${monthISO}-01`, minDate, maxDate);
    const to = clampISO(`${monthISO}-${String(daysInMonth(monthISO)).padStart(2, "0")}`, minDate, maxDate);
    setMode("month");
    setDraftRange(from, to);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          setOpen((value) => !value);
          if (!periodSelector) await loadSelector();
        }}
        className="min-w-[280px] rounded-lg border border-[#25F4EE]/70 bg-[#10141E] px-3 py-2 text-left text-xs font-bold text-white shadow-sm focus:outline-none"
      >
        <span className="text-white/50">Periodo:</span> {startDate || "--"} <span className="text-white/35">-</span> {endDate || "--"}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[min(92vw,620px)] overflow-hidden rounded-lg border border-white/10 bg-[#111521] shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr]">
            <div className="border-b border-white/10 bg-white/[0.02] p-3 md:border-b-0 md:border-r">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                <button type="button" onClick={() => applyRange(addDays(maxDate, -6), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Ultimos 7 dias
                </button>
                <button type="button" onClick={() => applyRange(addDays(maxDate, -27), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Ultimos 28 dias
                </button>
                <button type="button" onClick={() => applyRange(startOfMonthISO(maxDate), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Mes atual
                </button>
              </div>
              <div className="mt-3 text-[10px] leading-relaxed text-white/35">
                {periodSelector?.snapshot_count || availableDates.length || "..."} cortes disponiveis
                {maxDate ? ` · ate ${fmtFullDate(maxDate)}` : ""}
              </div>
            </div>
            <div className="p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {[
                  ["custom", "Personalizar"],
                  ["day", "Dia"],
                  ["week", "Semana"],
                  ["month", "Mes"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key);
                      if (key === "month") selectMonth();
                    }}
                    className={`rounded-md px-2.5 py-1.5 font-bold ${mode === key ? "bg-[#25F4EE] text-black" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase tracking-widest text-white/35">
                  Inicio
                  <input type="date" value={startDate} min={minDate} max={maxDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0A0B12] px-2 py-2 text-xs text-white focus:outline-none focus:border-[#25F4EE]" />
                </label>
                <label className="text-[10px] uppercase tracking-widest text-white/35">
                  Fim
                  <input type="date" value={endDate} min={minDate} max={maxDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0A0B12] px-2 py-2 text-xs text-white focus:outline-none focus:border-[#25F4EE]" />
                </label>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <button type="button" onClick={() => selectMonth(addDays(`${activeMonth}-01`, -1).slice(0, 7))} className="rounded-md px-2 py-1 text-white/45 hover:bg-white/[0.04] hover:text-white">‹</button>
                  <div className="text-sm font-extrabold text-white">{activeMonth || "---- --"}</div>
                  <button type="button" onClick={() => selectMonth(addDays(`${activeMonth}-${String(daysInMonth(activeMonth)).padStart(2, "0")}`, 1).slice(0, 7))} className="rounded-md px-2 py-1 text-white/45 hover:bg-white/[0.04] hover:text-white">›</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekdays.map((day) => (
                    <div key={day} className="py-1 text-[10px] font-bold uppercase text-white/30">{day}</div>
                  ))}
                  {monthDays.map((day) => {
                    const disabled = day < minDate || day > maxDate;
                    const selected = day >= startDate && day <= endDate;
                    const edge = day === startDate || day === endDate;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (mode === "week") selectWeek(day);
                          else if (mode === "month") selectMonth(day.slice(0, 7));
                          else if (mode === "day") selectDay(day);
                          else if (!startDate || startDate !== endDate) setDraftRange(day, day);
                          else setDraftRange(startDate < day ? startDate : day, startDate < day ? day : startDate);
                        }}
                        className={`h-8 rounded-md text-xs font-bold disabled:cursor-not-allowed disabled:text-white/15 ${
                          edge
                            ? "bg-[#25F4EE] text-black"
                            : selected
                              ? "bg-[#25F4EE]/15 text-white"
                              : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {Number(day.slice(-2))}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {hasAppliedPeriod && (
                  <button type="button" onClick={() => { onClear(); setOpen(false); }} className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/60 hover:text-white">
                    Limpar
                  </button>
                )}
                <button type="button" onClick={() => applyRange(startDate, endDate)} disabled={loading || !startDate || !endDate} className="rounded-lg bg-[#25F4EE] px-4 py-2 text-xs font-extrabold text-black disabled:opacity-50">
                  {loading ? "Carregando" : "Aplicar periodo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const buildPeriodViradaData = (baseData, periodSelector, from, to) => {
  const snapshots = (periodSelector?.snapshots || []).slice().sort((a, b) => a.period_end.localeCompare(b.period_end));
  const requestedFrom = from || snapshots[0]?.period_start || baseData.reference?.period_start || "";
  const requestedTo = to || snapshots.at(-1)?.period_end || baseData.reference?.period_end || "";
  const endSnapshot = findSnapshotAtOrBefore(snapshots, requestedTo);
  if (!endSnapshot) {
    return {
      ...baseData,
      totals: {
        latest_gmv: 0,
        latest_commission: 0,
        latest_amplify_commission: 0,
        latest_orders: 0,
        latest_creators: 0,
        latest_partners_with_sales: 0,
        latest_average_commission_rate: 0,
      },
      categories: CATEGORY_ORDER.map((name) => ({ name, creator_count: 0, active_count: 0, gmv: 0, commission_estimated: 0, amplify_commission: 0, orders: 0, avg_commission_rate: 0, share: 0, top5_share: 0 })),
      creator_list: [],
      top_creators: [],
      period_view: {
        requested: { from: requestedFrom, to: requestedTo },
        effective: { from: null, to: null },
        exact: false,
        warning: "Sem corte validado para a data final selecionada.",
      },
    };
  }

  const beforeSnapshot = findSnapshotAtOrBefore(snapshots, addDays(requestedFrom, -1));
  const beforeByCreator = new Map((beforeSnapshot?.creators || []).map((creator) => [creator.creator_id || creator.creator_name, creator]));
  const creators = (endSnapshot.creators || []).map((creator, index) => {
    const previous = beforeByCreator.get(creator.creator_id || creator.creator_name) || {};
    return normalizeCreator({
      ...creator,
      gmv: Number(creator.gmv || 0) - Number(previous.gmv || 0),
      commission_estimated: Number(creator.commission_estimated || 0) - Number(previous.commission_estimated || 0),
      commission_base: Number(creator.commission_base || 0) - Number(previous.commission_base || 0),
      orders: Number(creator.orders || 0) - Number(previous.orders || 0),
      live_gmv: Number(creator.live_gmv || 0) - Number(previous.live_gmv || 0),
      video_gmv: Number(creator.video_gmv || 0) - Number(previous.video_gmv || 0),
      direct_gmv: Number(creator.direct_gmv || 0) - Number(previous.direct_gmv || 0),
    }, index);
  }).filter((creator) => (
    creator.gmv !== 0 ||
    creator.commission_estimated !== 0 ||
    creator.orders !== 0 ||
    creator.live_gmv !== 0 ||
    creator.video_gmv !== 0 ||
    creator.direct_gmv !== 0
  ));
  const summary = summarizeCreators(creators);
  const effectiveFrom = beforeSnapshot ? addDays(beforeSnapshot.period_end, 1) : endSnapshot.period_start;
  const effectiveTo = endSnapshot.period_end;
  const exact = effectiveFrom === requestedFrom && effectiveTo === requestedTo;

  return {
    ...baseData,
    totals: {
      ...baseData.totals,
      ...summary.totals,
    },
    categories: summary.categories,
    creator_list: summary.creators,
    top_creators: summary.creators.slice(0, 15).map((creator) => ({ ...creator, gmv_rank: creator.rank })),
    period_view: {
      requested: { from: requestedFrom, to: requestedTo },
      effective: { from: effectiveFrom, to: effectiveTo },
      exact,
      warning: exact ? "" : `Periodo ajustado para ${fmtFullDate(effectiveFrom)} a ${fmtFullDate(effectiveTo)} porque nao existe corte validado para todo o intervalo pedido.`,
    },
  };
};

function CategoryAnalysis({ category, totalGmv }) {
  const cfg = CAT_CONFIG[category.name] || { color: "#fff", badge: "" };
  const share = totalGmv > 0 ? category.gmv / totalGmv : 0;
  const insight = category.creator_count === 0
    ? "Sem creators nesta faixa agora."
    : category.name === "Start"
      ? "Base larga: melhor uso e ativacao e subida para Silver."
      : category.name === "Silver"
        ? "Faixa de tracao: olhar quem esta perto de Gold."
        : category.name === "Gold"
          ? "Faixa de escala: bom ponto para plano de conteudo e live."
          : "Carteira sensivel: precisa leitura individual e link do Notion aberto.";
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold" style={{ color: cfg.color }}>{cfg.badge} {category.name}</div>
          <div className="text-[11px] text-white/35 mt-1">{insight}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white">{fmtBRL(category.gmv)}</div>
          <div className="text-[10px] text-white/35">{fmtPct(share)} do GMV</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-lg bg-white/[0.03] p-2">
          <div className="text-[9px] uppercase text-white/35">Creators</div>
          <div className="text-sm font-bold">{fmtInt(category.creator_count)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <div className="text-[9px] uppercase text-white/35">Comissao media</div>
          <div className="text-sm font-bold">{fmtPct(category.avg_commission_rate)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <div className="text-[9px] uppercase text-white/35">Top 5</div>
          <div className="text-sm font-bold">{fmtPct(category.top5_share)}</div>
        </div>
      </div>
    </div>
  );
}

function AdjustmentInsight({ data }) {
  const [open, setOpen] = useState(false);
  const insight = data?.data_quality?.adjustment_insight;
  const adjustments = data?.data_quality?.adjustments || {};
  const negativeCells = Number(adjustments.negative_cells || 0);
  const affectedCreators = Number(adjustments.affected_creators || 0);
  const hasAdjustments = negativeCells > 0;

  if (!insight && !hasAdjustments) return null;

  return (
    <div className={`rounded-lg border p-4 ${hasAdjustments ? "border-amber-400/25 bg-amber-400/10" : "border-emerald-400/20 bg-emerald-400/10"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className={`text-xs font-mono uppercase tracking-widest ${hasAdjustments ? "text-amber-200" : "text-emerald-200"}`}>
            Insight de reprocessamento
          </div>
          <div className="mt-1 text-sm font-extrabold text-white">
            {insight?.title || "Sem ajuste negativo relevante no periodo."}
          </div>
          <div className="mt-1 text-xs text-white/55">
            {hasAdjustments
              ? `${affectedCreators} creator(s) tiveram algum campo recalculado para baixo.`
              : "O periodo nao trouxe reducao entre snapshots acumulados."}
          </div>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-white/60">
          {open ? "Fechar" : "Explicar"}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs text-white/60 xl:grid-cols-[1fr_.9fr]">
          <div className="leading-relaxed">
            {insight?.explanation || "Cancelamentos, devolucoes ou revisoes do Partner Center podem reduzir numeros de dias anteriores. O painel ja considera esse ajuste no total oficial do periodo."}
          </div>
          {hasAdjustments && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-[#0A0B12]/70 p-2">
                <div className="text-[10px] uppercase text-white/35">Ajuste em GMV</div>
                <div className="font-mono font-bold text-amber-200">{fmtSignedBRL(adjustments.gmv_adjustment)}</div>
              </div>
              <div className="rounded-md bg-[#0A0B12]/70 p-2">
                <div className="text-[10px] uppercase text-white/35">Ajuste em comissao</div>
                <div className="font-mono font-bold text-amber-200">{fmtSignedBRL(adjustments.commission_adjustment)}</div>
              </div>
              <div className="rounded-md bg-[#0A0B12]/70 p-2">
                <div className="text-[10px] uppercase text-white/35">Campos negativos</div>
                <div className="font-mono font-bold text-white">{fmtInt(negativeCells)}</div>
              </div>
              <div className="rounded-md bg-[#0A0B12]/70 p-2">
                <div className="text-[10px] uppercase text-white/35">Creators afetados</div>
                <div className="font-mono font-bold text-white">{fmtInt(affectedCreators)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViradaDashboardVivo({ data, loading, error }) {
  const [periodSelector, setPeriodSelector] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState(null);
  const [activeCategory, setActiveCategory] = useState("Todas");

  useEffect(() => {
    if (!data) return;
    setStartDate((current) => current || data.reference?.period_start || "");
    setEndDate((current) => current || data.reference?.period_end || "");
  }, [data]);

  async function ensurePeriodSelector() {
    if (periodSelector) return periodSelector;
    setPeriodLoading(true);
    try {
      const res = await fetch("/api/club-virada?periodSelector=1", { cache: "no-store" });
      const selector = await res.json();
      setPeriodSelector(selector);
      return selector;
    } finally {
      setPeriodLoading(false);
    }
  }

  async function applyPeriod(nextStart = startDate, nextEnd = endDate, selectorArg = null) {
    if (selectorArg) setPeriodSelector(selectorArg);
    setPeriodLoading(true);
    try {
      const params = new URLSearchParams({ from: nextStart, to: nextEnd });
      const res = await fetch(`/api/club-virada?${params.toString()}`, { cache: "no-store" });
      const nextData = await res.json();
      setAppliedPeriod({ from: nextStart, to: nextEnd, data: nextData });
    } finally {
      setPeriodLoading(false);
    }
  }

  if (loading) {
    return (
      <section id="virada-club-dashboard" className="bg-[#10141E] border border-white/10 rounded-lg p-6">
        <div className="h-40 flex items-center justify-center text-sm text-white/40">Carregando TikTok Shop Retenção...</div>
      </section>
    );
  }

  if (error || !data?.totals || data?.kind !== "tiktok_shop_retencao_dashboard") {
    return (
      <section id="virada-club-dashboard" className="bg-[#10141E] border border-red-500/30 rounded-lg p-6 text-sm text-red-300">
        {error || "Dashboard TikTok Shop indisponivel."}
      </section>
    );
  }

  const viewData = appliedPeriod?.data || data;
  const creators = (viewData.creator_list || viewData.top_creators || []).map(normalizeCreator);
  const categories = CATEGORY_ORDER.map((name) => (viewData.categories || []).find((cat) => cat.name === name) || { name, creator_count: 0, active_count: 0, gmv: 0, commission_estimated: 0, amplify_commission: 0, orders: 0, avg_commission_rate: 0, share: 0, top5_share: 0 });
  const selectedCreators = (activeCategory === "Todas" ? creators : creators.filter((creator) => creator.category === activeCategory)).slice(0, 60);
  const topCategory = categories.slice().sort((a, b) => b.gmv - a.gmv)[0];
  const sourceMix = viewData.source_mix?.at(-1) || {};
  const liveGmv = Number(viewData.totals?.live_gmv || sourceMix.live_revenue || 0);
  const videoGmv = Number(viewData.totals?.video_gmv || sourceMix.video_revenue || 0);
  const directGmv = Number(viewData.totals?.direct_gmv || sourceMix.product_card_revenue || 0);
  const channelTotal = liveGmv + videoGmv + directGmv;
  const sourceRows = [
    { label: "Live", value: liveGmv, color: "#25F4EE" },
    { label: "Video", value: videoGmv, color: "#a855f7" },
    { label: "Outros", value: directGmv, color: "#f59e0b" },
  ];
  const statusOk = viewData.status === "OK";
  const periodView = viewData.period_view;

  return (
    <section id="virada-club-dashboard" className="bg-[#10141E] border border-white/10 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Partner Center · Retenção</p>
          <h2 className="text-xl font-extrabold tracking-tight">TikTok Shop Retenção</h2>
          <p className="text-xs text-white/40 mt-1">
            Ref: <strong className="text-white/80">{viewData.reference?.label || "Jan-Jul/2026"}</strong>
            {viewData.generated_at ? ` · atualizado ${new Date(viewData.generated_at).toLocaleString("pt-BR")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${statusOk ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-300" : "bg-amber-500/10 border-amber-400/20 text-amber-300"}`}>
            Status {viewData.status || "DEGRADED"}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/60">
            {viewData.version || "sem versao"}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">Periodo do dashboard</p>
              <h3 className="text-lg font-extrabold tracking-tight">
                {periodView ? `${fmtFullDate(periodView.effective?.from)} a ${fmtFullDate(periodView.effective?.to)}` : `${fmtFullDate(viewData.reference?.period_start)} a ${fmtFullDate(viewData.reference?.period_end)}`}
              </h3>
              <p className="text-xs text-white/40 mt-1">
                {periodView?.warning || "Use um unico seletor para recalcular GMV, comissao, categorias e lista de creators."}
              </p>
            </div>
            <PartnerCenterDateSelector
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              onApply={applyPeriod}
              onClear={() => setAppliedPeriod(null)}
              hasAppliedPeriod={Boolean(appliedPeriod)}
              loading={periodLoading}
              periodSelector={periodSelector}
              loadSelector={ensurePeriodSelector}
              reference={viewData.reference}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          {[
            { label: "GMV oficial", value: fmtBRLd(viewData.totals.latest_gmv), color: "#10b981" },
            { label: "Comissao creators", value: fmtBRLd(viewData.totals.latest_commission), color: "#25F4EE" },
            { label: "Receita Amplify", value: fmtBRLd(viewData.totals.latest_amplify_commission), color: "#a855f7" },
            { label: "Taxa media", value: fmtPct(viewData.totals.latest_average_commission_rate), color: "#f59e0b" },
            { label: "Pedidos", value: fmtInt(viewData.totals.latest_orders), color: "#fff" },
            { label: "Creators com venda", value: fmtInt(viewData.totals.latest_partners_with_sales), color: "#f43f5e" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">{k.label}</div>
              <div className="text-xl font-extrabold tracking-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <AdjustmentInsight data={viewData} />

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-4">
          <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold">Analise por categoria</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">{topCategory?.name || "sem categoria"} lidera</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map((category) => (
                <CategoryAnalysis key={category.name} category={category} totalGmv={viewData.totals.latest_gmv} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold">Leitura por canal</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">live, video e direto</span>
            </div>
            <div className="space-y-3">
              {sourceRows.map((item) => {
                const share = channelTotal > 0 ? item.value / channelTotal : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="font-bold text-white/80">{item.label}</span>
                      <span className="font-mono text-white/60">{fmtBRL(item.value)} · {fmtPct(share)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(0, share * 100)}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="rounded-lg bg-white/[0.03] p-3 text-xs text-white/50">
                Produtos, videos e lives ficam como diagnostico operacional. O numero oficial continua vindo do snapshot do Partner Center.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0A0B12] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">Creators por categoria</h3>
              <p className="text-[11px] text-white/35 mt-1">Diamond, Safira e Royal mostram atalho do Notion quando existir cadastro.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Todas", ...CATEGORY_ORDER].map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${activeCategory === cat ? "bg-white text-black border-white" : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-white/[0.02]">
                <tr>
                  {["#", "Creator", "Categoria", "Carteira", "GMV", "Comissao", "Taxa", "Canal forte", "Notion"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {selectedCreators.map((creator) => {
                  const cfg = CAT_CONFIG[creator.category] || { color: "#fff", badge: "" };
                  const amSlug = getAmForHandle(creator.handle);
                  const strongest = [
                    ["Live", creator.live_gmv],
                    ["Video", creator.video_gmv],
                    ["Direto", creator.direct_gmv],
                  ].sort((a, b) => b[1] - a[1])[0];
                  return (
                    <tr key={creator.creator_id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-sm font-mono text-white/40">{creator.rank}</td>
                      <td className="px-4 py-3 text-sm font-bold text-white">
                        <a href={tiktokProfileUrl(creator.creator_name)} target="_blank" rel="noreferrer" className="hover:text-[#25F4EE] hover:underline">
                          @{creator.creator_name}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: cfg.color + "22", color: cfg.color }}>
                          {cfg.badge} {creator.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/50">{amSlug || "sem carteira"}</td>
                      <td className="px-4 py-3 text-sm font-mono text-emerald-300">{fmtBRL(creator.gmv)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-cyan-300">{fmtBRL(creator.commission_estimated)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white/60">{fmtPct(creator.avg_commission_rate)}</td>
                      <td className="px-4 py-3 text-xs text-white/60">{strongest?.[1] > 0 ? strongest[0] : "sem sinal"}</td>
                      <td className="px-4 py-3 text-xs">
                        {creator.notion_url ? (
                          <a href={creator.notion_url} target="_blank" rel="noreferrer" className="font-bold text-[#25F4EE] hover:text-white">Abrir</a>
                        ) : (
                          <span className="text-white/25">sem link</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [metric,  setMetric]  = useState("gmv");
  const [search,    setSearch]    = useState("");
  const [viradaData, setViradaData] = useState(null);
  const [viradaLoading, setViradaLoading] = useState(true);
  const [viradaError, setViradaError] = useState("");

  useEffect(() => {
    async function loadVirada() {
      setViradaLoading(true);
      try {
        const r = await fetch("/api/club-virada");
        const d = await r.json();
        if (d.error) setViradaError(d.error);
        else setViradaData(d);
      } catch {
        setViradaError("Erro ao carregar TikTok Shop Retenção.");
      } finally {
        setViradaLoading(false);
      }
    }
    loadVirada();
  }, []);

  const { summary: s, creators = [], weeklyAmplifyData = [] } = data || {};
  const coverage = data?.dataCoverage;
  const coverageWarnings = coverage?.warnings || [];
  const coverageFiles = coverage?.matchedFiles || [];
  const requestedLabel = coverage?.requested
    ? `${fmtFullDate(coverage.requested.startDate)} → ${fmtFullDate(coverage.requested.endDate)}`
    : "";
  const effectiveLabel = coverage?.effective?.startDate
    ? `${fmtFullDate(coverage.effective.startDate)} → ${fmtFullDate(coverage.effective.endDate)}`
    : "";

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
              <p className="text-sm text-white/40 mt-1 max-w-2xl">Rotinas usadas no dia a dia da retenção, leitura mensal e acompanhamento do Partner Center.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AccessCard
                href="#virada-club-dashboard"
                title="TikTok Shop Retenção"
                description="GMV, comissão, creators, produtos, vídeos e lives na base canônica do Partner Center."
                tag="Partner Center"
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
                href="/hub/projetos"
                title="Projetos e Fluxos"
                description="Central visual dos fluxos recorrentes, com racional, ferramentas e outputs."
                tag="Fluxos"
                accent="#a855f7"
              />
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

        <ViradaDashboardVivo data={viradaData} loading={viradaLoading} error={viradaError} />

        <section className="bg-[#10141E] border border-white/10 rounded-lg p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">Base complementar</p>
              <h2 className="text-lg font-extrabold tracking-tight">Carteira histórica e evolução semanal</h2>
              <p className="text-xs text-white/35 mt-1 max-w-2xl">
                O seletor de datas oficial fica no bloco TikTok Shop Retenção acima. Esta área mantém a leitura histórica de apoio enquanto a base diária do Partner Center amadurece.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              Sem filtro duplicado
            </div>
          </div>
          {coverage && (
            <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
              coverageWarnings.length
                ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
            }`}>
              <div className="font-bold">
                Cobertura do filtro: {requestedLabel}
                {effectiveLabel && effectiveLabel !== requestedLabel ? ` · usado: ${effectiveLabel}` : ""}
              </div>
              <div className="mt-1 text-white/60">
                {coverageWarnings[0] || "Periodo coberto pelo arquivo disponivel."}
                {coverageFiles.length > 0 ? ` Arquivos usados: ${coverageFiles.length}.` : ""}
              </div>
            </div>
          )}
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
                          <td className="px-4 py-3 text-xs text-white/50 font-mono">
                            <a href={tiktokProfileUrl(c.handle)} target="_blank" rel="noreferrer" className="hover:text-[#25F4EE] hover:underline">
                              @{c.handle}
                            </a>
                          </td>
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
