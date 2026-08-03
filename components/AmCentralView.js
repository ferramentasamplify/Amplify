"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PartnerCenterDateSelector from "@/components/PartnerCenterDateSelector";
import { tiktokProfileUrl } from "@/lib/tiktok-profile-url";

const fmtBRL = (n) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtPct = (n) => `${Number(n || 0).toFixed(0)}%`;
const fmtShortBRL = (n) => {
  const value = Number(n || 0);
  if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  return fmtBRL(value);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (dateString) => {
  if (!dateString) return "—";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};
const healthClasses = {
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  orange: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  red: "border-red-400/40 bg-red-500/10 text-red-100",
};
const healthDot = {
  blue: "#38bdf8",
  orange: "#f59e0b",
  red: "#ef4444",
};
const VIEW_TABS = [
  { id: "overview", label: "Resumo" },
  { id: "goals", label: "Meta agosto" },
  { id: "gmv", label: "GMV original" },
  { id: "health", label: "Saúde" },
  { id: "ranking", label: "Ranking" },
];

/** Cavalinho animado — foto circular com bobbing idle e posição X animada */
function Horse({ am, trackPositionPct, gmvTotal, position, isLeader }) {
  const ref = useRef(null);
  const prevPctRef = useRef(trackPositionPct);

  // Quando o pct muda, anima suavemente
  useEffect(() => {
    if (!ref.current) return;
    const prevPct = prevPctRef.current;
    if (Math.abs(prevPct - trackPositionPct) < 0.5) return;
    ref.current.animate(
      [
        { left: `${prevPct}%` },
        { left: `${trackPositionPct}%` },
      ],
      { duration: 1800, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" },
    );
    prevPctRef.current = trackPositionPct;
  }, [trackPositionPct]);

  return (
    <div className="relative w-full h-16 mb-3">
      {/* Trilho de fundo */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
      {/* Marcadores de 25/50/75% */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-[25%] pointer-events-none">
        {[25, 50, 75].map((p) => (
          <div key={p} className="w-px h-3 bg-white/10" />
        ))}
      </div>

      {/* Cavalinho */}
      <div
        ref={ref}
        className="absolute top-1/2 flex flex-col items-center"
        style={{ left: `${trackPositionPct}%`, transform: "translate(-50%, -50%)" }}
      >
        <div
          className="relative w-12 h-12 rounded-full overflow-hidden border-2 shadow-lg flex items-center justify-center text-xl font-bold"
          style={{
            borderColor: am.accentColor,
            background: am.photo ? "transparent" : `${am.accentColor}30`,
            color: am.accentColor,
            boxShadow: isLeader ? `0 0 24px ${am.accentColor}80` : `0 4px 12px rgba(0,0,0,0.5)`,
          }}
        >
          {/* CSS inline pra bobbing idle — independente da posição X */}
          <style jsx>{`
            @keyframes horse-bob {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              25%      { transform: translateY(-2px) rotate(-1deg); }
              50%      { transform: translateY(0) rotate(0deg); }
              75%      { transform: translateY(-2px) rotate(1deg); }
            }
            .horse-bob {
              animation: horse-bob 1.6s ease-in-out infinite;
            }
            @keyframes horse-run {
              0%, 100% { transform: translateY(-1px); }
              50%      { transform: translateY(1px); }
            }
            .horse-run {
              animation: horse-run 0.5s ease-in-out infinite;
            }
          `}</style>
          <div className={isLeader ? "horse-run" : "horse-bob"}>
            {am.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={am.photo} alt={am.displayName} className="w-full h-full object-cover" />
            ) : (
              am.emoji || am.displayName[0]
            )}
          </div>
          {position === 1 && (
            <div className="absolute -top-2 -right-2 text-base drop-shadow-lg">👑</div>
          )}
        </div>
        <div
          className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
          style={{ background: `${am.accentColor}30`, color: am.accentColor }}
        >
          {am.shortName}
        </div>
      </div>
    </div>
  );
}

export default function AmCentralView() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0); // força refresh visual
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayISO());
  const [applied, setApplied] = useState({ from: "", to: todayISO() });
  const [chartMode, setChartMode] = useState("goal");
  const [legacyChartMode, setLegacyChartMode] = useState("split");
  const [selectedAmDrill, setSelectedAmDrill] = useState("");
  const [activeView, setActiveView] = useState("overview");

  async function load() {
    setError("");
    try {
      const meRes = await fetch("/api/am/me", { cache: "no-store" });
      const meData = await meRes.json();
      if (!meData.am) {
        router.push(`/club/am/login?next=${encodeURIComponent(pathname || "/club/am/central")}`);
        return;
      }
      setMe(meData.am);

      const params = new URLSearchParams();
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      const query = params.toString();
      const res = await fetch(`/api/am/central${query ? `?${query}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao carregar central.");
      setData(d);
      if (d.dataFreshness?.requestedPeriod) {
        setStartDate((current) => current || d.dataFreshness.requestedPeriod.from || "");
        setEndDate((current) => current || d.dataFreshness.requestedPeriod.to || todayISO());
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
  }, [applied]);

  // Auto-refresh a cada 90s
  useEffect(() => {
    const t = setInterval(() => {
      load();
      setTick((x) => x + 1);
    }, 90 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  async function logout() {
    await fetch("/api/am/logout", { method: "POST" });
    router.push("/club/am/login");
    router.refresh();
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0B12] text-white flex items-center justify-center text-white/40">
        Carregando corrida…
      </div>
    );
  }

  const ranking = data?.ranking || [];
  const totalGmv = ranking.reduce((acc, r) => acc + r.gmvTotal, 0);
  const freshness = data?.dataFreshness || {};
  const effectiveCoverage = freshness.effectiveCoverage || {};
  const availablePeriods = freshness.availablePeriods || [];
  const warnings = data?.warnings || [];
  const sourceStatus = data?.sourceStatus || {};
  const goals = data?.goals || {};
  const timeline = data?.gmvTimeline || {};
  const goalTimeline = data?.goalTimeline || {};
  const creatorHealth = data?.creatorHealth || [];
  const healthCounts = creatorHealth.reduce((acc, item) => {
    acc[item.tone] = (acc[item.tone] || 0) + 1;
    return acc;
  }, {});
  const chartData = (timeline.points || []).map((point) => {
    const row = { date: point.date, label: fmtDate(point.date) };
    let total = 0;
    for (const r of ranking) {
      const value = Number(point.am?.[r.am.slug] || 0);
      row[r.am.slug] = value;
      total += value;
    }
    row.total = total;
    return row;
  });
  const goalChartData = (goalTimeline.points || []).map((point) => {
    const row = { ...point, label: fmtDate(point.date) };
    if (selectedAmDrill) {
      const drillPoint = goalTimeline.creators?.[selectedAmDrill]?.find((item) => item.date === point.date);
      for (const [handle, value] of Object.entries(drillPoint?.creators || {})) row[handle] = Number(value || 0);
    }
    return row;
  });
  const selectedRanking = ranking.find((item) => item.am.slug === selectedAmDrill);
  const drillCreators = selectedRanking?.creators?.slice(0, 12) || [];
  const sourceBadges = [
    {
      label: sourceStatus.sales?.ok === false ? "GMV degradado" : "GMV OK",
      ok: sourceStatus.sales?.ok !== false,
      message: sourceStatus.sales?.message || "Snapshot de vendas carregado.",
    },
    {
      label: sourceStatus.notion?.ok === false ? "Cadastro pendente" : "Cadastro OK",
      ok: sourceStatus.notion?.ok !== false,
      message: sourceStatus.notion?.message || "Notion carregado.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      <style jsx global>{`
        @keyframes confetti-bg {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .central-bg {
          background: linear-gradient(135deg, #0A0B12 0%, #1a1033 50%, #0A0B12 100%);
          background-size: 200% 200%;
          animation: confetti-bg 18s ease infinite;
        }
      `}</style>

      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-4 flex items-center gap-1 h-14 overflow-x-auto">
          <Link href="/club" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5">
            ← Club
          </Link>
          {!me?.isAdmin && (
            <Link
              href={`/club/am/${me?.slug || ""}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/80"
            >
              🛡️ Minha carteira
            </Link>
          )}
          {me?.isAdmin && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 text-white/50 whitespace-nowrap">
              🛡️ Gestão das carteiras
            </span>
          )}
          <Link
            href="/club/am/central"
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white"
          >
            🏁 Central da Corrida
          </Link>
          <span className="ml-auto text-[10px] text-white/40 font-mono">
            atualiza a cada 90s
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/5"
          >
            Sair
          </button>
        </div>
      </nav>

      <div className="central-bg min-h-[calc(100vh-56px)]">
        <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-[#a855f7] mb-1">
              🏁 Central dos Account Managers
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
              A <span className="bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#25F4EE] bg-clip-text text-transparent">Corrida</span> do Club
            </h1>
            <p className="text-sm text-white/50 mt-2 max-w-xl mx-auto">
              Quem tá puxando a carteira com mais GMV? Atualiza sozinho — fica de olho 👀
            </p>
            {data?.updatedAt && (
              <p className="text-[10px] text-white/30 font-mono mt-1">
                Última att: {new Date(data.updatedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm text-center">
              ⚠️ {error}
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {sourceBadges.map((source) => (
                <span
                  key={source.label}
                  title={source.message}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                    source.ok
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  {source.label}
                </span>
              ))}
            </div>
              <PartnerCenterDateSelector
                startDate={startDate}
                endDate={endDate}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                onApply={(from, to) => setApplied({ from, to })}
                loading={loading}
                freshness={freshness}
                accent="#a855f7"
              />
            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                {warnings[0]}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14161F] p-2">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {VIEW_TABS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    activeView === view.id
                      ? "bg-white text-black"
                      : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          {(activeView === "overview" || activeView === "goals") && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
            <div className="bg-[#14161F] border border-white/10 rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Alertas da base
              </div>
              <h2 className="mt-1 text-xl font-black">Creators que pedem atenção</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["red", "Crítico"],
                  ["orange", "Atenção"],
                  ["blue", "OK"],
                ].map(([tone, label]) => (
                  <div key={tone} className={`rounded-xl border p-3 ${healthClasses[tone]}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</div>
                    <div className="mt-1 text-2xl font-black">{healthCounts[tone] || 0}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                Regra inicial: vermelho com 7 dias sem GMV ou queda forte; laranja com 4 dias sem GMV ou queda moderada. WhatsApp ainda fica sinalizado como fonte pendente.
              </p>
            </div>

            {goals?.period && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {ranking.map((goal) => (
                  <button
                    key={goal.am.slug}
                    type="button"
                    onClick={() => {
                      setSelectedAmDrill(goal.am.slug);
                      setChartMode("creators");
                    }}
                    className="bg-[#14161F] border border-white/10 rounded-2xl p-4 text-left hover:border-white/25"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                        Meta agosto · carteira
                      </div>
                      <div className="mt-1 text-lg font-black" style={{ color: goal.am.accentColor }}>
                        {goal.am.shortName}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/55">
                      {goal.augustGoal?.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/[0.03] p-2">
                      <div className="text-[9px] uppercase text-white/35">Realizado</div>
                      <div className="font-mono font-bold text-white">{fmtBRL(goal.augustGoal?.realizedGmv)}</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2">
                      <div className="text-[9px] uppercase text-white/35">Meta</div>
                      <div className="font-mono font-bold text-white">{fmtBRL(goal.augustGoal?.targetGmv)}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, goal.augustGoal?.progressPct || 0)}%`,
                        background: goal.am.accentColor,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-white/40">
                    <span>{fmtPct(goal.augustGoal?.progressPct)} da meta</span>
                    <span>Falta {fmtBRL(goal.augustGoal?.gap)}</span>
                  </div>
                  </button>
                ))}
              </div>
            )}
          </section>
          )}

          {activeView === "goals" && (
          <section className="bg-[#14161F] border border-white/10 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Evolução da meta
                </div>
                <h2 className="mt-1 text-xl font-black">
                  {chartMode === "creators" && selectedRanking ? `${selectedRanking.am.shortName}: creators da carteira` : "Gestão macro das carteiras"}
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  Clique em uma carteira acima para quebrar a linha nos creators sem sair da Central.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setChartMode("goal");
                    setSelectedAmDrill("");
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${chartMode === "goal" ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white/60 hover:text-white"}`}
                >
                  % da meta
                </button>
                <button
                  onClick={() => setChartMode("split")}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${chartMode === "split" ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white/60 hover:text-white"}`}
                >
                  GMV por AM
                </button>
              </div>
            </div>

            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={goalChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} width={72} tickFormatter={chartMode === "goal" ? fmtPct : fmtShortBRL} />
                  <Tooltip
                    contentStyle={{ background: "#0A0B12", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                    formatter={(value, name) => [chartMode === "goal" ? fmtPct(value) : fmtBRL(value), String(name).replace(/Pct$|Gmv$/g, "")]}
                  />
                  {chartMode === "creators" && selectedRanking ? (
                    drillCreators.map((creator, index) => (
                      <Line
                        key={creator.handle}
                        type="monotone"
                        dataKey={creator.handle}
                        name={`@${creator.handle}`}
                        stroke={["#25F4EE", "#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#f43f5e", "#14b8a6", "#eab308", "#06b6d4", "#84cc16", "#fb7185"][index % 12]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    ))
                  ) : chartMode === "goal" ? (
                    <>
                      <Line type="monotone" dataKey="totalPct" name="Total" stroke="#25F4EE" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                      {ranking.map((r) => (
                        <Line key={r.am.slug} type="monotone" dataKey={`${r.am.slug}Pct`} name={r.am.shortName} stroke={r.am.accentColor} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                      ))}
                    </>
                  ) : (
                    ranking.map((r) => (
                      <Line key={r.am.slug} type="monotone" dataKey={`${r.am.slug}Gmv`} name={r.am.shortName} stroke={r.am.accentColor} strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          )}

          {/* Pista de corrida */}
          {activeView === "overview" && (
          <div className="bg-gradient-to-br from-[#14161F] to-[#0F111A] border border-white/10 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                🏇 Pista
              </h2>
              <div className="text-right text-xs text-white/40">
                <div>Total combinado: <span className="font-mono font-bold text-white">{fmtBRL(totalGmv)}</span></div>
                <div>Régua = ritmo vs mês anterior; cor abaixo sinaliza risco</div>
              </div>
            </div>

            <div className="space-y-2">
              {ranking.map((r) => {
                const riskTone = r.progressVsPreviousPct < 80 ? "red" : r.progressVsPreviousPct < 100 ? "orange" : "blue";
                const carteiraAlerts = creatorHealth.filter((item) => item.amSlug === r.am.slug && item.tone !== "blue").length;
                return (
                <div key={r.am.slug} className={`relative rounded-2xl border p-3 ${healthClasses[riskTone]}`}>
                  <Horse
                    am={r.am}
                    trackPositionPct={r.trackPositionPct}
                    gmvTotal={r.gmvTotal}
                    position={r.position}
                    isLeader={r.position === 1}
                  />
                  {/* Badge de posição + stats embaixo */}
                  <div className="flex items-center justify-between mt-1 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/40">
                        #{r.position}
                      </span>
                      <span className="text-xs font-bold" style={{ color: r.am.accentColor }}>
                        {r.am.shortName}
                      </span>
                      <span className="text-[10px] text-white/40">
                        · {r.carteiraSize} creators · {r.ativos} ativos
                      </span>
                      {carteiraAlerts > 0 && (
                        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-white/70">
                          {carteiraAlerts} alertas
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40 font-mono">
                        {fmtPct(r.progressVsPreviousPct)} vs período anterior
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono tabular-nums">
                        {fmtBRL(r.gmvTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2 mt-1 text-[10px] text-white/35">
                    <span>Base período anterior: {fmtBRL(r.previousGmvTotal)}</span>
                    {r.progressVsPreviousPct > 100 && (
                      <span className="text-emerald-300 font-bold">
                        +{fmtPct(r.progressVsPreviousPct - 100)} acima da base
                      </span>
                    )}
                    {r.progressVsPreviousPct < 100 && (
                      <span className={riskTone === "red" ? "text-red-200 font-bold" : "text-amber-200 font-bold"}>
                        ritmo abaixo da base
                      </span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          </div>
          )}

          {activeView === "gmv" && (
          <div className="bg-[#14161F] border border-white/10 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Evolução de GMV original
                </div>
                <h2 className="mt-1 text-xl font-black">
                  {legacyChartMode === "total" ? "Carteira completa" : "Camila vs Leonardo"}
                </h2>
                <p className="mt-1 text-xs text-white/40">
                  Gráfico anterior preservado: linha acumulada dia a dia dentro do período selecionado.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-[10px] font-mono uppercase tracking-widest text-white/35">
                  Visão
                  <select
                    value={legacyChartMode}
                    onChange={(event) => setLegacyChartMode(event.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0A0B12] px-3 py-2 text-xs font-bold normal-case tracking-normal text-white"
                  >
                    <option value="split">Camila + Leonardo</option>
                    <option value="total">Carteira completa</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtShortBRL} />
                  <Tooltip
                    contentStyle={{ background: "#0A0B12", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, color: "#fff" }}
                    labelStyle={{ color: "rgba(255,255,255,0.55)" }}
                    formatter={(value) => [fmtBRL(value), "GMV"]}
                  />
                  {legacyChartMode === "total" ? (
                    <Line type="monotone" dataKey="total" name="Carteira completa" stroke="#25F4EE" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                  ) : (
                    ranking.map((r) => (
                      <Line key={r.am.slug} type="monotone" dataKey={r.am.slug} name={r.am.shortName} stroke={r.am.accentColor} strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                    ))
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {activeView === "health" && (
          <section className="bg-[#14161F] border border-white/10 rounded-3xl p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Saúde por creator
                </div>
                <h2 className="mt-1 text-xl font-black">Blocos de alerta e anomalia</h2>
              </div>
              <div className="text-xs text-white/40">
                Ordenado por risco: vermelho, laranja, azul.
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {creatorHealth.map((item) => {
                const owner = ranking.find((r) => r.am.slug === item.amSlug);
                return (
                  <Link
                    key={`${item.amSlug}-${item.handle}`}
                    href={`/club/am/${item.amSlug}/creator/${encodeURIComponent(item.handle)}`}
                    className={`block rounded-2xl border p-4 transition hover:border-white/40 ${healthClasses[item.tone] || healthClasses.blue}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: healthDot[item.tone] || healthDot.blue }} />
                          <h3 className="truncate text-sm font-black text-white">{item.nome || item.handle}</h3>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-white/45">
                          @{item.handle} · {owner?.am.shortName || item.amSlug}
                        </p>
                      </div>
                      <span className="rounded-full bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-wide">
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[9px] uppercase text-white/35">GMV</div>
                        <b className="font-mono text-white">{fmtShortBRL(item.gmv)}</b>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-white/35">7 dias</div>
                        <b className="font-mono text-white">{fmtShortBRL(item.last7Gmv)}</b>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-white/35">Últ. atividade</div>
                        <b className="font-mono text-white">{item.daysWithoutActivity === null ? "—" : `${item.daysWithoutActivity}d`}</b>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {(item.reasons?.length ? item.reasons : ["sem anomalia relevante"]).map((reason) => (
                        <div key={reason} className="text-[11px] text-white/60">• {reason}</div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
          )}

          {/* Ranking detalhado */}
          {activeView === "ranking" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ranking.map((r) => (
              <div
                key={r.am.slug}
                className="bg-[#14161F] border-2 rounded-2xl p-5 transition-all"
                style={{
                  borderColor: r.position === 1 ? r.am.accentColor : "rgba(255,255,255,0.1)",
                  boxShadow: r.position === 1 ? `0 0 30px ${r.am.accentColor}30` : "none",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{
                      borderColor: r.am.accentColor,
                      background: r.am.photo ? "transparent" : `${r.am.accentColor}30`,
                      color: r.am.accentColor,
                    }}
                  >
                    {r.am.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.am.photo} alt={r.am.displayName} className="w-full h-full object-cover" />
                    ) : (
                      r.am.emoji || r.am.displayName[0]
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold">{r.am.displayName}</h3>
                      {r.position === 1 && <span className="text-lg">👑</span>}
                      {r.am.isPlaceholder && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold">
                          reserva
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">
                      #{r.position} · {r.carteiraSize} creators · {r.ativos} ativos
                      {r.am.supervisedBy ? " · acompanhamento Leonardo" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black tabular-nums" style={{ color: r.am.accentColor }}>
                      {fmtBRL(r.gmvTotal)}
                    </div>
                    <div className="text-[10px] text-white/40">GMV carteira</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-white/40 uppercase">Comissão</div>
                    <div className="text-xs font-bold text-white">{fmtBRL(r.comissaoTotal)}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-white/40 uppercase">Receita Amplify</div>
                    <div className="text-xs font-bold text-[#25F4EE]">{fmtBRL(r.receitaTotal)}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-white/40 uppercase">Vs período anterior</div>
                    <div className="text-xs font-bold text-white">
                      {r.previousGmvTotal > 0 ? fmtPct(r.progressVsPreviousPct) : "—"}
                    </div>
                  </div>
                </div>

                {r.top5.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
                      🏆 Top 5 da carteira
                    </p>
                    <div className="space-y-1">
                      {r.top5.slice(0, 5).map((c, i) => (
                        <div key={c.handle} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-white/30 font-mono w-4">{i + 1}.</span>
                            {c.notionUrl ? (
                              <a href={c.notionUrl} target="_blank" rel="noreferrer" className="font-bold truncate hover:text-[#25F4EE]">
                                {c.nome}
                              </a>
                            ) : (
                              <span className="font-bold truncate">{c.nome}</span>
                            )}
                            <a href={tiktokProfileUrl(c.handle)} target="_blank" rel="noreferrer" className="text-white/40 text-[10px] hover:text-[#25F4EE] hover:underline">
                              @{c.handle}
                            </a>
                            {c.source === "partner_center_only" && (
                              <span className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1">
                                sem cadastro
                              </span>
                            )}
                          </div>
                          <span className="font-mono tabular-nums text-white/80 flex-shrink-0">
                            {fmtBRL(c.gmv)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link
                  href={`/club/am/${r.am.slug}`}
                  className="block mt-4 text-center py-2 rounded-lg text-xs font-bold border border-white/10 hover:border-white/30 text-white/70 hover:text-white"
                >
                  Ver carteira completa →
                </Link>
              </div>
            ))}
          </div>
          )}

          <p className="text-center text-[10px] text-white/30 pb-4">
            Refresha a cada 90s · próxima att em {90 - (Math.floor(Date.now() / 1000) % 90)}s
          </p>

          {warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-100 text-sm">
              <div className="space-y-1 text-xs text-amber-100/80">
                {warnings.map((w) => (
                  <div key={w}>• {w}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
