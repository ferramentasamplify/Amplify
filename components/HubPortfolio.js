"use client";

import { useMemo, useState } from "react";

const areas = [
  { id: "all", label: "Tudo" },
  { id: "aquisicao", label: "Aquisicao" },
  { id: "growth", label: "Growth" },
  { id: "marketing", label: "Marketing e Trafego" },
  { id: "retencao", label: "Retencao" },
  { id: "vendas", label: "Vendas e Parcerias" },
  { id: "projetos", label: "Projetos e Produto" },
];

const items = [
  { id: "cockpit-aquisicao", area: "aquisicao", title: "Cockpit de Aquisicao", kind: "Sistema operacional", status: "operacional", description: "Kanban, prazos, bloqueios e historico do time conectado ao Slack.", href: "https://amplify-mission-control.netlify.app/aquisicao" },
  { id: "analise-aquisicao", area: "aquisicao", title: "Dashboard de Aquisicao", kind: "Dashboard", status: "operacional", description: "Leads, agenciados, conversao e origens da maquina de aquisicao.", href: "/analise" },
  { id: "creator-economics", area: "aquisicao", title: "Creator CAC x LTV", kind: "Dashboard", status: "publicado", description: "Cruza aquisicao, GMV, receita, CAC e retencao por creator.", href: "/hub/creator-economics" },

  { id: "growth-central", area: "growth", title: "Growth Central", kind: "Dashboard executivo", status: "publicado", description: "Plano, prioridades, indicadores e frentes de Growth.", href: "/hub/growth" },
  { id: "funis-globais", area: "growth", title: "Funis de Creators e Marcas", kind: "Dashboard", status: "publicado", description: "Funis separados por publico, canal e etapa.", href: "/hub/funis" },
  { id: "novo-funil-marcas", area: "growth", title: "Projeto Novo Funil de Marcas", kind: "Projeto + banco criativo", status: "em integracao", description: "Jornada, estrategia, criativos e plano de implementacao do novo funil.", href: "https://lp.amplifyugc.co/projeto-novo-funil-marcas/" },
  { id: "lp-curso-tiktok", area: "growth", title: "LP Curso TikTok Shop", kind: "Landing page", status: "publicado", description: "Pagina educacional para marcas sobre TikTok Shop e creators.", href: "https://lp.amplifyugc.co/aula-tiktok-shop/" },
  { id: "central-lps", area: "growth", title: "Central de LPs", kind: "Biblioteca de paginas", status: "em revisao", description: "Versoes de LP de mentoria, curso e ofertas em uma unica entrada.", href: "https://lp.amplifyugc.co/central-lps/" },
  { id: "mentoria-marcas", area: "growth", title: "Mentoria para Marcas", kind: "Oferta + landing pages", status: "em revisao", description: "Posicionamento, argumento comercial e paginas da mentoria para marcas.", href: "https://lp.amplifyugc.co/central-lps/" },

  { id: "creative-dashboard", area: "marketing", title: "Dashboard de Criativos Meta", kind: "Dashboard operacional", status: "publicado", description: "Criativos, gasto, leads, CPL, Hook Rate, Hold Rate e decisao.", href: "https://amplify-creative-dashboard.netlify.app" },
  { id: "meta-hub", area: "marketing", title: "Meta Ads no Hub", kind: "Dashboard integrado", status: "publicado", description: "Campanhas e criativos dentro do Hub com dados operacionais.", href: "/meta" },
  { id: "mapa-criativos", area: "marketing", title: "Mapa de Criativos de Marcas", kind: "Mapa estrategico", status: "publicado", description: "Hooks, roteiros, referencias e conexao com performance.", href: "/mapa-criativos-marcas" },
  { id: "baw-intelligence", area: "marketing", title: "BAW TikTok Intelligence", kind: "Dashboard + plano GMV Max", status: "aguardando insumos", description: "Product e LIVE GMV Max, produtos, criativos, budget e gates.", href: "https://baw-tiktok-intelligence.netlify.app" },

  { id: "club", area: "retencao", title: "Amplify Club", kind: "Dashboard", status: "operacional", description: "GMV, categorias, elegibilidade e leitura recorrente do Club.", href: "/club" },
  { id: "virada-club", area: "retencao", title: "Virada do Club", kind: "Fluxo automatizado", status: "operacional", description: "Fechamento mensal com Partner Center, Notion, Circle e dry-run.", href: "/hub/projetos" },
  { id: "indique", area: "retencao", title: "Indique e Ganhe", kind: "Dashboard", status: "publicado", description: "Indicacoes, creators, conversao e resultado do programa.", href: "/indiqueeganhe" },
  { id: "super-afiliado", area: "retencao", title: "Super Afiliado", kind: "Dashboard", status: "publicado", description: "Cadastros, creators, vendas e GMV atribuivel.", href: "/superafiliado" },
  { id: "dashboard-retencao", area: "retencao", title: "Base e Dashboard de Retencao", kind: "Pipeline de dados", status: "operacional", description: "Snapshots e leituras de creators, produtos, videos e lives.", href: "/hub/projetos" },
  { id: "gamificacoes", area: "retencao", title: "Gamificacoes", kind: "Central operacional", status: "operacional", description: "Acompanhamento das gamificacoes e atualizacoes protegidas.", href: "/gamificacoes" },

  { id: "proposta-laiz", area: "vendas", title: "Proposta Comercial Laiz", kind: "Proposta interativa", status: "publicado", description: "Experiencia comercial para apresentar modelo de parceria e oferta.", href: "https://proposta-laiz-amplify.vercel.app" },

  { id: "projetos-fluxos", area: "projetos", title: "Projetos e Fluxos", kind: "Central operacional", status: "operacional", description: "Pagina original com canvas, runs, fontes, guardrails e controles dos fluxos.", href: "/hub/projetos", featured: true },
  { id: "mission-control", area: "projetos", title: "Mission Control da Amplify", kind: "Sistema interno", status: "operacional", description: "Visao executiva, KRs, operacao, agentes e Cockpit de Aquisicao.", href: "https://amplify-mission-control.netlify.app" },
  { id: "hoje", area: "projetos", title: "Hoje", kind: "Visao operacional", status: "operacional", description: "Entrada para a leitura diaria da operacao.", href: "/" },
  { id: "metricas", area: "projetos", title: "Metricas", kind: "Dashboard", status: "operacional", description: "Leitura consolidada de metas e indicadores.", href: "/metricas" },
  { id: "custos", area: "projetos", title: "Custos", kind: "Dashboard financeiro", status: "operacional", description: "Acompanhamento dos custos operacionais disponiveis no Hub.", href: "/custos" },
  { id: "margem-shop", area: "projetos", title: "Calculadora de Margem TikTok Shop", kind: "Ferramenta", status: "publicado", description: "Compara lucro, margem e ROAS minimo entre TikTok Shop e e-commerce.", href: "https://amplify-margem-shop.netlify.app" },
  { id: "amplify-os", area: "projetos", title: "Amplify OS", kind: "Sistema interno", status: "em estruturacao", description: "Centralizacao de processos, ferramentas, agentes, ownership e acessos." },
];

