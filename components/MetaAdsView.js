"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/config";

const money = (v) => v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => v == null || Number.isNaN(Number(v)) ? "0" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (v) => v == null || Number.isNaN(Number(v)) ? "—" : `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function KPI({ label, value, sub, color = "#25F4EE" }) {
  return <div className="bg-[#14161F] border border-white/10 rounded-2xl p-5 flex flex-col gap-1">
    <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</span>
    <span className="text-2xl font-extrabold tracking-tight" style={{ color }}>{value}</span>
    {sub && <span className="text-xs text-white/35">{sub}</span>}
  </div>;
}

function Badge({ decision }) {
  const tone = decision?.tone || "neutral";
  const color = tone === "good" ? "#10b981" : tone === "warn" ? "#eab308" : tone === "bad" ? "#EA1A4E" : "#64748b";
  return <span className="absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow" style={{ backgroundColor: color }}>{decision?.label || "Observar"}</span>;
}

function Delta({ value, lowerIsBetter = false }) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const good = lowerIsBetter ? n < 0 : n > 0;
  return <span className={`text-[10px] ${good ? "text-emerald-400" : "text-red-400"}`}>{n > 0 ? "↑" : "↓"} {Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>;
}

function Stat({ label, value, delta, lowerIsBetter }) {
  return <div className="rounded-xl bg-white/[0.035] border border-white/5 p-3">
    <div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div>
    <div className="text-sm font-bold text-white">{value}</div>
    <Delta value={delta} lowerIsBetter={lowerIsBetter} />
  </div>;
}

function CreativeCard({ ad }) {
  const c = ad.creative || {};
  const r = ad.recent || {};
  const d = ad.deltas || {};
  const preview = c.preview_shareable_link || (c.video_id ? `https://www.facebook.com/${c.video_id}` : null);
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#14161F]">
    <div className="relative aspect-[9/12] bg-black/40">
      <Badge decision={ad.decision} />
      {c.video_url ? (
        <video src={c.video_url} poster={c.thumbnail_url || undefined} controls preload="metadata" playsInline className="h-full w-full object-cover" />
      ) : c.thumbnail_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
            <div className="text-xs font-bold text-white">Sem play direto</div>
            <div className="text-[10px] text-white/60">Meta bloqueou o source; preview externo disponivel</div>
          </div>
        </>
      ) : <div className="flex h-full items-center justify-center text-xs text-white/40">Sem midia pela API</div>}
    </div>
    <div className="space-y-4 p-4">
      <div>
        <div className="line-clamp-2 text-sm font-extrabold text-white">{ad.name}</div>
        <div className="mt-1 line-clamp-1 text-xs text-white/45">{ad.campaign}</div>
        <div className="line-clamp-1 text-[11px] text-white/30">{ad.adset}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Gasto" value={money(r.spend)} delta={d.spend} />
        <Stat label="Leads" value={num(r.results)} delta={d.results} />
        <Stat label="CPL" value={money(r.cpr)} delta={d.cpr} lowerIsBetter />
        <Stat label="CTR" value={pct(r.ctr)} delta={d.ctr} />
        <Stat label="CPM" value={money(r.cpm)} delta={d.cpm} lowerIsBetter />
        <Stat label="Idade" value={`${num(ad.age_days)}d`} />
      </div>
      {ad.decision?.reason && <p className="text-xs leading-relaxed text-white/45">{ad.decision.reason}</p>}
      <div className="flex flex-wrap gap-2">
        {preview && <a href={preview} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/15">Preview Meta</a>}
        {c.video_id && <a href={`https://www.facebook.com/${c.video_id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#1742E6]/25 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-[#1742E6]/40">Abrir video</a>}
      </div>
    </div>
  </article>;
}

export default function MetaAdsView() {
  const pathname = usePathname();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("spend");
  const [campaign, setCampaign] = useState("all");

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/meta-creative?ts=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPayload(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const ads = payload?.ads || [];
  const campaigns = useMemo(() => {
    const map = new Map();
    for (const ad of ads) {
      const row = map.get(ad.campaign) || { name: ad.campaign, spend: 0, leads: 0, ads: 0 };
      row.spend += Number(ad.recent?.spend || 0);
      row.leads += Number(ad.recent?.results || 0);
      row.ads += 1;
      map.set(ad.campaign, row);
    }
    return [...map.values()].sort((a,b)=>b.spend-a.spend);
  }, [ads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ads
      .filter(ad => segment === "all" || ad.segment === segment)
      .filter(ad => status === "all" ? true : status === "active" ? (ad.effective_status ? ad.effective_status === "ACTIVE" : ad.status === "ACTIVE") : Number(ad.recent?.spend || 0) > 0)
      .filter(ad => campaign === "all" || ad.campaign === campaign)
      .filter(ad => !q || [ad.name, ad.campaign, ad.adset, ad.creative?.title, ad.creative?.body].join(" ").toLowerCase().includes(q))
      .sort((a,b) => {
        if (sort === "results") return Number(b.recent?.results || 0) - Number(a.recent?.results || 0);
        if (sort === "cpr") return Number(a.recent?.cpr || 999999) - Number(b.recent?.cpr || 999999);
        if (sort === "ctr") return Number(b.recent?.ctr || 0) - Number(a.recent?.ctr || 0);
        if (sort === "age") return Number(b.age_days || 0) - Number(a.age_days || 0);
        return Number(b.recent?.spend || 0) - Number(a.recent?.spend || 0);
      });
  }, [ads, segment, status, campaign, query, sort]);

  const totals = useMemo(() => {
    const t = filtered.reduce((acc, ad) => {
      acc.spend += Number(ad.recent?.spend || 0);
      acc.leads += Number(ad.recent?.results || 0);
      acc.impressions += Number(ad.recent?.impressions || 0);
      acc.clicks += Number(ad.recent?.clicks || 0);
      acc.videos += ad.creative?.video_url ? 1 : 0;
      acc.thumbs += ad.creative?.thumbnail_url ? 1 : 0;
      return acc;
    }, { spend:0, leads:0, impressions:0, clicks:0, videos:0, thumbs:0 });
    t.cpl = t.leads ? t.spend / t.leads : null;
    t.ctr = t.impressions ? t.clicks / t.impressions : 0;
    return t;
  }, [filtered]);

  return <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0B12]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-1 overflow-x-auto px-4">
        {NAV_TABS.map((t) => <Link key={t.href} href={t.href} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${pathname === t.href ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}><span>{t.icon}</span>{t.label}</Link>)}
      </div>
    </nav>

    <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-mono uppercase tracking-widest text-[#25F4EE]">Performance / Criativos</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Meta Ads</h1>
          <p className="mt-1 text-sm text-white/40">Sincroniza automaticamente com o Meta sempre que esta pagina abre.</p>
          {payload?.summary?.live_synced_at && <p className="mt-1 text-xs text-white/30">Dados de hoje · sincronizado {new Date(payload.summary.live_synced_at).toLocaleString("pt-BR")}</p>}
          {payload?.summary?.live_sync_error && <p className="mt-1 text-xs text-amber-400">A ultima sincronizacao falhou; exibindo o ultimo snapshot valido.</p>}
        </div>
        <button onClick={load} className="rounded-xl bg-[#1742E6] px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">↻ Atualizar</button>
      </div>

      {error && <div className="rounded-2xl border border-red-500/40 bg-red-900/30 p-4 text-sm text-red-300">⚠️ {error}</div>}
      {loading && <div className="rounded-2xl border border-white/10 bg-[#14161F] p-8 text-center text-white/40">Carregando criativos…</div>}

      {!loading && !error && <>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <KPI label="Gasto" value={money(totals.spend)} color="#EA1A4E" />
          <KPI label="Leads Meta" value={num(totals.leads)} color="#25F4EE" />
          <KPI label="CPL Meta" value={money(totals.cpl)} color="#25F4EE" />
          <KPI label="CTR" value={pct(totals.ctr)} color="#10b981" />
          <KPI label="Anuncios" value={num(filtered.length)} color="#fff" />
          <KPI label="Videos com play" value={`${num(totals.videos)}/${num(filtered.length)}`} color="#a855f7" />
          <KPI label="Thumbs" value={num(totals.thumbs)} color="#eab308" />
        </section>

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#14161F] p-4 lg:grid-cols-[1fr_auto_auto_260px_180px]">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar campanha, conjunto, anuncio..." className="h-10 rounded-xl border border-white/10 bg-[#0A0B12] px-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#25F4EE]" />
          <select value={segment} onChange={e=>setSegment(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0A0B12] px-3 text-sm text-white outline-none"><option value="all">Todos segmentos</option><option value="creator">Creator</option><option value="marca">Marcas</option></select>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0A0B12] px-3 text-sm text-white outline-none"><option value="spend">Com gasto</option><option value="active">Ativos</option><option value="all">Todos</option></select>
          <select value={campaign} onChange={e=>setCampaign(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0A0B12] px-3 text-sm text-white outline-none"><option value="all">Todas campanhas</option>{campaigns.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0A0B12] px-3 text-sm text-white outline-none"><option value="spend">Maior gasto</option><option value="results">Mais leads</option><option value="cpr">Menor CPL</option><option value="ctr">Maior CTR</option><option value="age">Mais antigos</option></select>
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-[#14161F] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Campanhas</h2><span className="text-xs text-white/35">{campaigns.length}</span></div>
            <div className="grid max-h-[70vh] gap-2 overflow-auto pr-1">
              {campaigns.map(c => <button key={c.name} onClick={()=>setCampaign(c.name)} className={`rounded-xl border p-3 text-left ${campaign === c.name ? "border-[#25F4EE] bg-[#25F4EE]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="line-clamp-2 text-xs font-bold text-white">{c.name}</div>
                <div className="mt-1 text-[11px] text-white/40">{money(c.spend)} · {num(c.leads)} leads · {c.ads} ads</div>
              </button>)}
            </div>
          </aside>

          <div>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Anuncios</h2><span className="text-xs text-white/35">{filtered.length} encontrados</span></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map(ad => <CreativeCard key={ad.id} ad={ad} />)}
            </div>
          </div>
        </section>
      </>}
    </main>
  </div>;
}
