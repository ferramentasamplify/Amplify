"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PartnerCenterDateSelector from "@/components/PartnerCenterDateSelector";
import { tiktokProfileUrl } from "@/lib/tiktok-profile-url";

const fmtBRL = (n) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtShortBRL = (n) => {
  const value = Number(n || 0);
  if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  return fmtBRL(value);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (dateString) => {
  if (!dateString) return "—";
  const [year, month, day] = String(dateString).slice(0, 10).split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

function Kpi({ label, value, sub, color = "#fff" }) {
  return (
    <div className="border border-white/10 bg-[#14161F] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="border border-dashed border-white/10 p-5 text-sm text-white/35">{children}</div>;
}

export default function CreatorProfileView({ slug, handle }) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayISO());
  const [applied, setApplied] = useState({ from: "", to: todayISO() });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      const res = await fetch(`/api/am/${slug}/creator/${encodeURIComponent(handle)}?${params}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/club/am/login?next=${encodeURIComponent(pathname || "")}`);
          return;
        }
        throw new Error(payload.error || "Erro ao carregar perfil.");
      }
      setData(payload);
      if (payload.dataFreshness?.requestedPeriod) {
        setStartDate((current) => current || payload.dataFreshness.requestedPeriod.from || "");
        setEndDate((current) => current || payload.dataFreshness.requestedPeriod.to || todayISO());
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
  }, [slug, handle, applied]);

  if (loading && !data) {
    return <main className="min-h-screen bg-[#0A0B12] text-white grid place-items-center text-white/40">Carregando perfil…</main>;
  }

  const creator = data?.creator || {};
  const metrics = data?.metrics || {};
  const freshness = data?.dataFreshness || {};
  const freshnessWarnings = freshness.warnings || [];
  const meetings = data?.meetings?.items || [];
  const gamifications = data?.gamifications?.items || [];
  const channelTotal = Number(metrics.gmv || 0);
  const tiktokUrl = tiktokProfileUrl(creator.handle || handle);
  const timelineData = (data?.timeline?.points || []).map((point) => ({
    ...point,
    label: fmtDate(point.date),
  }));
  const rolling30Data = (data?.rolling30Timeline?.points || []).map((point) => ({
    ...point,
    label: fmtDate(point.date),
  }));
  const lifecycle = data?.lifecycle || {};
  const rollingFirst = Number(rolling30Data[0]?.rolling30Gmv || 0);
  const rollingLast = Number(rolling30Data.at(-1)?.rolling30Gmv || 0);
  const rollingDeltaPct = rollingFirst > 0 ? ((rollingLast - rollingFirst) / rollingFirst) * 100 : rollingLast > 0 ? 100 : 0;
  const consistencyPct = Math.max(5, Math.min(100, rollingFirst > 0 ? (rollingLast / rollingFirst) * 70 : rollingLast > 0 ? 55 : 8));
  const consistencyTone = rollingDeltaPct <= -20 ? "#ef4444" : rollingDeltaPct < 5 ? "#f59e0b" : "#10b981";
  const previousPeriod = data?.timeline?.previousPeriod;

  return (
    <main className="min-h-screen bg-[#0A0B12] text-white">
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0B12]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-4">
          <Link href={`/club/am/${slug}`} className="rounded-lg px-3 py-1.5 text-sm font-bold text-white/55 hover:bg-white/5 hover:text-white">
            ← Carteira
          </Link>
          <Link href="/club/am/central" className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold text-white/70 hover:bg-white/10">
            Central
          </Link>
          {tiktokUrl && (
            <a href={tiktokUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-bold text-white/40 hover:text-[#25F4EE]">
              @{creator.handle || handle}
            </a>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-white/40">Perfil do creator</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">{creator.nome || handle}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/50">
              {tiktokUrl ? (
                <a href={tiktokUrl} target="_blank" rel="noreferrer" className="font-bold text-[#25F4EE] hover:underline">
                  @{creator.handle || handle}
                </a>
              ) : (
                <span>@{creator.handle || handle}</span>
              )}
              <span>·</span>
              <span>{creator.categoria || "Sem categoria"}</span>
              <span>·</span>
              <span>{creator.nicho || "A definir"}</span>
              {creator.notionUrl && (
                <a href={creator.notionUrl} target="_blank" rel="noreferrer" className="ml-1 rounded bg-[#25F4EE]/10 px-2 py-1 text-xs font-bold text-[#25F4EE] hover:bg-[#25F4EE]/20">
                  Notion
                </a>
              )}
            </div>
          </div>
          <PartnerCenterDateSelector
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            onApply={(from, to) => setApplied({ from, to })}
            loading={loading}
            freshness={freshness}
            accent="#25F4EE"
          />
        </div>

        {error && <div className="border border-red-500/40 bg-red-900/30 p-4 text-sm text-red-200">{error}</div>}
        {freshnessWarnings.length > 0 && (
          <div className="border border-amber-500/40 bg-amber-950/35 p-4 text-sm text-amber-100">
            <b>Status: DEGRADED.</b> {freshnessWarnings[0]}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="GMV" value={fmtBRL(metrics.gmv)} color="#10b981" />
          <Kpi label="Pedidos" value={fmtInt(metrics.orders)} color="#fff" />
          <Kpi label="Comissão creator" value={fmtBRL(metrics.comissao)} color="#25F4EE" />
          <Kpi label="Taxa média" value={fmtPct(metrics.commissionRate)} color="#f59e0b" />
          <Kpi label="Receita Amplify" value={fmtBRL(metrics.amplifyRevenue)} color="#a855f7" />
          <Kpi label="Última att" value={fmtDate(metrics.lastUpdate)} color="#94a3b8" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="border border-white/10 bg-[#14161F] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">GMV móvel</p>
                <h2 className="mt-1 text-xl font-black">Últimos 30 dias por ponto</h2>
                <p className="mt-1 text-xs text-white/40">
                  Cada dia mostra a soma dos 30 dias anteriores para separar constância de pico isolado.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black" style={{ color: consistencyTone }}>{fmtBRL(rollingLast)}</div>
                <div className="text-[11px] text-white/40">{fmtPct(rollingDeltaPct)} vs início da janela</div>
              </div>
            </div>
            <div className="mt-5 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rolling30Data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtShortBRL} />
                  <Tooltip
                    contentStyle={{ background: "#0A0B12", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                    formatter={(value) => [fmtBRL(value), "GMV móvel 30d"]}
                  />
                  <Line type="monotone" dataKey="rolling30Gmv" stroke={consistencyTone} strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <b className="text-white/70">Corrida de consistência</b>
                <span className="font-mono text-white/45">{Math.round(consistencyPct)}%</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${consistencyPct}%`, background: consistencyTone }} />
              </div>
              <p className="mt-2 text-xs text-white/35">
                Verde quando o GMV móvel cresce; laranja quando estabiliza; vermelho quando a janela perde força.
              </p>
            </div>
          </div>

          <div className="border border-white/10 bg-[#14161F] p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Vínculo</p>
            <h2 className="mt-1 text-xl font-black">Saída e retorno</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">Entrada</span><b>{fmtDate(lifecycle.joinedAt)}</b></div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">Saída</span><b>{fmtDate(lifecycle.leftAt)}</b></div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">Retorno</span><b>{fmtDate(lifecycle.returnedAt)}</b></div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">Dias vinculado</span><b>{lifecycle.linkedDays === null || lifecycle.linkedDays === undefined ? "—" : `${fmtInt(lifecycle.linkedDays)} dias`}</b></div>
              <div className="flex justify-between gap-4"><span className="text-white/40">Sinal</span><b>{lifecycle.hasReturned ? "Reativado" : lifecycle.hasChurned ? "Churn" : "Ativo/sem saída"}</b></div>
            </div>
            {lifecycle.source === "notion_fields_missing" && (
              <p className="mt-4 text-xs leading-relaxed text-amber-100/70">
                Campos de entrada/saída/retorno ainda não encontrados no cadastro auxiliar.
              </p>
            )}
          </div>
        </section>

        <section className="border border-white/10 bg-[#14161F] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Evolução no período</p>
              <h2 className="mt-1 text-xl font-black">GMV acumulado por dia</h2>
            </div>
            <div className="text-right text-xs text-white/40">
              {fmtDate(freshness.requestedPeriod?.from)} → {fmtDate(freshness.requestedPeriod?.to)}
              {previousPeriod && (
                <div className="mt-1 text-white/30">
                  Comparativo: {fmtDate(previousPeriod.from)} → {fmtDate(previousPeriod.to)}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtShortBRL} />
                <Tooltip
                  contentStyle={{ background: "#0A0B12", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff" }}
                  labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                  formatter={(value, name) => [fmtBRL(value), name === "previousGmv" ? "Mês anterior" : "Período atual"]}
                />
                <Line type="monotone" dataKey="previousGmv" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="gmv" stroke="#25F4EE" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="border border-white/10 bg-[#14161F] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Mini dashboard</p>
                <h2 className="mt-1 text-xl font-black">Métricas por canal no período</h2>
              </div>
              <div className="text-right text-xs text-white/40">
                {fmtDate(freshness.requestedPeriod?.from)} → {fmtDate(freshness.requestedPeriod?.to)}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {(data?.channelBreakdown || []).map((item) => {
                const pct = channelTotal > 0 ? (Number(item.value || 0) / channelTotal) * 100 : 0;
                const pctLabel = pct.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-white/70">{item.label}</span>
                      <span className="font-mono text-white/50">{fmtBRL(item.value)} · {pctLabel}%</span>
                    </div>
                    <div className="h-2 overflow-hidden bg-white/5">
                      <div className="h-full bg-[#25F4EE]" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-white/35">
              {freshness.message} Canais são métricas do Partner Center e não devem ser somados como GMV total.
            </p>
          </div>

          <div className="border border-white/10 bg-[#14161F] p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Cadastro</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">Fase</span><b>{creator.fase || "—"}</b></div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">WhatsApp</span><b>{creator.whatsapp || "—"}</b></div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2"><span className="text-white/40">E-mail</span><b className="truncate">{creator.email || "—"}</b></div>
              <div className="flex justify-between gap-4"><span className="text-white/40">Fonte dinheiro</span><b>Partner Center</b></div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-white/10 bg-[#14161F] p-5">
            <h2 className="text-xl font-black">Reuniões e acompanhamentos</h2>
            <div className="mt-4 space-y-3">
              {meetings.length ? meetings.map((meeting) => (
                <a key={meeting.id} href={meeting.url} target="_blank" rel="noreferrer" className="block border border-white/10 bg-black/20 p-4 hover:border-[#25F4EE]/40">
                  <div className="flex items-center justify-between gap-3">
                    <b className="text-sm">{meeting.title}</b>
                    <span className="text-xs text-white/40">{fmtDate(meeting.date)}</span>
                  </div>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/55">{meeting.summary || "Sem resumo preenchido."}</p>
                  {meeting.nextStep && <p className="mt-2 text-xs text-amber-200">Próximo passo: {meeting.nextStep}</p>}
                </a>
              )) : <EmptyState>Nenhuma reunião relacionada encontrada pelo handle/relação do Notion.</EmptyState>}
            </div>
          </div>

          <div className="border border-white/10 bg-[#14161F] p-5">
            <h2 className="text-xl font-black">Gamificações</h2>
            <div className="mt-4 space-y-3">
              {gamifications.length ? gamifications.map((game) => (
                <a key={game.id} href={game.links?.notion} target="_blank" rel="noreferrer" className="block border border-white/10 bg-black/20 p-4 hover:border-[#a855f7]/40">
                  <div className="flex items-center justify-between gap-3">
                    <b className="text-sm">{game.name}</b>
                    <span className="text-xs text-white/40">{game.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/45">{game.brand} · {fmtDate(game.startDate)} → {fmtDate(game.endDate)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-white/55">{game.objective || game.incentive || "Sem objetivo preenchido."}</p>
                </a>
              )) : <EmptyState>Nenhuma gamificação específica encontrada para esse creator.</EmptyState>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
