"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const projects = [
  {
    id: "virada-club",
    title: "Virada do Club",
    short: "Atualiza elegibilidade, status e acesso dos creators do Club a partir do GMV.",
    cadence: "Mensal, dia 3 a 5 ou sob comando",
    status: "Ativo com dry-run obrigatorio",
    owner: "Agente 2 + Gabriel",
    cron: "0 6 3 * * · America/Sao_Paulo",
    lastRun: "03/07/2026",
    lastResult: "122 correcoes Notion, 1.231 sucessos Circle, 179 falhas Circle",
    objective:
      "Fechar a virada de ciclo dos creators usando mes fechado, creators ativos do Partner Center, atualizacao controlada no Notion e reconciliacao de tags/grupos no Circle.",
    instruction:
      "Operar em duas fases: dry-run obrigatorio para validar mes fechado, creators ativos, diffs e riscos; aplicacao real so depois dos checks ou OK explicito. Apos Notion, o Circle deve remover categoria antiga e aplicar tag/grupo da categoria nova.",
    inputs: [
      {
        label: "Database / fechamento mensal",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      { label: "Hub Club", href: "https://amplifyhub123.netlify.app/club" },
      {
        label: "Creators ativos no Partner Center",
        href: "https://partner.tiktokshop.com/affiliate-creator/binding-creator?market=16&tab=bound",
      },
      { label: "Paginas Notion dos creators" },
      { label: "Regras de categoria do Club" },
    ],
    sources: [
      { label: "n8n", detail: "workflow operacional", href: "https://n8n.amplifyugc.co" },
      { label: "OpenClaw", detail: "execucao assistida e auditoria" },
      {
        label: "Drive / database",
        detail: "fechamento mensal",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      { label: "Hub Club", detail: "dashboard da operacao", href: "https://amplifyhub123.netlify.app/club" },
      {
        label: "Partner Center",
        detail: "creators ativos",
        href: "https://partner.tiktokshop.com/affiliate-creator/binding-creator?market=16&tab=bound",
      },
      {
        label: "Notion",
        detail: "Base de Creators",
        href: "https://app.notion.com/p/amplifyugc/2efb0bbef153811b946ddf8f0fff81a3?v=2efb0bbef1538196a88f000c4a0c08de&source=copy_link",
      },
      { label: "Circle", detail: "tags e grupos de acesso" },
    ],
    tools: [
      { name: "OpenClaw", use: "orquestracao, leitura de memoria e execucao assistida" },
      { name: "n8n", use: "workflow visual/operacional da virada" },
      {
        name: "TikTok Shop Partner Center",
        use: "fonte de verdade para status de vinculo",
        href: "https://partner.tiktokshop.com/affiliate-creator/binding-creator?market=16&tab=bound",
      },
      {
        name: "Drive / database",
        use: "snapshot do mes fechado e arquivos de fechamento",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      { name: "Notion", use: "output operacional: status, categoria, ultimo GMV e auditoria" },
      { name: "Circle", use: "grupos de acesso da comunidade" },
      { name: "Hub Retencao", use: "visualizacao e auditoria do projeto" },
    ],
    outputs: [
      "Creators ativos com GMV no mes fechado",
      "Creators ativos sem GMV no mes fechado",
      "Creators inativos/desvinculados que precisam tag no Notion",
      "Ultimo GMV registrado atualizado",
      "Categoria da virada atualizada",
      "Status de vinculo TikTok Shop atualizado",
      "Snapshot/fonte da ultima virada registrado",
      "Tag Circle antiga removida quando a categoria muda",
      "Grupo de acesso antigo removido quando a categoria muda",
      "Tag Circle da nova categoria aplicada",
      "Grupo de acesso da nova categoria aplicado",
      "Resumo de run com sucessos, falhas e pendencias",
    ],
    hardening: [
      "Validar total de creators/paginas antes de comparar: se a captura do Partner Center parecer incompleta, bloquear aplicacao.",
      "Normalizar handles antes do match: remover @, espacos, maiusculas/minusculas e variacoes simples.",
      "Bloquear update automatico quando houver mais de uma pagina Notion para o mesmo handle.",
      "Registrar sempre mes de referencia, data da virada e fonte/snapshot usado.",
      "Separar dry-run de aplicacao: o Notion so recebe escrita quando a previa estiver limpa ou aprovada.",
    ],
    unlinkRules: [
      {
        status: "Vinculado",
        action: "Manter ativo. Atualizar GMV, categoria, mes/fonte da virada e status de vinculo.",
        tone: "good",
      },
      {
        status: "Nao encontrado ou Nao vinculado no snapshot fechado",
        action: "Pode virar Desvinculado/Inativo no Notion, com observacao interna citando Partner Center e snapshot.",
        tone: "warn",
      },
      {
        status: "Desvinculacao solicitada",
        action: "Nao marcar como desvinculado automaticamente. Criar alerta para revisao humana e manter historico.",
        tone: "info",
      },
      {
        status: "Prestes a expirar",
        action: "Nao mudar categoria por isso. Gerar alerta de risco e acompanhar na run seguinte.",
        tone: "info",
      },
      {
        status: "Handle duplicado, vazio ou conflitante",
        action: "Bloquear update automatico daquela pagina/creator e listar no report.",
        tone: "warn",
      },
    ],
    risks: [
      "Se o mes ainda nao fechou, o fluxo deve parar antes do Notion",
      "Partner Center pode exigir captura paginada e validacao de contagem",
      "Handles diferentes entre Partner Center, database e Notion podem gerar falso positivo",
      "Duplicados no Notion precisam bloquear aplicacao automatica",
      "Desvinculacao solicitada e prestes a expirar precisam regra propria",
      "n8n task runner ja apresentou instabilidade",
      "Envios externos seguem bloqueados sem autorizacao",
    ],
    runs: [
      {
        id: "2026-07-03-real",
        date: "03/07/2026",
        mode: "real",
        result: "Virada GMV junho aplicada",
        health: "concluida com falhas parciais",
        status: "success-warning",
        completedNodes: ["start", "month", "partner", "count", "match", "unlink", "compare", "dryrun", "notion", "circlePlan", "circleRemove", "circleApply", "report"],
        warningNodes: ["circleRemove", "circleApply", "report"],
        summary:
          "Aplicacao real funcionou via scripts locais auditaveis. Notion foi atualizado; Circle teve falhas parciais que precisam ficar visiveis no historico.",
        notices: [
          { tone: "good", text: "122 correcoes Notion aplicadas." },
          { tone: "good", text: "1.231 sucessos Circle." },
          { tone: "warn", text: "179 falhas Circle ficaram pendentes para auditoria/retry em tags/grupos de acesso." },
          { tone: "warn", text: "Executor n8n teve instabilidade; nao usar como aplicador cego." },
        ],
      },
      {
        id: "current-design",
        date: "Atual",
        mode: "desenho",
        result: "Fluxo endurecido com validacao, matching e regra de desvinculacao",
        health: "em montagem",
        status: "in-progress",
        completedNodes: ["start", "month", "partner", "count", "match", "unlink", "compare", "dryrun"],
        warningNodes: ["dryrun"],
        stoppedNode: "notion",
        summary:
          "A estrutura visual agora separa validacao de contagem, matching de handles e regra de desvinculacao antes da aplicacao no Notion.",
        notices: [
          { tone: "warn", text: "Aplicacao Notion fica bloqueada ate os checks passarem ou Gabriel aprovar." },
          { tone: "warn", text: "Julho/2026 ainda esta parcial em 30/07/2026; usar ultimo mes 100% fechado." },
          { tone: "info", text: "Estados de vinculo precisam ser tratados com regra, nao como ativo/inativo simples." },
        ],
      },
      {
        id: "month-not-closed-example",
        date: "Exemplo dia 03",
        mode: "dry-run",
        result: "Mes anterior ainda nao fechado",
        health: "bloqueada antes do Notion",
        status: "blocked",
        completedNodes: ["start", "month"],
        warningNodes: ["month"],
        stoppedNode: "partner",
        summary:
          "Quando a database ainda nao tem fechamento completo, o fluxo para cedo, reporta o bloqueio e agenda nova tentativa entre dia 3 e dia 5.",
        notices: [
          { tone: "warn", text: "Nao atualiza Notion com mes parcial." },
          { tone: "info", text: "Proxima tentativa deve buscar novo snapshot antes de comparar creators." },
        ],
      },
    ],
    nodes: [
      { id: "start", label: "Cron / comando", type: "trigger", sub: "dia 3 a 5 ou OK Gabriel" },
      {
        id: "month",
        label: "Mes fechado",
        type: "data",
        sub: "Drive + Hub Club",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      {
        id: "partner",
        label: "Creators ativos",
        type: "data",
        sub: "Partner Center",
        href: "https://partner.tiktokshop.com/affiliate-creator/binding-creator?market=16&tab=bound",
      },
      { id: "count", label: "Validar captura", type: "check", sub: "contagem e paginacao" },
      { id: "match", label: "Normalizar handles", type: "logic", sub: "@, espacos, duplicados" },
      { id: "unlink", label: "Regra de vinculo", type: "decision", sub: "ativo, alerta ou inativo" },
      { id: "compare", label: "Comparacao", type: "logic", sub: "ativos x GMV x Notion" },
      { id: "dryrun", label: "Dry-run", type: "check", sub: "diffs, duplicados e riscos" },
      { id: "notion", label: "Notion", type: "output", sub: "GMV, categoria, status" },
      { id: "circlePlan", label: "Delta Circle", type: "logic", sub: "categoria antiga x nova" },
      { id: "circleRemove", label: "Remover antigos", type: "output", sub: "tag e grupo anteriores" },
      { id: "circleApply", label: "Aplicar novos", type: "output", sub: "tag e grupo atuais" },
      { id: "report", label: "Report final", type: "report", sub: "sucessos, falhas, pendencias" },
    ],
  },
  {
    id: "dashboard-retencao",
    title: "Update dashboard de retencao",
    short: "Atualiza snapshots e leituras do Hub para acompanhamento de creators, produtos, videos e lives.",
    cadence: "Recorrente",
    status: "Estrutura criada; detalhamento pendente",
    owner: "Agente 2",
    cron: "0 7 * * * · America/Sao_Paulo",
    lastRun: "28/07/2026",
    lastResult: "Base SQLite/dashboard TikTok Shop Retencao criada com dados Jan-Jul/2026",
    objective: "Manter o Hub com dados recentes e confiaveis para operacao de retencao.",
    instruction: "Cron registrado para atualizar a database de retencao via scripts/refresh_amplify_hub_tiktok.sh. Botao manual deve permitir rodar fora da agenda depois que existir endpoint seguro.",
    inputs: ["Dados TikTok Shop", "Snapshots locais", "Views do Hub"],
    sources: [
      { label: "Hub Retencao", detail: "views principais", href: "https://amplifyhub123.netlify.app/club" },
      { label: "Database local", detail: "snapshots TikTok Shop" },
    ],
    tools: [{ name: "Hub Retencao", use: "visualizacao" }],
    outputs: ["Dashboard atualizado"],
    risks: ["Deploy em producao requer confirmacao explicita"],
    runs: [
      {
        id: "2026-07-28-setup",
        date: "28/07/2026",
        mode: "setup",
        result: "Base criada",
        health: "pendente deploy",
        status: "in-progress",
        completedNodes: ["start", "hub"],
        warningNodes: ["hub"],
        summary: "Base criada; detalhamento operacional deste fluxo fica para a proxima etapa.",
        notices: [{ tone: "info", text: "Fluxo ainda sera detalhado depois da Virada do Club." }],
      },
    ],
    nodes: [
      { id: "start", label: "Coleta", type: "trigger", sub: "dados TikTok Shop" },
      { id: "hub", label: "Hub", type: "output", sub: "views de retencao" },
    ],
  },
];

const nodeStyles = {
  trigger: { border: "#25F4EE", bg: "rgba(37,244,238,.10)", icon: ">" },
  decision: { border: "#F6B84B", bg: "rgba(246,184,75,.10)", icon: "?" },
  data: { border: "#9B8CFF", bg: "rgba(155,140,255,.10)", icon: "#" },
  logic: { border: "#FF765F", bg: "rgba(255,118,95,.10)", icon: "{}" },
  check: { border: "#10b981", bg: "rgba(16,185,129,.10)", icon: "ok" },
  output: { border: "#EA1A4E", bg: "rgba(234,26,78,.10)", icon: "out" },
  report: { border: "#fff", bg: "rgba(255,255,255,.06)", icon: "doc" },
  idle: { border: "rgba(255,255,255,.12)", bg: "rgba(255,255,255,.035)" },
  warn: { border: "#F6B84B", bg: "rgba(246,184,75,.12)" },
};

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-white/5 text-white/55 border-white/10",
    good: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
    warn: "bg-yellow-500/10 text-yellow-200 border-yellow-400/20",
    blue: "bg-cyan-500/10 text-cyan-200 border-cyan-400/20",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function ProjectCard({ project, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        active ? "border-[#25F4EE]/70 bg-[#25F4EE]/10" : "border-white/10 bg-[#14161F] hover:border-white/25"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white">{project.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/45">{project.short}</p>
        </div>
        <span className="mt-1 text-white/35">→</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone={project.id === "virada-club" ? "good" : "warn"}>{project.status}</Chip>
        <Chip>{project.cadence}</Chip>
      </div>
    </button>
  );
}

function FlowCanvas({ nodes, run }) {
  const completed = new Set(run?.completedNodes || []);
  const warnings = new Set(run?.warningNodes || []);
  const stoppedNode = run?.stoppedNode;

  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-white/10 bg-[#0A0B12] p-5">
      <div className="flex min-w-[1920px] items-center gap-3">
        {nodes.map((node, index) => {
          const style = nodeStyles[node.type] || nodeStyles.data;
          const isComplete = completed.has(node.id);
          const isWarn = warnings.has(node.id);
          const isStopped = stoppedNode === node.id;
          const visual = isWarn ? nodeStyles.warn : isComplete ? style : nodeStyles.idle;
          const opacity = isComplete || isStopped ? "opacity-100" : "opacity-35";
          const lineActive = index < nodes.length - 1 && completed.has(nodes[index + 1]?.id);
          const content = (
            <>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/25 text-[11px] font-extrabold text-white">
                {isWarn ? "!" : isComplete ? style.icon : "-"}
              </div>
              <p className="text-sm font-bold leading-tight text-white">{node.label}</p>
              <p className="mt-2 min-h-8 text-[11px] leading-snug text-white/42">{node.sub}</p>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-white/30">
                {isWarn ? "aviso" : isComplete ? "ok" : isStopped ? "parou aqui" : "nao executado"}
              </p>
            </>
          );

          return (
            <div key={node.id} className="flex items-center gap-3">
              {node.href ? (
                <a
                  href={node.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-32 shrink-0 rounded-lg border p-3 shadow-xl transition-opacity hover:opacity-100 ${opacity}`}
                  style={{ borderColor: visual.border, background: visual.bg }}
                >
                  {content}
                </a>
              ) : (
                <div
                  className={`w-32 shrink-0 rounded-lg border p-3 shadow-xl transition-opacity ${opacity}`}
                  style={{ borderColor: visual.border, background: visual.bg }}
                >
                  {content}
                </div>
              )}
              {index < nodes.length - 1 && (
                <div className="flex items-center">
                  <div className={`h-px w-10 ${lineActive ? "bg-[#25F4EE]/70" : "bg-white/10"}`} />
                  <div className={`h-2 w-2 rotate-45 border-r border-t ${lineActive ? "border-[#25F4EE]/70" : "border-white/15"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoBlock({ title, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-5">
      <h3 className="text-sm font-extrabold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RunStatusPanel({ run }) {
  const toneClasses = {
    good: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    warn: "border-yellow-400/20 bg-yellow-500/10 text-yellow-100",
    info: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  };

  return (
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/35">Run selecionada</p>
          <h3 className="mt-1 text-lg font-extrabold text-white">{run.date} · {run.mode}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">{run.summary}</p>
        </div>
        <Chip tone={run.status === "blocked" ? "warn" : run.status === "in-progress" ? "blue" : "good"}>{run.health}</Chip>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(run.notices || []).map((notice) => (
          <div key={notice.text} className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${toneClasses[notice.tone] || toneClasses.info}`}>
            {notice.text}
          </div>
        ))}
      </div>
    </section>
  );
}

function ManualRunPanel({ project }) {
  const [step, setStep] = useState("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const isArmed = step === "armed";
  const isConfirmed = step === "confirmed";

  const handleClick = async () => {
    if (isArmed) {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/project-runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            confirmation: "irreversible-confirmed",
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.detail || data?.error || "Falha ao disparar.");
        }
        setStep("confirmed");
        setMessage(`Disparo enviado. Status webhook: ${data.webhook_status || "ok"}.`);
      } catch (error) {
        setStep("idle");
        setMessage(error?.message || "Falha ao disparar.");
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep("armed");
    setMessage("");
  };

  return (
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/35">Acao manual</p>
          <h3 className="mt-1 text-lg font-extrabold text-white">Rodar agora</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Independente do cron, este controle deixa a execucao manual pronta no painel. O segundo clique confirma que a acao nao tem volta.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`rounded-lg px-4 py-3 text-sm font-extrabold transition-colors ${
            isArmed
              ? "bg-red-500 text-white hover:bg-red-400"
              : isConfirmed
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-[#25F4EE] text-black hover:bg-cyan-200"
          }`}
        >
          {loading ? "Disparando..." : isArmed ? "Confirmar execucao irreversivel" : isConfirmed ? "Execucao disparada" : "Rodar agora"}
        </button>
      </div>
      {isArmed && (
        <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
          Tem certeza? Clique de novo apenas se quiser executar {project.title}. Esta acao nao tem volta.
        </div>
      )}
      {isConfirmed && (
        <div className="mt-4 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {message || "Execucao enviada pelo endpoint seguro do Hub."}
        </div>
      )}
      {message && !isConfirmed && (
        <div className="mt-4 rounded-md border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
          {message}
        </div>
      )}
    </section>
  );
}

function SourceItem({ item }) {
  const label = typeof item === "string" ? item : item.label;
  const href = typeof item === "string" ? null : item.href;
  const className = "block rounded-md bg-white/5 px-3 py-2 text-xs text-white/55";

  if (!href) {
    return <p className={className}>{label}</p>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} hover:bg-white/10 hover:text-white`}>
      {label} →
    </a>
  );
}

export default function ProjectsFlowView() {
  const [activeId, setActiveId] = useState("virada-club");
  const [selectedRunByProject, setSelectedRunByProject] = useState({});
  const active = useMemo(() => projects.find((project) => project.id === activeId) || projects[0], [activeId]);
  const selectedRunId = selectedRunByProject[active.id] || active.runs[0]?.id || `${active.runs[0]?.date}-${active.runs[0]?.mode}`;
  const selectedRun = active.runs.find((run) => (run.id || `${run.date}-${run.mode}`) === selectedRunId) || active.runs[0];

  const selectRun = (run) => {
    setSelectedRunByProject((current) => ({
      ...current,
      [active.id]: run.id || `${run.date}-${run.mode}`,
    }));
  };

  return (
    <main className="min-h-screen bg-[#0A0B12] text-white">
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-mono uppercase tracking-widest text-[#25F4EE]">Hub Retencao</p>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">Projetos e fluxos</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/45">
              Central visual dos projetos recorrentes: o que dispara, quais ferramentas entram, qual racional eu sigo no backend e qual output precisa sair.
            </p>
          </div>
          <Link href="/hub" className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            ← Voltar ao Hub
          </Link>
        </div>

        <div className="grid min-w-0 gap-5 py-6 lg:grid-cols-[360px_1fr]">
          <aside className="min-w-0 space-y-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={project.id === active.id}
                onClick={() => setActiveId(project.id)}
              />
            ))}
          </aside>

          <div className="min-w-0 space-y-5">
            <section className="rounded-lg border border-white/10 bg-[#14161F] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-white/35">Fluxo selecionado</p>
                  <h2 className="mt-1 text-2xl font-extrabold text-white">{active.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">{active.objective}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Chip tone="blue">{active.cadence}</Chip>
                  <Chip tone={active.id === "virada-club" ? "good" : "warn"}>{active.status}</Chip>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Dono</p>
                  <p className="mt-2 text-sm font-bold">{active.owner}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Cron</p>
                  <p className="mt-2 text-sm font-bold leading-snug">{active.cron || "Sem cron registrado"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Ultima run</p>
                  <p className="mt-2 text-sm font-bold">{active.lastRun}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Resultado</p>
                  <p className="mt-2 text-sm font-bold leading-snug">{active.lastResult}</p>
                </div>
              </div>
            </section>

            <ManualRunPanel project={active} />
            <FlowCanvas nodes={active.nodes} run={selectedRun} />
            <RunStatusPanel run={selectedRun} />

            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <InfoBlock title="Racional operacional">
                  <p className="text-sm leading-relaxed text-white/55">{active.instruction}</p>
                </InfoBlock>

                <InfoBlock title="Historico de runs">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="text-[10px] uppercase tracking-widest text-white/35">
                        <tr>
                          <th className="pb-3">Data</th>
                          <th className="pb-3">Modo</th>
                          <th className="pb-3">Resultado</th>
                          <th className="pb-3">Saude</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.runs.map((run) => {
                          const runId = run.id || `${run.date}-${run.mode}`;
                          const selected = runId === selectedRunId;
                          return (
                            <tr key={runId} className="border-t border-white/10">
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => selectRun(run)}
                                  className={`w-full rounded-md px-3 py-2 text-left font-bold transition-colors ${
                                    selected ? "bg-[#25F4EE]/10 text-[#25F4EE]" : "text-white hover:bg-white/5"
                                  }`}
                                >
                                  {run.date}
                                </button>
                              </td>
                              <td className="py-3 text-white/55">{run.mode}</td>
                              <td className="py-3 text-white/55">{run.result}</td>
                              <td className="py-3 text-white/55">{run.health}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </InfoBlock>
              </div>

              <div className="space-y-5">
                <InfoBlock title="Fontes e acessos">
                  <div className="grid gap-2">
                    {(active.sources || active.inputs).map((item) => {
                      const label = typeof item === "string" ? item : item.label;
                      const detail = typeof item === "string" ? null : item.detail;
                      const href = typeof item === "string" ? null : item.href;
                      const body = (
                        <>
                          <span className="text-xs font-extrabold text-white">{label}</span>
                          {detail && <span className="mt-1 block text-[11px] text-white/40">{detail}</span>}
                        </>
                      );
                      return href ? (
                        <a key={label} href={href} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">
                          {body}
                        </a>
                      ) : (
                        <div key={label} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{body}</div>
                      );
                    })}
                  </div>
                </InfoBlock>
                <InfoBlock title="Outputs esperados">
                  <div className="space-y-2">
                    {active.outputs.map((item) => <p key={item} className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{item}</p>)}
                  </div>
                </InfoBlock>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
