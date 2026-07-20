"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const fmtBRL = (n) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
const fmtPct = (n) => `${Number(n || 0).toFixed(0)}%`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (dateString) => {
  if (!dateString) return "—";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

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
  const requestedPeriod = freshness.requestedPeriod || applied;
  const effectiveCoverage = freshness.effectiveCoverage || {};
  const availablePeriods = freshness.availablePeriods || [];

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

          <div className="bg-[#14161F] border border-white/10 rounded-2xl p-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Período contabilizado
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  Pedido: {fmtDate(requestedPeriod?.from)} → {fmtDate(requestedPeriod?.to)}
                </div>
                <div className="text-xs text-white/45 mt-0.5">
                  Usado no cálculo: {fmtDate(effectiveCoverage?.from)} → {fmtDate(effectiveCoverage?.to)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#0A0B12] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#a855f7]"
                />
                <span className="text-white/30 text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#0A0B12] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#a855f7]"
                />
                <button
                  onClick={() => setApplied({ from: startDate, to: endDate })}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#a855f7] hover:bg-[#9333ea]"
                >
                  Aplicar período
                </button>
              </div>
            </div>
            {availablePeriods.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {availablePeriods.slice(-7).map((period) => (
                  <button
                    key={`${period.start}-${period.endInclusive}`}
                    onClick={() => {
                      setStartDate(period.start);
                      setEndDate(period.endInclusive);
                      setApplied({ from: period.start, to: period.endInclusive });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                      requestedPeriod?.from === period.start && requestedPeriod?.to === period.endInclusive
                        ? "bg-white text-black border-white"
                        : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {period.month}{period.partial ? " parcial" : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-white/40 mt-3">
              TikTok Shop Partner Center · {(effectiveCoverage?.snapshots || []).length} snapshot{(effectiveCoverage?.snapshots || []).length === 1 ? "" : "s"} · {effectiveCoverage?.mode === "overlap_approximation" ? "aproximação por cobertura disponível" : "cobertura exata/contida"}
            </div>
          </div>

          {/* Pista de corrida */}
          <div className="bg-gradient-to-br from-[#14161F] to-[#0F111A] border border-white/10 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                🏇 Pista
              </h2>
              <div className="text-right text-xs text-white/40">
                <div>Total combinado: <span className="font-mono font-bold text-white">{fmtBRL(totalGmv)}</span></div>
                <div>Régua = GMV do mês passado por carteira</div>
              </div>
            </div>

            <div className="space-y-2">
              {ranking.map((r) => (
                <div key={r.am.slug} className="relative">
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
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40 font-mono">
                        {fmtPct(r.progressVsPreviousPct)} vs mês passado
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono tabular-nums">
                        {fmtBRL(r.gmvTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2 mt-1 text-[10px] text-white/35">
                    <span>Base mês passado: {fmtBRL(r.previousGmvTotal)}</span>
                    {r.progressVsPreviousPct > 100 && (
                      <span className="text-emerald-300 font-bold">
                        +{fmtPct(r.progressVsPreviousPct - 100)} acima da base
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking detalhado */}
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
                    <div className="text-[9px] text-white/40 uppercase">Vs mês passado</div>
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
                            <span className="text-white/40 text-[10px]">@{c.handle}</span>
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

          <p className="text-center text-[10px] text-white/30 pb-4">
            Refresha a cada 90s · próxima att em {90 - (Math.floor(Date.now() / 1000) % 90)}s
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-100 text-sm">
            <div className="font-bold mb-1">Fontes de dados em atenção</div>
              <div className="space-y-1 text-xs text-amber-100/80">
                <div>• GMV e comissão devem vir do snapshot diário TikTok Shop/Partner Center; a central não deve abrir o Partner Center ao vivo a cada refresh.</div>
                <div>• Notion entra só como cadastro auxiliar: nome, categoria e link do perfil.</div>
                <div>• Vencimento de contrato não aparece aqui enquanto o Partner Center/snapshot não trouxer esse campo.</div>
                <div>• Drive/planilhas não são fonte final de granularidade quando o snapshot TikTok Shop estiver disponível.</div>
              {(data?.warnings || []).map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