const toneByStatus = {
  operacional: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  publicado: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  "em integracao": "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  "em revisao": "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  "aguardando insumos": "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  "em estruturacao": "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
};

function PortfolioCard({ item }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/35">{item.kind}</span>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold ${toneByStatus[item.status] || "border-white/10 bg-white/5 text-white/50"}`}>
          {item.status}
        </span>
      </div>
      <h3 className="mt-3 text-base font-extrabold text-white">{item.title}</h3>
      <p className="mt-2 min-h-10 text-xs leading-relaxed text-white/45">{item.description}</p>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-bold">
        <span className="text-white/35">{item.href ? "Acessar" : "Projeto registrado"}</span>
        <span className="text-[#25F4EE]">{item.href ? "Abrir →" : "Sem link"}</span>
      </div>
    </>
  );
  const classes = `block h-full rounded-xl border p-4 text-left transition-all ${item.featured ? "border-[#25F4EE]/50 bg-[#25F4EE]/5" : "border-white/10 bg-[#14161F]"} ${item.href ? "hover:-translate-y-0.5 hover:border-[#25F4EE]/45 hover:bg-[#181B25]" : "opacity-75"}`;

  if (!item.href) return <article className={classes}>{content}</article>;
  const external = item.href.startsWith("http");
  return <a className={classes} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{content}</a>;
}

export default function HubPortfolio() {
  const [area, setArea] = useState("all");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = useMemo(() => items.filter((item) => {
    const areaMatch = area === "all" || item.area === area;
    const queryMatch = !normalized || `${item.title} ${item.kind} ${item.description} ${item.status}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return areaMatch && queryMatch;
  }).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))), [area, normalized]);
  const counts = useMemo(() => Object.fromEntries(areas.map((entry) => [entry.id, entry.id === "all" ? items.length : items.filter((item) => item.area === entry.id).length])), []);
  const activeCount = items.filter((item) => ["publicado", "operacional"].includes(item.status)).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6" aria-labelledby="hub-navigation-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE]">Navegacao completa</p>
          <h2 id="hub-navigation-title" className="mt-1 text-2xl font-extrabold text-white">Todos os dashboards, sistemas e projetos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/45">Esta e a porta de entrada da Amplify. Filtre por area ou busque pelo nome para chegar direto em qualquer entrega.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[330px]">
          <div className="rounded-lg border border-white/10 bg-[#14161F] px-3 py-3"><strong className="block text-xl text-white">{items.length}</strong><span className="text-[9px] uppercase tracking-wider text-white/35">entregas</span></div>
          <div className="rounded-lg border border-white/10 bg-[#14161F] px-3 py-3"><strong className="block text-xl text-white">{areas.length - 1}</strong><span className="text-[9px] uppercase tracking-wider text-white/35">areas</span></div>
          <div className="rounded-lg border border-[#25F4EE]/20 bg-[#25F4EE]/5 px-3 py-3"><strong className="block text-xl text-[#25F4EE]">{activeCount}</strong><span className="text-[9px] uppercase tracking-wider text-white/35">ativos</span></div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-wrap lg:overflow-visible lg:pb-0" aria-label="Filtrar entregas por area">
          {areas.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setArea(entry.id)} aria-pressed={area === entry.id} className={`min-h-11 shrink-0 rounded-lg border px-3 text-xs font-bold transition-colors ${area === entry.id ? "border-[#25F4EE]/60 bg-[#25F4EE]/10 text-[#25F4EE]" : "border-white/10 bg-[#14161F] text-white/50 hover:text-white"}`}>
              {entry.label} <span className="ml-1 opacity-55">{counts[entry.id]}</span>
            </button>
          ))}
        </div>
        <label className="block w-full lg:max-w-xs">
          <span className="sr-only">Buscar no Hub</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar dashboard, LP, sistema..." className="min-h-11 w-full rounded-lg border border-white/10 bg-[#14161F] px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#25F4EE]/60" />
        </label>
      </div>

      <p className="mt-3 text-xs text-white/30">{visible.length} acessos nesta leitura</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => <PortfolioCard key={item.id} item={item} />)}
      </div>
      {!visible.length && <div className="mt-4 rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">Nenhum acesso encontrado com este filtro.</div>}
    </section>
  );
}
