"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import registrySeed from "@/data/hub-registry.json";
import { HUB_AREAS } from "@/lib/hub-areas";
import { formatAreaMetric, formatKrCurrent, krProgressFor, metricsForArea, totalKrs } from "@/lib/hub-area-metrics";

function AreaCard({ area, summary, registry }) {
  const metrics = metricsForArea(area, summary);
  const krs = (area.objectives || []).flatMap((objective) => objective.krs || []);
  const activeItems = (registry?.items || []).filter((item) => item.active && item.areas.includes(area.id));
  const tools = activeItems.filter((item) => item.category !== "link");
  const links = activeItems.filter((item) => item.category === "link");
  return (
    <Link href={`/hub/area/${area.id}`} className={`${area.position} group block min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`} aria-label={`Abrir area ${area.name}`}>
      <article className="relative flex h-full min-h-[460px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14161d] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20" style={{ boxShadow: `0 22px 70px ${area.color}0D` }}>
        <div className="h-1.5 w-full" style={{ background: area.color, boxShadow: `0 0 22px ${area.color}70` }} />
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-xs font-black tracking-[0.12em]" style={{ color: area.color, borderColor: `${area.color}45`, background: `${area.color}10` }}>{area.short}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Lider · {area.leader}</p><h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{area.name}</h2></div></div><span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45 transition group-hover:text-white">Abrir</span></div>
          <p className="mt-4 min-h-12 max-w-xl text-sm leading-6 text-white/50">{area.description}</p>
          <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`KPIs de ${area.name}`}>{metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 p-3" title={metric.source || metric.label}><div className="line-clamp-2 min-h-7 text-[9px] font-bold uppercase leading-3 tracking-wider text-white/30">{metric.label}</div><div className="mt-1 truncate text-sm font-black sm:text-base" style={{ color: metric.value === null ? "rgba(255,255,255,.3)" : area.color }}>{formatAreaMetric(metric.value, metric.format)}</div></div>)}</div>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">KRs · Mission Control</p><span className="text-[9px] font-bold" style={{ color: area.color }}>{totalKrs(area) || "pendente"}</span></div>{krs.length ? <div className="mt-2 space-y-1.5">{krs.slice(0, 3).map((kr, index) => { const progress = krProgressFor(area, kr, summary); return <div key={`${kr.label}-${index}`} className="flex min-w-0 items-center gap-2 text-[10px]"><span className="shrink-0 font-black" style={{ color: area.color }}>KR{index + 1}</span><span className="min-w-0 flex-1 truncate text-white/50">{kr.label}</span><strong className="shrink-0 text-white/75">{formatKrCurrent(progress, kr.target)}</strong></div>; })}{krs.length > 3 && <div className="text-[9px] text-white/30">+ {krs.length - 3} KRs na area</div>}</div> : <p className="mt-2 text-[10px] text-white/35">KRs ainda nao preenchidos no Mission Control.</p>}</div>
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">Ferramentas</p><p className="mt-1 text-xs font-bold text-white/55">{tools.length} acessos</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">Outros links</p><p className="mt-1 text-xs font-bold text-white/55">{links.length} acessos</p></div></div>
        </div>
      </article>
    </Link>
  );
}

export default function HubAreasHome() {
  const [summary, setSummary] = useState(null);
  const [registry, setRegistry] = useState(registrySeed);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [registryLabel, setRegistryLabel] = useState(`Registro global · revisao ${registrySeed.revision}`);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch(`/api/hub-summary?_=${Date.now()}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("summary"))),
      fetch(`/api/hub-registry?_=${Date.now()}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("registry"))),
    ]).then(([summaryResult, registryResult]) => {
      if (!active) return;
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setUpdatedAt(summaryResult.value.missionControl?.updatedAt || summaryResult.value.updatedAt || new Date().toISOString());
      } else {
        setSummary(null);
        setUpdatedAt(null);
      }
      if (registryResult.status === "fulfilled" && registryResult.value?.ok && registryResult.value.registry) {
        setRegistry(registryResult.value.registry);
        setRegistryLabel(`Registro global · revisao ${registryResult.value.registry.revision}`);
      } else {
        setRegistry(registrySeed);
        setRegistryLabel("Registro global · contingencia");
      }
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090a0f] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#25F4EE]">Amplify Hub · pagina inicial dos projetos</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Escolha a area para entrar</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">KRs e KPIs seguem a mesma fonte do Mission Control. Cada dashboard possui um cadastro global e pode atender varias areas sem duplicacao.</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">{updatedAt ? `Mission Control atualizado ${new Date(updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Carregando Mission Control"}</span><span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">{registryLabel}</span><Link href="/hub/gestao" className="rounded-lg border border-[#25F4EE]/25 bg-[#25F4EE]/[0.05] px-3 py-2 text-xs font-bold text-[#25F4EE] transition hover:border-[#25F4EE]/50">Gerenciar Hub</Link><Link href="/hub/projetos" className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/65 transition hover:border-white/25 hover:text-white">Projetos e Fluxos →</Link></div>
        </header>
        <section aria-label="Areas da Amplify" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">{HUB_AREAS.map((area) => <AreaCard key={area.id} area={area} summary={summary} registry={registry} />)}</section>
      </div>
    </main>
  );
}
