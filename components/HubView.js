"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Auth ─────────────────────────────────────────────────────
const HUB_PASSWORD = process.env.NEXT_PUBLIC_HUB_PASSWORD || "amplify2025";

// ─── Helpers ──────────────────────────────────────────────────
const fmtBRL = (n) =>
  n == null || isNaN(n)
    ? "—"
    : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));
const fmtPct = (n) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);

// ─── Mini KPI ────────────────────────────────────────────────
function MiniKpi({ label, value, color = "#25F4EE", sub }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-xl font-extrabold tracking-tight" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────
function SectionCard({ title, icon, href, color, children, loading, error }) {
  return (
    <div
      className="bg-[#14161F] border border-white/10 rounded-2xl overflow-hidden flex flex-col"
      style={{ borderTopColor: color, borderTopWidth: 2 }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-sm text-white">{title}</span>
        </div>
        <Link
          href={href}
          className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
          style={{ background: color + "22", color }}
        >
          Ver completo →
        </Link>
      </div>
      <div className="px-5 py-4 flex-1">
        {loading ? (
          <div className="flex items-center gap-2 text-white/30 text-xs py-2">
            <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
            Carregando…
          </div>
        ) : error ? (
          <div className="text-red-400 text-xs py-2">⚠ {error}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>
        )}
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (pw === HUB_PASSWORD) onLogin();
    else setErr("Senha incorreta.");
  };
  return (
    <div className="min-h-screen bg-[#0A0B12] flex items-center justify-center">
      <div className="bg-[#14161F] border border-white/10 rounded-2xl p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-[#25F4EE]">Amplify UGC</span>
          <h1 className="text-2xl font-extrabold text-white">Hub de Dashboards</h1>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Senha de acesso"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            className="bg-[#0A0B12] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#25F4EE]"
            autoFocus
          />
          {err && <span className="text-red-400 text-xs">{err}</span>}
          <button
            type="submit"
            className="bg-[#1742E6] text-white font-bold text-sm rounded-xl py-3 hover:bg-blue-500 transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Hub principal ─────────────────────────────────────────────
export default function HubView() {
  const [authed, setAuthed]     = useState(false);
  const [notionData, setNotion] = useState(null);
  const [saData,     setSa]     = useState(null);
  const [igData,     setIg]     = useState(null);
  const [clubData,   setClub]   = useState(null);
  const [metaData,   setMeta]   = useState(null);
  const [loading,    setLoading] = useState({ notion: true, sa: true, ig: true, club: true, meta: true });
  const [errors,     setErrors]  = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dateRange] = useState(() => {
    const now = new Date();
    return {
      today: now.toISOString().slice(0, 10),
      minus30: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
    };
  });

  const fetchAll = useCallback(async () => {
    if (!authed) return;
    setLoading({ notion: true, sa: true, ig: true, club: true, meta: true });
    setErrors({});

    // Aquisição (Notion)
    fetch(`/api/notion?since=${dateRange.minus30}&until=${dateRange.today}&level=summary`)
      .then(r => r.json())
      .then(d => { setNotion(d); setLoading(p => ({ ...p, notion: false })); })
      .catch(e => { setErrors(p => ({ ...p, notion: e.message })); setLoading(p => ({ ...p, notion: false })); });

    // Super Afiliado
    fetch("/api/superafiliado")
      .then(r => r.json())
      .then(d => { setSa(d); setLoading(p => ({ ...p, sa: false })); })
      .catch(e => { setErrors(p => ({ ...p, sa: e.message })); setLoading(p => ({ ...p, sa: false })); });

    // Indique e Ganhe
    fetch("/api/indiqueeganhe")
      .then(r => r.json())
      .then(d => { setIg(d); setLoading(p => ({ ...p, ig: false })); })
      .catch(e => { setErrors(p => ({ ...p, ig: e.message })); setLoading(p => ({ ...p, ig: false })); });

    // Amplify Club
    fetch("/api/club")
      .then(r => r.json())
      .then(d => { setClub(d); setLoading(p => ({ ...p, club: false })); })
      .catch(e => { setErrors(p => ({ ...p, club: e.message })); setLoading(p => ({ ...p, club: false })); });

    // Meta Ads
    fetch(`/api/meta?since=${dateRange.minus30}&until=${dateRange.today}&level=campaign`)
      .then(r => r.json())
      .then(d => { setMeta(d); setLoading(p => ({ ...p, meta: false })); })
      .catch(e => { setErrors(p => ({ ...p, meta: e.message })); setLoading(p => ({ ...p, meta: false })); });

    setLastUpdate(new Date());
  }, [authed, dateRange]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const notionT = notionData?.totals || notionData;
  const metaT   = metaData?.totals;

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      {/* Nav */}
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <path d="M2 14 L10 4 L14 4 L6 14 L14 24 L10 24 Z" fill="#1B3FE4"/>
              <path d="M10 14 L18 4 L22 4 L14 14 L22 24 L18 24 Z" fill="#E4003A"/>
              <path d="M16 14 L21 8 L21 20 Z" fill="white"/>
            </svg>
            <span className="font-extrabold text-sm tracking-tight">Amplify UGC</span>
            <span className="text-white/30 text-xs font-mono ml-1">/ hub</span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-white/30 hidden sm:block">
                Atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
              </span>
            )}
            <button
              onClick={fetchAll}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors"
            >
              ↻ Atualizar
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Visão geral</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Hub de Dashboards</h1>
          <p className="text-white/40 text-sm mt-1">Últimos 30 dias · todos os módulos</p>
        </div>

        {/* ── Top KPIs (resumão) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Gasto Meta (30d)",
              value: fmtBRL(metaT?.spend),
              color: "#EA1A4E",
              sub: metaT ? `${fmtNum(metaT.leads)} leads` : null,
            },
            {
              label: "CPL Meta",
              value: fmtBRL(metaT?.cpl),
              color: "#25F4EE",
              sub: metaT ? `CTR ${fmtPct(metaT.ctr)}` : null,
            },
            {
              label: "Creators Ativos",
              value: fmtNum(clubData?.activeCreators),
              color: "#a855f7",
              sub: clubData ? `${fmtNum(clubData?.total)} no clube` : null,
            },
            {
              label: "GMV Club (30d)",
              value: fmtBRL(clubData?.totalGmv),
              color: "#10b981",
              sub: clubData ? `Receita ${fmtBRL(clubData?.amplifyRevenue)}` : null,
            },
          ].map((k) => (
            <div
              key={k.label}
              className="bg-[#14161F] border border-white/10 rounded-2xl p-5 flex flex-col gap-1"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{k.label}</span>
              <span className="text-2xl font-extrabold tracking-tight" style={{ color: k.color }}>
                {k.value ?? "…"}
              </span>
              {k.sub && <span className="text-[10px] text-white/30">{k.sub}</span>}
            </div>
          ))}
        </div>

        {/* ── AQUISIÇÃO ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-white/40 pt-2">Aquisição</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Dash Aquisição */}
            <SectionCard
              title="Dashboard Aquisição"
              icon="📊"
              href="/analise"
              color="#25F4EE"
              loading={loading.notion}
              error={errors.notion}
            >
              <MiniKpi
                label="Leads (30d)"
                value={fmtNum(notionT?.total_leads ?? notionT?.leads)}
                color="#25F4EE"
              />
              <MiniKpi
                label="Agendamentos"
                value={fmtNum(notionT?.agendamentos ?? notionT?.agendados)}
                color="#1742E6"
              />
              <MiniKpi
                label="Contratos"
                value={fmtNum(notionT?.contratos ?? notionT?.fechados)}
                color="#10b981"
              />
              <MiniKpi
                label="Conv. Lead→Contrato"
                value={
                  notionT?.total_leads && notionT?.contratos
                    ? fmtPct((notionT.contratos / notionT.total_leads) * 100)
                    : notionT?.conversion_rate
                    ? fmtPct(notionT.conversion_rate)
                    : "—"
                }
                color="#f97316"
              />
            </SectionCard>

            {/* Super Afiliado */}
            <SectionCard
              title="Super Afiliado"
              icon="🤝"
              href="/superafiliado"
              color="#EA1A4E"
              loading={loading.sa}
              error={errors.sa}
            >
              <MiniKpi label="Indicações" value={fmtNum(saData?.total)} color="#fff" />
              <MiniKpi label="Agenciados" value={fmtNum(saData?.agenciados)} color="#EA1A4E" />
              <MiniKpi label="Conversão" value={saData?.conversion != null ? `${saData.conversion}%` : "—"} color="#f97316" />
              <MiniKpi label="GMV (30d)" value={fmtBRL(saData?.totalGmv)} color="#10b981" />
            </SectionCard>

            {/* Indique e Ganhe */}
            <SectionCard
              title="Indique e Ganhe"
              icon="🎁"
              href="/indiqueeganhe"
              color="#EAB308"
              loading={loading.ig}
              error={errors.ig}
            >
              <MiniKpi label="Indicações" value={fmtNum(igData?.total)} color="#fff" />
              <MiniKpi label="GMV (30d)" value={fmtBRL(igData?.totalGmv)} color="#10b981" />
              <MiniKpi label="Comissão" value={fmtBRL(igData?.totalCom)} color="#EAB308" />
              <MiniKpi label="Repasse" value={fmtBRL(igData?.indiqueEarn)} color="#f97316" />
            </SectionCard>
          </div>
        </div>

        {/* ── META ADS ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-white/40 pt-2">Mídia Paga</h2>
          <SectionCard
            title="Meta Ads"
            icon="📣"
            href="/meta"
            color="#1742E6"
            loading={loading.meta}
            error={errors.meta}
          >
            <MiniKpi label="Gasto" value={fmtBRL(metaT?.spend)} color="#EA1A4E" />
            <MiniKpi label="Leads" value={fmtNum(metaT?.leads)} color="#25F4EE" />
            <MiniKpi label="CPL" value={fmtBRL(metaT?.cpl)} color="#25F4EE" />
            <MiniKpi label="Impressões" value={fmtNum(metaT?.impressions)} color="#fff" />
            <MiniKpi label="Cliques" value={fmtNum(metaT?.clicks)} color="#fff" />
            <MiniKpi label="CTR" value={fmtPct(metaT?.ctr)} color={metaT?.ctr > 1 ? "#10b981" : "#f97316"} />
            <MiniKpi label="CPM" value={fmtBRL(metaT?.cpm)} color="#fff" />
            <MiniKpi label="Frequência" value={metaT?.frequency ? Number(metaT.frequency).toFixed(2) : "—"} color="#fff" />
          </SectionCard>
        </div>

        {/* ── RETENÇÃO ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-white/40 pt-2">Retenção</h2>
          <SectionCard
            title="Amplify Club"
            icon="💎"
            href="/club"
            color="#a855f7"
            loading={loading.club}
            error={errors.club}
          >
            <MiniKpi label="Total Creators" value={fmtNum(clubData?.total)} color="#a855f7" />
            <MiniKpi label="Ativos (30d)" value={fmtNum(clubData?.activeCreators)} color="#10b981" />
            <MiniKpi label="GMV (30d)" value={fmtBRL(clubData?.totalGmv)} color="#10b981" />
            <MiniKpi label="Receita Amplify" value={fmtBRL(clubData?.amplifyRevenue)} color="#25F4EE" />
            {clubData?.byCategoria && Object.entries(clubData.byCategoria).map(([cat, count]) => (
              <MiniKpi key={cat} label={cat} value={fmtNum(count)} color="#fff" sub="creators" />
            ))}
          </SectionCard>
        </div>

        {/* ── Quick links ── */}
        <div className="border-t border-white/5 pt-6">
          <p className="text-xs font-mono uppercase tracking-widest text-white/30 mb-3">Navegar</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/",                   label: "Hoje",         icon: "☀️" },
              { href: "/analise",            label: "Análise",      icon: "📊" },
              { href: "/metricas",           label: "Métricas",     icon: "🎯" },
              { href: "/custos",             label: "Custos",       icon: "💰" },
              { href: "/meta",               label: "Meta Ads",     icon: "📣" },
              { href: "/superafiliado",      label: "Super Afiliado", icon: "🤝" },
              { href: "/indiqueeganhe",      label: "Indique e Ganhe", icon: "🎁" },
              { href: "/club",               label: "Amplify Club", icon: "💎" },
            ].map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span>{t.icon}</span> {t.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
