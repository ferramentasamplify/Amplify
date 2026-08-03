"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HUB_AREAS, catalogApps } from "@/lib/hub-areas";
import { formatAreaMetric, formatKrCurrent, krProgressFor, metricsForArea } from "@/lib/hub-area-metrics";

const STORAGE_KEY = "amplify-hub-area-library:v1";

function readSelections() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeAreaSelection(value) {
  if (Array.isArray(value)) return { added: value, hidden: [] };
  return {
    added: Array.isArray(value?.added) ? value.added : [],
    hidden: Array.isArray(value?.hidden) ? value.hidden : [],
  };
}

function AppCard({ app, color, imported, onRemove }) {
  const external = app.href.startsWith("http");
  return (
    <article className={`relative flex min-h-[210px] flex-col rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 ${app.featured ? "border-white/20 bg-white/[0.075]" : "border-white/[0.08] bg-[#14161d] hover:border-white/20"}`}>
      <div className="flex items-start justify-between gap-3 pr-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">{app.kind}</span>
        <span className="rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color, borderColor: `${color}35`, background: `${color}0D` }}>{app.status}</span>
      </div>
      {imported && <span className="mt-3 w-fit rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45">De {app.sourceAreaName}</span>}
      <h3 className="mt-4 text-lg font-black text-white">{app.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/45">{app.description}</p>
      <a href={app.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="mt-auto flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <span className="text-white/30">{external ? "Sistema externo" : "Dentro do Hub"}</span>
        <span style={{ color }}>{external ? "Abrir ↗" : "Abrir →"}</span>
      </a>
      <button type="button" onClick={onRemove} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/25 text-sm text-white/45 transition hover:border-red-300/30 hover:text-red-200" aria-label={`Remover ${app.title} desta area`} title="Remover desta area">×</button>
    </article>
  );
}

function KrSection({ area, summary }) {
  if (!area.objectives.length) {
    return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/35">KRs ainda nao preenchidos no Mission Control.</div>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {area.objectives.map((objective) => (
        <article key={objective.title} className="rounded-2xl border border-white/[0.08] bg-[#14161d] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color: area.color }}>Objetivo</p>
          <h3 className="mt-2 text-base font-black text-white">{objective.title}</h3>
          <div className="mt-4 space-y-2">
            {objective.krs.map((kr, index) => {
              const progress = krProgressFor(area, kr, summary);
              return (
                <div key={`${kr.label}-${index}`} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-[10px] font-black" style={{ color: area.color }}>KR{index + 1}</span>
                    <span className="min-w-0 flex-1 text-sm text-white/55">{kr.label}</span>
                    <strong className="shrink-0 text-sm text-white/80">{formatKrCurrent(progress, kr.target)}</strong>
                  </div>
                  {progress?.reference && <p className="mt-2 text-[9px] text-white/25">{progress.reference}</p>}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

function LibraryPicker({ area, selectedIds, hiddenIds, onToggle, onClose }) {
  const [sourceArea, setSourceArea] = useState(area.id);
  const source = HUB_AREAS.find((item) => item.id === sourceArea);
  return (
    <section className="mt-5 rounded-2xl border border-white/15 bg-[#101218] p-4 sm:p-6" aria-labelledby="library-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Biblioteca compartilhada</p>
          <h3 id="library-title" className="mt-1 text-xl font-black">Escolher ferramentas e links</h3>
          <p className="mt-2 text-sm text-white/40">Marque para mostrar e desmarque para remover. A selecao fica salva neste dispositivo.</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs font-bold text-white/55 hover:text-white">Fechar</button>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Areas da biblioteca">
        {HUB_AREAS.map((item) => (
          <button key={item.id} type="button" onClick={() => setSourceArea(item.id)} className="min-h-11 shrink-0 rounded-lg border px-3 text-xs font-bold transition" style={{ color: sourceArea === item.id ? item.color : "rgba(255,255,255,.45)", borderColor: sourceArea === item.id ? `${item.color}70` : "rgba(255,255,255,.1)", background: sourceArea === item.id ? `${item.color}12` : "transparent" }}>{item.name}</button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(source?.apps || []).map((item) => {
          const checked = sourceArea === area.id ? !hiddenIds.includes(item.id) : selectedIds.includes(item.id);
          return (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-white/20">
              <input type="checkbox" checked={checked} onChange={() => onToggle(sourceArea, item.id)} className="mt-1 h-5 w-5 accent-white" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-white/40">{item.kind} · {item.category === "link" ? "Outros links" : "Ferramentas"}</span>
              </span>
              <span className="text-xs font-black" style={{ color: checked ? area.color : "rgba(255,255,255,.25)" }}>{checked ? "Adicionado" : "+"}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function AccessGroup({ title, description, items, area, selectedIds, onRemove }) {
  return (
    <section className="mt-7" aria-labelledby={`group-${title.replace(/\s/g, "-")}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={`group-${title.replace(/\s/g, "-")}`} className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-white/35">{description}</p>
        </div>
        <span className="text-xs font-bold text-white/30">{items.length}</span>
      </div>
      {items.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <AppCard key={`${item.sourceAreaId || area.id}:${item.id}`} app={item} color={item.sourceColor || area.color} imported={Boolean(item.sourceAreaId && item.sourceAreaId !== area.id)} onRemove={() => onRemove(item.sourceAreaId || area.id, item.id)} />)}
        </div>
      ) : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/30">Nenhum acesso selecionado neste grupo.</div>}
    </section>
  );
}

export default function HubAreaView({ area }) {
  const [summary, setSummary] = useState(null);
  const [selections, setSelections] = useState({});
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSelections(readSelections());
    fetch(`/api/hub-summary?_=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("summary")))
      .then((data) => active && setSummary(data))
      .catch(() => active && setSummary(null));
    return () => { active = false; };
  }, []);

  const areaSelection = normalizeAreaSelection(selections[area.id]);
  const selectedIds = areaSelection.added;
  const hiddenIds = areaSelection.hidden;
  const catalog = useMemo(() => catalogApps(), []);
  const imported = catalog.filter((item) => item.sourceAreaId !== area.id && selectedIds.includes(item.id));
  const ownItems = area.apps.filter((item) => !hiddenIds.includes(item.id));
  const allItems = [...ownItems, ...imported];
  const tools = allItems.filter((item) => item.category !== "link");
  const links = allItems.filter((item) => item.category === "link");
  const metrics = metricsForArea(area, summary);

  function saveSelection(nextAreaSelection) {
    const next = { ...selections, [area.id]: nextAreaSelection };
    setSelections(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleItem(sourceAreaId, id) {
    if (sourceAreaId === area.id) {
      const hidden = hiddenIds.includes(id) ? hiddenIds.filter((item) => item !== id) : [...hiddenIds, id];
      saveSelection({ added: selectedIds, hidden });
      return;
    }
    const added = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    saveSelection({ added, hidden: hiddenIds });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090a0f] text-white">
      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-white/35" aria-label="Navegacao do Hub">
          <Link href="/hub" className="min-h-11 rounded-lg border border-white/10 px-3 py-3 font-bold text-white/55 transition hover:text-white">← Todas as areas</Link><span>/</span><span style={{ color: area.color }}>{area.name}</span>
        </nav>

        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#14161d] p-5 sm:p-7 lg:p-9" style={{ boxShadow: `0 24px 100px ${area.color}12` }}>
          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: area.color, boxShadow: `0 0 28px ${area.color}80` }} />
          <div className="relative grid gap-8 xl:grid-cols-[1fr_520px] xl:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border text-xs font-black tracking-[.14em]" style={{ color: area.color, borderColor: `${area.color}45`, background: `${area.color}12` }}>{area.short}</span>
                <div><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Area · Lider {area.leader}</p><h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{area.name}</h1></div>
              </div>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/55">{area.description}</p>
              <p className="mt-4 max-w-3xl text-sm font-semibold text-white/70">{area.objective}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label={`KPIs de ${area.name}`}>
              {metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-xl border border-white/[0.08] bg-black/20 p-4" title={metric.source || metric.label}><div className="min-h-7 text-[9px] font-bold uppercase leading-3 tracking-wider text-white/30">{metric.label}</div><div className="mt-2 truncate text-lg font-black" style={{ color: metric.value === null ? "rgba(255,255,255,.3)" : area.color }}>{formatAreaMetric(metric.value, metric.format)}</div></div>)}
            </div>
          </div>
        </header>

        {area.preserveNotice && <aside className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/70">{area.preserveNotice}</aside>}

        <section className="mt-8" aria-labelledby="kr-title">
          <p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Mesma fonte do Mission Control</p>
          <h2 id="kr-title" className="mt-1 mb-4 text-2xl font-black">Objetivos e KRs</h2>
          <KrSection area={area} summary={summary} />
        </section>

        <section className="mt-9 border-t border-white/[0.08] pt-7" aria-labelledby="access-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: area.color }}>Acessos da area</p><h2 id="access-title" className="mt-1 text-2xl font-black">Ferramentas e outros links</h2><p className="mt-2 text-sm text-white/35">Itens proprios + {imported.length} {imported.length === 1 ? "selecionado" : "selecionados"} de outras areas.</p></div>
            <button type="button" onClick={() => setLibraryOpen((open) => !open)} className="min-h-11 rounded-xl border px-4 text-sm font-black transition hover:-translate-y-0.5" style={{ color: area.color, borderColor: `${area.color}55`, background: `${area.color}10` }}>{libraryOpen ? "Fechar biblioteca" : "Gerenciar ferramentas e links"}</button>
          </div>
          {libraryOpen && <LibraryPicker area={area} selectedIds={selectedIds} hiddenIds={hiddenIds} onToggle={toggleItem} onClose={() => setLibraryOpen(false)} />}
        </section>

        <AccessGroup title="Ferramentas" description="Dashboards, sistemas, fluxos e recursos operacionais." items={tools} area={area} selectedIds={selectedIds} onRemove={toggleItem} />
        <AccessGroup title="Outros links" description="Landing pages, propostas, referencias e destinos complementares." items={links} area={area} selectedIds={selectedIds} onRemove={toggleItem} />
      </div>
    </main>
  );
}
