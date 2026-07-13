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

/** Cavalinho animado — foto circular com bobbing idle e posição X animada */
function Horse({ am, trackPositionPct, gmvTotal, position, isLeader }) {
  const ref = useRef(null);
  const [prevPct, setPrevPct] = useState(trackPositionPct);

  // Quando o pct muda, anima suavemente
  useEffect(() => {
    if (!ref.current) return;
    if (Math.abs(prevPct - trackPositionPct) < 0.5) return;
    ref.current.animate(
      [
        { transform: `translateX(${prevPct}%)` },
        { transform: `translateX(${trackPositionPct}%)` },
      ],
      { duration: 1800, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" },
    );
    setPrevPct(trackPositionPct);
  }, [trackPositionPct, prevPct]);

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
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ transform: `translateX(${trackPositionPct}%) translateY(-50%)` }}
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

      const res = await fetch("/api/am/central", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro ao carregar central.");
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
  }, []);

  // Auto-refresh a cada 90s
  useEffect(() => {
    const t = setInterval(() => {
      load();
      setTick((x) => x + 1);
    }, 90 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Link
            href={`/club/am/${me?.slug || ""}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/80"
          >
            🛡️ Minha carteira
          </Link>
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

          {/* Pista de corrida */}
          <div className="bg-gradient-to-br from-[#14161F] to-[#0F111A] border border-white/10 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                🏇 Pista
              </h2>
              <div className="text-xs text-white/40">
                Total combinado: <span className="font-mono font-bold text-white">{fmtBRL(totalGmv)}</span>
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
                        {r.trackPositionPct.toFixed(1)}% da pista
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono tabular-nums">
                        {fmtBRL(r.gmvTotal)}
                      </span>
                    </div>
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
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">
                      #{r.position} · {r.carteiraSize} creators · {r.ativos} ativos
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
                    <div className="text-[9px] text-white/40 uppercase">Receita</div>
                    <div className="text-xs font-bold text-[#25F4EE]">{fmtBRL(r.receitaTotal)}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-white/40 uppercase">Ticket médio</div>
                    <div className="text-xs font-bold text-white">
                      {r.ativos > 0 ? fmtBRL(r.gmvTotal / r.ativos) : "—"}
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
                            <span className="font-bold truncate">{c.nome}</span>
                            <span className="text-white/40 text-[10px]">@{c.handle}</span>
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
        </div>
      </div>
    </div>
  );
}