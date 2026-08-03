"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import registrySeed from "@/data/hub-registry.json";
import { HUB_AREAS } from "@/lib/hub-areas";
import { formatAreaMetric, formatKrCurrent, krProgressFor, metricsForArea } from "@/lib/hub-area-metrics";

const HEALTH = {
  healthy: { label: "Saudavel", color: "#32D74B" },
  attention: { label: "Atencao", color: "#FFD60A" },
  stale: { label: "Desatualizado", color: "#FF9F0A" },
  offline: { label: "Fora do ar", color: "#FF453A" },
  unknown: { label: "Nao verificado", color: "#9CA3AF" },
};

function itemsForArea(registry, areaId) {
  return (registry?.items || [])
    .filter((item) => item.active && item.areas.includes(areaId))
    .sort((left, right) => (left.orderByArea?.[areaId] ?? 9999) - (right.orderByArea?.[areaId] ?? 9999) || left.title.localeCompare(right.title, "pt-BR"));
}

function AppCard({ app, color }) {
  const external = app.href.startsWith("http");
  const health = HEALTH[app.health] || HEALTH.unknown;
  const sharedAreas = app.areas.map((id) => HUB_AREAS.find((candidate) => candidate.id === id)?.name || id);
  return (
    <article className={`relative flex min-h-[250px] min-w-0 flex-col rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 ${app.featured ? "border-white/20 bg-white/[0.075]" : "border-white/[0.08] bg-[#14161d] hover:border-white/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">{app.kind}</span>
        <span className="shrink-0 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: health.color, borderColor: `${health.color}35`, background: `${health.color}0D` }}>{health.label}</span>
      </div>
      <h3 className="mt-4 text-lg font-black text-white">{app.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/45">{app.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4 text-[10px]">
        <div><dt className="uppercase tracking-wider text-white/25">Responsavel</dt><dd className="mt-1 truncate text-white/55" title={app.owner}>{app.owner}</dd></div>
        <div><dt className="uppercase tracking-wider text-white/25">Status</dt><dd className="mt-1 truncate font-bold" style={{ color }}>{app.status}</dd></div>
        <div className="col-span-2"><dt className="uppercase tracking-wider text-white/25">Fonte · periodo</dt><dd className="mt-1 line-clamp-2 text-white/55" title={`${app.source} · ${app.period}`}>{app.source} · {app.period}</dd></div>
      </dl>
      {sharedAreas.length > 1 && <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-[9px] font-bold uppercase tracking-wider text-white/25">Compartilhado</span>{sharedAreas.map((name) => <span key={name} className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] text-white/45">{name}</span>)}</div>}
      <a href={app.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="mt-auto flex min-h-11 items-end justify-between border-t border-white/[0.08] pt-4 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <span className="text-white/30">{external ? "Sistema externo" : "Dentro do Hub"}</span>
        <span style={{ color }}>{external ? "Abrir ↗" : "Abrir →"}</span>
      </a>
    </article>
  );
}

function KrSection({ area, summary }) {
  if (!area.objectives.length) return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/35">KRs ainda nao preenchidos no Mission Control.</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {area.objectives.map((objective) => (
        <article key={objective.title} className="rounded-2xl border border-white/[0.08] bg-[#14161d] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color: area.color }}>Objetivo</p>
          <h3 className="mt-2 text-base font-black text-white">{objective.title}</h3>
          <div className="mt-4 space-y-2">
            {objective.krs.map((kr, index) => {
              const progress = krProgressFor(area, kr, summary);
              return <div key={`${kr.label}-${index}`} className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><div className="flex items-start gap-3"><span className="shrink-0 text-[10px] font-black" style={{ color: area.color }}>KR{index + 1}</span><span className="min-w-0 flex-1 text-sm text-white/55">{kr.label}</span><strong className="shrink-0 text-sm text-white/80">{formatKrCurrent(progress, kr.target)}</strong></div>{progress?.reference && <p className="mt-2 text-[9px] text-white/25">{progress.reference}</p>}</div>;
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

function AccessGroup({ title, description, items, area }) {
  return (
    <section className="mt-7" aria-labelledby={`group-${title.replace(/\s/g, "-")}`}>
      <div className="flex items-end justify-between gap-4"><div><h2 id={`group-${title.replace(/\s/g, "-")}`} className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-white/35">{description}</p></div><span className="text-xs font-bold text-white/30">{items.length}</span></div>
      {items.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <AppCard key={item.id} app={item} color={area.color} />)}</div> : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/30">Nenhum acesso ativo neste grupo.</div>}
    </section>
  );
}

export default function HubAreaView({ area }) {
  const [summary, setSummary] = useState(null);
  const [registry, setRegistry] = useState(registrySeed);
  const [registryState, setRegistryState] = useState("Registro central");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch(`/api/hub-summary?_=${Date.now()}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("summary"))),
      fetch(`/api/hub-registry?_=${Date.now()}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("registry"))),
    ]).then(([summaryResult, registryResult]) => {
      if (!active) return;
      setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      if (registryResult.status === "fulfilled" && registryResult.value?.ok && registryResult.value.registry) {
        setRegistry(registryResult.value.registry);
        setRegistryState(`Registro central · revisao ${registryResult.value.registry.revision}`);
      } else {
        setRegistry(registrySeed);
        setRegistryState("Registro de contingencia");
      }
    });
    return () => { active = false; };
  }, []);

  const allItems = useMemo(() => itemsForArea(registry, area.id), [registry, area.id]);
  const tools = allItems.filter((item) => item.category !== "link");
  const links = allItems.filter((item) => item.category === "link");
  const metrics = metricsForArea(area, summary);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090a0f] text-white">
      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-white/35" aria-label="Navegacao do Hub"><Link href="/hub" className="min-h-11 rounded-lg border border-white/10 px-3 py-3 font-bold text-white/55 transition hover:text-white">← Todas as areas</Link><span>/</span><span style={{ color: area.color }}>{area.name}</span><span className="ml-auto hidden text-[9px] font-bold uppercase tracking-wider text-white/25 sm:block">{registryState}</span></nav>

        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#14161d] p-5 sm:p-7 lg:p-9" style={{ boxShadow: `0 24px 100px ${area.color}12` }}>
          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: area.color, boxShadow: `0 0 28px ${area.color}80` }} />
          <div className="relative grid gap-8 xl:grid-cols-[1fr_520px] xl:items-end">
            <div><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl border text-xs font-black tracking-[.14em]" style={{ color: area.color, borderColor: `${area.color}45`, background: `${area.color}12` }}>{area.short}</span><div><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Area · Lider {area.leader}</p><h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{area.name}</h1></div></div><p className="mt-5 max-w-3xl text-base leading-7 text-white/55">{area.description}</p><p className="mt-4 max-w-3xl text-sm font-semibold text-white/70">{area.objective}</p></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label={`KPIs de ${area.name}`}>{metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-xl border border-white/[0.08] bg-black/20 p-4" title={metric.source || metric.label}><div className="min-h-7 text-[9px] font-bold uppercase leading-3 tracking-wider text-white/30">{metric.label}</div><div className="mt-2 truncate text-lg font-black" style={{ color: metric.value === null ? "rgba(255,255,255,.3)" : area.color }}>{formatAreaMetric(metric.value, metric.format)}</div></div>)}</div>
          </div>
        </header>

        {area.preserveNotice && <aside className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/70">{area.preserveNotice}</aside>}

        <section className="mt-8" aria-labelledby="kr-title"><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Mesma fonte do Mission Control</p><h2 id="kr-title" className="mt-1 mb-4 text-2xl font-black">Objetivos e KRs</h2><KrSection area={area} summary={summary} /></section>

        <section className="mt-9 border-t border-white/[0.08] pt-7" aria-labelledby="access-title"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Acessos da area</p><h2 id="access-title" className="mt-1 text-2xl font-black">Ferramentas e outros links</h2><p className="mt-2 text-sm text-white/35">{allItems.length} acessos ativos do registro global. Um mesmo item pode atender varias areas.</p></div><Link href={`/hub/gestao?area=${area.id}`} className="min-h-11 rounded-xl border px-4 py-3 text-center text-sm font-black transition hover:-translate-y-0.5" style={{ color: area.color, borderColor: `${area.color}55`, background: `${area.color}10` }}>Gerenciar esta area</Link></div></section>

        <AccessGroup title="Ferramentas" description="Dashboards, sistemas, fluxos e recursos operacionais." items={tools} area={area} />
        <AccessGroup title="Outros links" description="Landing pages, propostas, referencias e destinos complementares." items={links} area={area} />
      </div>
    </main>
  );
}
