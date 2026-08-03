"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import registrySeed from "@/data/hub-registry.json";
import { HUB_AREAS } from "@/lib/hub-areas";

const SESSION_KEY = "amplify-hub-registry-admin-key";
const HEALTH = ["healthy", "attention", "stale", "offline", "unknown"];
const HEALTH_LABEL = { healthy: "Saudavel", attention: "Atencao", stale: "Desatualizado", offline: "Fora do ar", unknown: "Nao verificado" };
const HEALTH_COLOR = { healthy: "#32D74B", attention: "#FFD60A", stale: "#FF9F0A", offline: "#FF453A", unknown: "#9CA3AF" };

function emptyItem(areaId = HUB_AREAS[0].id) {
  return {
    id: "",
    title: "",
    description: "",
    kind: "Dashboard",
    category: "tool",
    href: "",
    status: "operacional",
    health: "unknown",
    active: true,
    featured: false,
    owner: "",
    dataOwner: "",
    source: "",
    period: "Atual",
    cadence: "Diaria",
    lastDataAt: null,
    areas: [areaId],
    orderByArea: { [areaId]: 10 },
  };
}

function cloneItem(item) {
  return JSON.parse(JSON.stringify(item));
}

function formatDate(value) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nao informado" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Field({ label, hint, children, full = false }) {
  return (
    <label className={`block min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-black uppercase tracking-[.14em] text-white/45">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-4 text-white/30">{hint}</span>}
    </label>
  );
}

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#25F4EE]/60 focus:ring-2 focus:ring-[#25F4EE]/15";

function Editor({ item, isNew, revision, adminKey, setAdminKey, onSaved, onClose }) {
  const [draft, setDraft] = useState(() => cloneItem(item));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function set(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function toggleArea(areaId) {
    setDraft((current) => {
      const selected = current.areas.includes(areaId);
      const areas = selected ? current.areas.filter((id) => id !== areaId) : [...current.areas, areaId];
      const orderByArea = { ...current.orderByArea };
      if (selected) delete orderByArea[areaId];
      else orderByArea[areaId] = 10;
      return { ...current, areas, orderByArea };
    });
  }

  async function save(event) {
    event.preventDefault();
    if (!adminKey) {
      setFeedback({ type: "error", text: "Informe a chave administrativa para salvar." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      window.sessionStorage.setItem(SESSION_KEY, adminKey);
      const response = await fetch("/api/hub-registry", {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json", "x-hub-admin-key": adminKey },
        body: JSON.stringify({ expectedRevision: revision, item: draft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `Falha HTTP ${response.status}`);
      onSaved(data.registry, isNew ? "Item criado no registro global." : "Alteracoes publicadas para todas as areas.");
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="registry-editor-title">
      <form onSubmit={save} className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#101218] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101218]/95 p-5 backdrop-blur sm:p-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#25F4EE]">Registro global</p>
            <h2 id="registry-editor-title" className="mt-1 text-2xl font-black">{isNew ? "Cadastrar novo acesso" : `Editar ${draft.title}`}</h2>
            <p className="mt-2 text-xs text-white/40">Uma alteracao vale para todas as areas selecionadas.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-bold text-white/60 hover:text-white">Fechar</button>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
          <Field label="ID global" hint={isNew ? "Slug permanente. Depois de criado, nao deve mudar." : "ID permanente do ativo."}>
            <input className={inputClass} value={draft.id} disabled={!isNew} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => set("id", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          </Field>
          <Field label="Nome">
            <input className={inputClass} value={draft.title} required maxLength={120} onChange={(event) => set("title", event.target.value)} />
          </Field>
          <Field label="Descricao" full>
            <textarea className={`${inputClass} min-h-24 py-3`} value={draft.description} required maxLength={600} onChange={(event) => set("description", event.target.value)} />
          </Field>
          <Field label="Tipo">
            <input className={inputClass} value={draft.kind} required maxLength={80} onChange={(event) => set("kind", event.target.value)} />
          </Field>
          <Field label="Grupo">
            <select className={inputClass} value={draft.category} onChange={(event) => set("category", event.target.value)}><option value="tool">Ferramenta / dashboard</option><option value="link">Outro link</option></select>
          </Field>
          <Field label="Destino" hint="Rota interna iniciada por / ou URL https://" full>
            <input className={inputClass} value={draft.href} required maxLength={500} onChange={(event) => set("href", event.target.value)} />
          </Field>
          <Field label="Status operacional">
            <input className={inputClass} value={draft.status} required maxLength={50} onChange={(event) => set("status", event.target.value)} />
          </Field>
          <Field label="Saude da fonte">
            <select className={inputClass} value={draft.health} onChange={(event) => set("health", event.target.value)}>{HEALTH.map((value) => <option key={value} value={value}>{HEALTH_LABEL[value]}</option>)}</select>
          </Field>
          <Field label="Responsavel pelo dashboard">
            <input className={inputClass} value={draft.owner} required maxLength={100} onChange={(event) => set("owner", event.target.value)} />
          </Field>
          <Field label="Responsavel pelo dado">
            <input className={inputClass} value={draft.dataOwner} required maxLength={140} onChange={(event) => set("dataOwner", event.target.value)} />
          </Field>
          <Field label="Fonte" full>
            <input className={inputClass} value={draft.source} required maxLength={240} onChange={(event) => set("source", event.target.value)} />
          </Field>
          <Field label="Periodo">
            <input className={inputClass} value={draft.period} required maxLength={120} onChange={(event) => set("period", event.target.value)} />
          </Field>
          <Field label="Frequencia de atualizacao">
            <input className={inputClass} value={draft.cadence} required maxLength={80} onChange={(event) => set("cadence", event.target.value)} />
          </Field>
          <Field label="Ultima atualizacao do dado" full hint="Opcional. Deixe vazio quando a propria tela mostra a data da fonte.">
            <input type="datetime-local" className={inputClass} value={draft.lastDataAt ? new Date(draft.lastDataAt).toISOString().slice(0, 16) : ""} onChange={(event) => set("lastDataAt", event.target.value ? new Date(event.target.value).toISOString() : null)} />
          </Field>

          <fieldset className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <legend className="px-2 text-[10px] font-black uppercase tracking-[.14em] text-white/45">Areas que utilizam este acesso</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {HUB_AREAS.map((area) => {
                const checked = draft.areas.includes(area.id);
                return (
                  <div key={area.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-5 w-5 accent-[#25F4EE]" checked={checked} onChange={() => toggleArea(area.id)} /><span style={{ color: checked ? area.color : "rgba(255,255,255,.45)" }}>{area.name}</span></label>
                    {checked && <label className="mt-3 block text-[10px] uppercase tracking-wider text-white/35">Ordem<input type="number" min="0" max="9999" className={`${inputClass} mt-1`} value={draft.orderByArea[area.id] ?? 10} onChange={(event) => setDraft((current) => ({ ...current, orderByArea: { ...current.orderByArea, [area.id]: Number(event.target.value) } }))} /></label>}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="sm:col-span-2 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold"><input type="checkbox" className="h-5 w-5 accent-[#25F4EE]" checked={draft.featured} onChange={(event) => set("featured", event.target.checked)} />Destacar nas areas</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold"><input type="checkbox" className="h-5 w-5 accent-[#25F4EE]" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />Ativo e visivel</label>
          </div>

          <Field label="Chave administrativa" hint="Fica somente nesta aba e nunca e enviada em leituras." full>
            <input type="password" autoComplete="current-password" className={inputClass} value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Informe para salvar" />
          </Field>

          {feedback && <div role="alert" className={`sm:col-span-2 rounded-xl border px-4 py-3 text-sm ${feedback.type === "error" ? "border-red-400/25 bg-red-400/[0.07] text-red-200" : "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200"}`}>{feedback.text}</div>}
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#101218]/95 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <p className="text-xs text-white/35">{draft.active ? "Visivel nas areas selecionadas." : "Arquivado: permanece no historico e some das areas."}</p>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-white/10 px-4 text-sm font-bold text-white/60 sm:flex-none">Cancelar</button><button disabled={saving} className="min-h-11 flex-1 rounded-xl bg-[#25F4EE] px-5 text-sm font-black text-[#071012] disabled:opacity-50 sm:flex-none">{saving ? "Salvando..." : "Salvar para todas as areas"}</button></div>
        </footer>
      </form>
    </div>
  );
}

export default function HubRegistryManager() {
  const searchParams = useSearchParams();
  const initialArea = searchParams.get("area") || "all";
  const [registry, setRegistry] = useState(registrySeed);
  const [loading, setLoading] = useState(true);
  const [sourceState, setSourceState] = useState("Carregando registro global...");
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState(HUB_AREAS.some((area) => area.id === initialArea) ? initialArea : "all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");
  const [editor, setEditor] = useState(null);
  const [adminKey, setAdminKey] = useState("");
  const [toast, setToast] = useState(null);

  async function loadRegistry() {
    setLoading(true);
    try {
      const response = await fetch(`/api/hub-registry?_=${Date.now()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setRegistry(data.registry);
      setSourceState(`Registro central · revisao ${data.registry.revision}`);
    } catch {
      setRegistry(registrySeed);
      setSourceState("Contingencia local: edicao indisponivel ate a API voltar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAdminKey(window.sessionStorage.getItem(SESSION_KEY) || "");
    loadRegistry();
  }, []);

  const kinds = useMemo(() => [...new Set(registry.items.map((item) => item.kind))].sort((left, right) => left.localeCompare(right, "pt-BR")), [registry]);
  const statuses = useMemo(() => [...new Set(registry.items.map((item) => item.status))].sort((left, right) => left.localeCompare(right, "pt-BR")), [registry]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return registry.items.filter((item) => {
      const searchable = [item.title, item.description, item.kind, item.owner, item.dataOwner, item.source].join(" ").toLocaleLowerCase("pt-BR");
      return (!term || searchable.includes(term))
        && (areaFilter === "all" || item.areas.includes(areaFilter))
        && (categoryFilter === "all" || item.category === categoryFilter)
        && (kindFilter === "all" || item.kind === kindFilter)
        && (statusFilter === "all" || item.status === statusFilter)
        && (healthFilter === "all" || item.health === healthFilter)
        && (activeFilter === "all" || (activeFilter === "active" ? item.active : !item.active));
    }).sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));
  }, [registry, query, areaFilter, categoryFilter, kindFilter, statusFilter, healthFilter, activeFilter]);

  const activeItems = registry.items.filter((item) => item.active);
  const sharedItems = activeItems.filter((item) => item.areas.length > 1);
  const alerts = activeItems.filter((item) => !["healthy", "unknown"].includes(item.health));

  function saved(nextRegistry, message) {
    setRegistry(nextRegistry);
    setSourceState(`Registro central · revisao ${nextRegistry.revision}`);
    setEditor(null);
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090a0f] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-white/35" aria-label="Navegacao do Hub"><Link href="/hub" className="min-h-11 rounded-lg border border-white/10 px-3 py-3 font-bold text-white/60 hover:text-white">← Hub por areas</Link><span>/</span><span className="text-[#25F4EE]">Gestao global</span></nav>

        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#14161d] p-5 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#25F4EE]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#25F4EE]">Governanca dos acessos</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Registro global do Hub</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">Cada dashboard, sistema ou link existe uma vez e pode atender varias areas. Edite aqui e publique a mesma definicao para toda a empresa.</p><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{sourceState}</p></div>
            <button type="button" disabled={loading} onClick={() => setEditor({ item: emptyItem(areaFilter === "all" ? HUB_AREAS[0].id : areaFilter), isNew: true })} className="min-h-12 rounded-xl bg-[#25F4EE] px-5 text-sm font-black text-[#071012] disabled:opacity-50">+ Cadastrar acesso</button>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do registro">
          {[{ label: "Ativos", value: activeItems.length, color: "#25F4EE" }, { label: "Compartilhados", value: sharedItems.length, color: "#A78BFA" }, { label: "Areas", value: HUB_AREAS.length, color: "#38BDF8" }, { label: "Pedem atencao", value: alerts.length, color: alerts.length ? "#FFD60A" : "#32D74B" }].map((metric) => <div key={metric.label} className="rounded-2xl border border-white/[0.08] bg-[#14161d] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/30">{metric.label}</p><p className="mt-2 text-2xl font-black" style={{ color: metric.color }}>{metric.value}</p></div>)}
        </section>

        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#14161d] p-4" aria-label="Filtros do registro">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label className="lg:col-span-2"><span className="sr-only">Buscar</span><input type="search" className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, fonte ou responsavel" /></label>
            <label><span className="sr-only">Area</span><select className={inputClass} value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option value="all">Todas as areas</option>{HUB_AREAS.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
            <label><span className="sr-only">Grupo</span><select className={inputClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todos os grupos</option><option value="tool">Ferramentas</option><option value="link">Outros links</option></select></label>
            <label><span className="sr-only">Tipo</span><select className={inputClass} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">Todos os tipos</option>{kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label><span className="sr-only">Status operacional</span><select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label><span className="sr-only">Ativos ou arquivados</span><select className={inputClass} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="active">Ativos</option><option value="archived">Arquivados</option><option value="all">Todos</option></select></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setHealthFilter("all")} className={`min-h-11 rounded-lg border px-3 text-xs font-bold ${healthFilter === "all" ? "border-white/30 text-white" : "border-white/10 text-white/45"}`}>Todas as saudes</button>{HEALTH.map((health) => <button type="button" key={health} onClick={() => setHealthFilter(health)} className="min-h-11 rounded-lg border px-3 text-xs font-bold" style={{ color: healthFilter === health ? HEALTH_COLOR[health] : "rgba(255,255,255,.4)", borderColor: healthFilter === health ? `${HEALTH_COLOR[health]}70` : "rgba(255,255,255,.1)" }}>{HEALTH_LABEL[health]}</button>)}</div>
        </section>

        <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/30">Inventario filtrado</p><h2 className="mt-1 text-2xl font-black">{filtered.length} {filtered.length === 1 ? "acesso" : "acessos"}</h2></div><button type="button" onClick={loadRegistry} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs font-bold text-white/55 hover:text-white">Atualizar</button></div>

        {filtered.length ? <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Itens do registro global">{filtered.map((item) => (
          <article key={item.id} className={`flex min-w-0 flex-col rounded-2xl border bg-[#14161d] p-5 ${item.active ? "border-white/[0.08]" : "border-dashed border-white/10 opacity-65"}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[.14em] text-white/30">{item.kind} · {item.id}</p><h3 className="mt-2 text-xl font-black">{item.title}</h3></div><span className="shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase" style={{ color: HEALTH_COLOR[item.health], borderColor: `${HEALTH_COLOR[item.health]}45`, background: `${HEALTH_COLOR[item.health]}0D` }}>{HEALTH_LABEL[item.health]}</span></div>
            <p className="mt-3 text-sm leading-6 text-white/45">{item.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-white/[0.07] pt-4 text-xs"><div><dt className="text-[9px] uppercase tracking-wider text-white/25">Responsavel</dt><dd className="mt-1 text-white/65">{item.owner}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-white/25">Dono do dado</dt><dd className="mt-1 text-white/65">{item.dataOwner}</dd></div><div className="col-span-2"><dt className="text-[9px] uppercase tracking-wider text-white/25">Fonte · periodo</dt><dd className="mt-1 text-white/65">{item.source} · {item.period}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-white/25">Atualizacao</dt><dd className="mt-1 text-white/65">{item.cadence}</dd></div><div><dt className="text-[9px] uppercase tracking-wider text-white/25">Ultimo dado</dt><dd className="mt-1 text-white/65">{formatDate(item.lastDataAt)}</dd></div></dl>
            <div className="mt-4 flex flex-wrap gap-1.5">{item.areas.map((areaId) => { const area = HUB_AREAS.find((candidate) => candidate.id === areaId); return <span key={areaId} className="rounded-md border px-2 py-1 text-[9px] font-bold" style={{ color: area?.color, borderColor: `${area?.color || "#fff"}35` }}>{area?.name || areaId}</span>; })}</div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5"><a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="min-h-11 rounded-lg border border-white/10 px-3 py-3 text-xs font-bold text-white/55 hover:text-white">Abrir</a><button type="button" onClick={() => setEditor({ item: cloneItem(item), isNew: false })} className="min-h-11 rounded-lg border border-[#25F4EE]/35 bg-[#25F4EE]/[0.06] px-4 text-xs font-black text-[#25F4EE]">Editar e distribuir</button></div>
          </article>
        ))}</section> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Nenhum acesso encontrado com estes filtros.</div>}

        {toast && <div className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-emerald-400/25 bg-[#102019] px-4 py-3 text-sm font-bold text-emerald-200 shadow-2xl" role="status">{toast}</div>}
        {editor && <Editor item={editor.item} isNew={editor.isNew} revision={registry.revision} adminKey={adminKey} setAdminKey={setAdminKey} onSaved={saved} onClose={() => setEditor(null)} />}
      </div>
    </main>
  );
}
