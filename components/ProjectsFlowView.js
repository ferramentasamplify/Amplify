"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const projects = [
  {
    id: "virada-club",
    title: "Virada do Club",
    short: "Fecha a virada mensal do Club: GMV, categoria, vinculo, Notion e acessos no Circle.",
    cadence: "Mensal, dia 3 a 5 ou sob comando",
    status: "Notion julho aplicado; excecoes finais mapeadas",
    owner: "Agente 2 + Gabriel",
    cron: "0 6 3 * * · America/Sao_Paulo",
    lastRun: "05/08/2026",
    lastResult: "Notion atualizado sem falhas; 775 ativos seguem sem pagina unica e entram na reconciliacao de @",
    objective:
      "Fechar a virada de ciclo dos creators usando o mes fechado validado pelos snapshots diarios, creators ativos do Partner Center, atualizacao controlada no Notion e reconciliacao de tags/grupos no Circle.",
    instruction:
      "Operar em duas fases: primeiro validar o mes fechado pelos snapshots diarios, conferir todos os creators ativos do Partner Center, gerar diffs e listar riscos; a aplicacao real so acontece depois dos checks ou OK explicito. Ativo sem GMV em julho entra como Start. Apos Notion, o Circle deve remover categoria antiga e aplicar tag/grupo da categoria nova.",
    inputs: [
      {
        label: "Snapshots diarios / mes fechado",
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
        detail: "fallback e auditoria do fechamento",
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
        use: "fallback e auditoria quando os snapshots diarios nao fecharem",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      { name: "Notion", use: "output operacional: status, categoria, ultimo GMV e auditoria" },
      { name: "Circle", use: "grupos de acesso da comunidade" },
      { name: "Hub Retencao", use: "visualizacao e auditoria do projeto" },
    ],
    outputs: [
      "Creators ativos com GMV no periodo fechado",
      "Creators ativos sem GMV no periodo fechado",
      "Todos os creators ativos do Partner Center classificados: com GMV por faixa e sem GMV como Start",
      "Creators inativos/desvinculados que precisam tag no Notion",
      "Ultimo GMV registrado atualizado",
      "Categoria da virada atualizada",
      "Mes e fonte de referencia registrados",
      "Data da ultima virada registrada",
      "Status de vinculo TikTok Shop atualizado",
      "Flags de revisao para duplicado, nao encontrado, ativo sem base, base sem vinculo, desvinculacao solicitada e perto de expirar",
      "Snapshot/fonte da ultima virada registrado",
      "Tag Circle antiga removida quando a categoria muda",
      "Grupo de acesso antigo removido quando a categoria muda",
      "Tag Circle da nova categoria aplicada",
      "Grupo de acesso da nova categoria aplicado",
      "Reconciliacao final de @ entre Partner Center, Notion e Circle",
      "Resumo de run com sucessos, falhas e pendencias",
    ],
    hardening: [
      "Validar o mes fechado pelos snapshots diarios antes de comparar: se faltar dia ou houver fonte incompleta, bloquear aplicacao.",
      "Validar total de creators/paginas antes de comparar: se a captura do Partner Center parecer incompleta, bloquear aplicacao.",
      "Reportar falha tecnica com etapa, timeout configurado, duracao real, pagina atingida, contagem parcial e proxima acao sugerida.",
      "Partner Center e a fonte de verdade para vinculo ativo. Todo ativo precisa receber categoria.",
      "Ativo sem GMV no mes de referencia entra como Start, nao fica fora da virada.",
      "Normalizar handles antes do match: remover @, espacos, maiusculas/minusculas e variacoes simples.",
      "Bloquear update automatico quando houver mais de uma pagina Notion para o mesmo handle.",
      "Depois da aplicacao principal, rodar verificacao final de @ para inconclusivos: comparar Partner Center x Circle x Notion por handle normalizado, e-mail e WhatsApp; TikTok publico entra apenas como ultimo recurso e nao deve atualizar automaticamente sem evidencia forte.",
      "Gravar status de verificacao de @ por creator: match_exato, circle_confirmado, match_suspeito, inconclusivo ou revisao_manual.",
      "Usar creator_id/author_id do Partner como chave estavel sempre que existir; @ e dado mutavel e nao deve ser a unica chave definitiva.",
      "Registrar sempre mes de referencia, data da virada e fonte/snapshot usado.",
      "Separar dry-run de aplicacao: o Notion so recebe escrita quando a previa estiver limpa ou aprovada.",
      "Notificacao fica fora ate Notion e Circle estarem corretos.",
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
      "Se os snapshots diarios ainda nao fecharem o mes, o fluxo deve parar antes do Notion",
      "Partner Center pode exigir captura paginada e validacao de contagem",
      "Coleta do Partner Center pode passar de 45s em paginas altas; timeout local foi aumentado para 180s e precisa ficar monitorado no report",
      "Sem lista oficial completa de ativos/vinculados, o diff final de Notion + Circle fica bloqueado",
      "Handles diferentes entre Partner Center, database e Notion podem gerar falso positivo",
      "Comparar bases sujas por @ pode esconder troca de username; casos inconclusivos precisam reconciliacao posterior com Circle e, em ultimo caso, busca publica assistida",
      "Duplicados no Notion precisam bloquear aplicacao automatica",
      "Desvinculacao solicitada e prestes a expirar precisam regra propria",
      "n8n task runner ja apresentou instabilidade",
      "Envios externos seguem bloqueados sem autorizacao",
    ],
    runs: [
      {
        id: "2026-08-06-real-notion-julho",
        date: "06/08/2026",
        mode: "real",
        result: "Notion julho aplicado",
        health: "Notion limpo; reconciliacao de @ pendente",
        status: "success-warning",
        completedNodes: ["start", "month", "partner", "count", "match", "unlink", "compare", "dryrun", "notion"],
        warningNodes: ["handleAudit", "report"],
        stoppedNode: "handleAudit",
        summary:
          "Virada manual de julho avancou ate a atualizacao do Notion. Correcoes automaticas ficaram zeradas no dry-run final; duplicados seguros foram tratados, mas a run revelou uma lacuna estrutural de creators ativos no Partner sem pagina unica no Notion, que deve virar reconciliacao final de @ usando Circle antes do report definitivo.",
        notices: [
          { tone: "good", text: "1.315 correcoes Notion unicas aplicadas: 934 ativas e 381 desvinculadas." },
          { tone: "good", text: "489 operacoes seguras de duplicados: 226 paginas mantidas atualizadas e 263 duplicadas arquivadas." },
          { tone: "good", text: "Falhas de escrita: 0; dry-run final de Notion: 0 correcoes automaticas restantes." },
          { tone: "warn", text: "775 ativos do Partner seguem sem pagina unica correspondente no Notion; isso representa 34,4% dos 2.256 ativos validos." },
          { tone: "warn", text: "Esses 775 nao provam ausencia de formulario: podem ser @ trocado, @ errado, cadastro em outro fluxo ou pagina sem handle valido." },
          { tone: "info", text: "Nova etapa final: reconciliar @ inconclusivo via Circle usando handle, e-mail e WhatsApp; busca publica no TikTok fica como ultimo recurso assistido." },
          { tone: "warn", text: "Pendencias manuais restantes: duplicado ativo @jaquelfsz_ e duplicado inativo @casalsantoshop." },
        ],
      },
      {
        id: "2026-08-05-dry-run-julho",
        date: "05/08/2026",
        mode: "dry-run",
        result: "Previa julho gerada",
        health: "Partner Center OK; Notion exige revisao",
        status: "blocked",
        completedNodes: ["start", "month", "partner", "count", "match", "unlink", "compare", "dryrun"],
        warningNodes: ["match", "dryrun", "notion"],
        stoppedNode: "notion",
        summary:
          "Nao houve producao. A recoleta completa do Partner Center passou com o timeout novo, o GMV de julho foi carregado e o dry-run calculou as mudancas. A aplicacao segue bloqueada porque ha muitos ativos sem pagina unica no Notion e duplicados que precisam revisao antes de escrita.",
        notices: [
          { tone: "good", text: "Vinculos ativos Partner: HTTP 200 em 49s; 2.265 itens carregados em 23 paginas; total informado 2.268." },
          { tone: "good", text: "GMV julho: HTTP 200 em 66s; 2.963 linhas; total aproximado R$ 12,013M." },
          { tone: "info", text: "Dry-run Notion: 4.902 paginas lidas, 724 ajustes planejados e 2.301 registros ja verificados OK." },
          { tone: "warn", text: "Bloqueios: 778 ativos sem pagina Notion, 93 ativos duplicados e 135 duplicados inativos." },
          { tone: "info", text: "Categorias pelo Partner no dry-run: Start 2.102, Silver 94, Gold 27, Diamond 31, Safira 2, Royal 0." },
          { tone: "warn", text: "Top bloqueios por GMV incluem @laizmacaneiro sem pagina Notion unica para Safira e @elenaratrindade sem pagina Notion unica para Diamond." },
        ],
      },
      {
        id: "2026-08-05-timeout-ajustado",
        date: "05/08/2026",
        mode: "diagnostico",
        result: "Timeout local corrigido",
        health: "Partner Center logado; proxy OK",
        status: "success-warning",
        completedNodes: ["start", "month", "partner", "count"],
        warningNodes: ["dryrun"],
        stoppedNode: "dryrun",
        summary:
          "Diagnostico corrigido: o problema nao era login expirado nem Partner Center fora. A sessao abriu logada nas telas de Compass e o proxy respondeu health OK. O bloqueio vinha do timeout local da rota de relacoes, que estava em 45s e matava a coleta antes de completar paginas altas.",
        notices: [
          { tone: "good", text: "Timeout de relacoes aumentado de 45s para 180s no tiktok-invite-server." },
          { tone: "good", text: "Servico reiniciado e health OK, fila vazia." },
          { tone: "good", text: "Teste pagina 20 passou HTTP 200 em aproximadamente 49s." },
          { tone: "info", text: "Coleta pagina 20 retornou 1.998 vinculos carregados de 2.267 informados, ainda com hasMore=true." },
          { tone: "warn", text: "Antes de aplicar Notion/Circle, rodar nova coleta completa e conferir total final do Partner Center." },
          { tone: "warn", text: "Report tecnico precisa explicar etapa, timeout, pagina, duracao e contagem; nao apenas dizer Partner Center bloqueado." },
        ],
      },
      {
        id: "2026-08-05-dry-run-timeout",
        date: "05/08/2026",
        mode: "dry-run",
        result: "Partner Center travou na pagina 19",
        health: "bloqueada antes de Notion/Circle",
        status: "blocked",
        completedNodes: ["start", "month"],
        warningNodes: ["partner", "count", "dryrun"],
        stoppedNode: "partner",
        summary:
          "Nao houve producao. O dry-run validou GMV de julho com 2.963 itens, mas parou na coleta oficial de ativos/vinculados do Partner Center por timeout do proxy na pagina 19. Sem essa lista completa, ainda nao da para calcular e aplicar a virada com seguranca.",
        notices: [
          { tone: "good", text: "Base julho/2026 fechada: snapshots de 01/07 a 31/07 completos." },
          { tone: "good", text: "GMV julho puxado OK: aproximadamente R$ 12,013M em 2.963 itens; 1.494 creators com GMV no mes." },
          { tone: "warn", text: "Partner Center esperado: 2.279 creators ativos/vinculados, 79 com desvinculacao solicitada e 885 perto de expirar." },
          { tone: "warn", text: "Bloqueio real: timeout do proxy na pagina 19 da coleta de vinculos ativos." },
          { tone: "info", text: "Regra corrigida: ativo sem GMV em julho vira Start." },
          { tone: "info", text: "Circle atual via n8n: Start 2.340, Silver 179, Gold 74, Diamond 51, Safira 2." },
          { tone: "warn", text: "Bloqueios do dry-run anterior: 399 com GMV nao encontrados no Notion, 71 duplicados e 62 desvinculadas com GMV em julho." },
        ],
      },
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
        date: "Planejado",
        mode: "desenho",
        result: "Fluxo corrigido para incluir todos os ativos do Partner Center",
        health: "pronto para recoleta Partner Center",
        status: "in-progress",
        completedNodes: ["start", "month", "partner", "count", "match", "unlink", "compare", "dryrun"],
        warningNodes: ["dryrun"],
        stoppedNode: "notion",
        summary:
          "A estrutura visual agora separa validacao de snapshots diarios, contagem completa de ativos, matching de handles, regra de Start para ativo sem GMV e classificacao de revisoes antes da aplicacao no Notion.",
        notices: [
          { tone: "warn", text: "Aplicacao Notion fica bloqueada ate os checks passarem ou Gabriel aprovar." },
          { tone: "good", text: "Base diaria validada de 01/01/2026 a 31/07/2026; julho pode entrar no dry-run." },
          { tone: "info", text: "Todos os 2.279 ativos precisam ter categoria; quem nao teve GMV em julho entra como Start." },
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
      { id: "start", label: "Iniciar virada", type: "trigger", sub: "cron dia 3 ou comando manual" },
      {
        id: "month",
        label: "Validar mes fechado",
        type: "data",
        sub: "snapshots diarios completos",
        href: "https://drive.google.com/drive/folders/1YpA-i-eyfVRnRS0Kb3bodWzJB_0rORnr?hl=pt-br",
      },
      {
        id: "partner",
        label: "Buscar creators ativos",
        type: "data",
        sub: "Partner Center pagina a pagina",
        href: "https://partner.tiktokshop.com/affiliate-creator/binding-creator?market=16&tab=bound",
      },
      { id: "count", label: "Conferir captura", type: "check", sub: "2.268 ativos informados" },
      { id: "match", label: "Casar handles", type: "logic", sub: "Partner Center x Notion" },
      { id: "unlink", label: "Classificar vinculo", type: "decision", sub: "ativo, alerta ou revisao" },
      { id: "compare", label: "Calcular mudancas", type: "logic", sub: "GMV x categoria; sem GMV = Start" },
      { id: "dryrun", label: "Gerar pre-run", type: "check", sub: "diffs, bloqueios e riscos" },
      { id: "notion", label: "Atualizar Notion", type: "output", sub: "GMV, categoria e status" },
      { id: "circlePlan", label: "Planejar Circle", type: "logic", sub: "remover antigo, aplicar novo" },
      { id: "circleRemove", label: "Remover acessos antigos", type: "output", sub: "tags e grupos anteriores" },
      { id: "circleApply", label: "Aplicar acessos novos", type: "output", sub: "tags e grupos atuais" },
      { id: "handleAudit", label: "Verificar @ final", type: "check", sub: "Partner x Notion x Circle" },
      { id: "report", label: "Enviar report final", type: "report", sub: "sucessos, falhas e pendencias" },
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
      aria-pressed={active}
      className={`min-h-11 w-full min-w-[82vw] snap-start rounded-lg border p-4 text-left transition-colors sm:min-w-[320px] lg:min-w-0 ${
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
    <section aria-label="Fluxo do projeto" className="max-w-full rounded-lg border border-white/10 bg-[#0A0B12]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 lg:hidden">
        <p className="text-[10px] font-mono uppercase tracking-widest text-white/45">Fluxo completo</p>
        <p className="text-[11px] text-[#25F4EE]">Deslize para ver →</p>
      </div>
      <div className="max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain p-4 sm:p-5">
        <div className="flex w-max items-center gap-3 pr-4">
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
            <div key={node.id} className="flex snap-start items-center gap-3">
              {node.href ? (
                <a
                  href={node.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`min-h-11 w-36 shrink-0 rounded-lg border p-3 shadow-xl transition-opacity hover:opacity-100 sm:w-32 ${opacity}`}
                  style={{ borderColor: visual.border, background: visual.bg }}
                >
                  {content}
                </a>
              ) : (
                <div
                  className={`w-36 shrink-0 rounded-lg border p-3 shadow-xl transition-opacity sm:w-32 ${opacity}`}
                  style={{ borderColor: visual.border, background: visual.bg }}
                >
                  {content}
                </div>
              )}
              {index < nodes.length - 1 && (
                <div className="flex items-center">
                  <div className={`h-px w-8 sm:w-10 ${lineActive ? "bg-[#25F4EE]/70" : "bg-white/10"}`} />
                  <div className={`h-2 w-2 rotate-45 border-r border-t ${lineActive ? "border-[#25F4EE]/70" : "border-white/15"}`} />
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}

function InfoBlock({ title, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-4 sm:p-5">
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
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-4 sm:p-5">
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
    <section className="rounded-lg border border-white/10 bg-[#14161F] p-4 sm:p-5">
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
          className={`min-h-11 w-full rounded-lg px-4 py-3 text-sm font-extrabold transition-colors md:w-auto ${
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

function ListBlock({ title, items, tone = "neutral" }) {
  if (!items?.length) return null;

  const toneClasses = {
    neutral: "bg-white/5 text-white/55",
    good: "bg-emerald-500/10 text-emerald-200",
    warn: "bg-yellow-500/10 text-yellow-100",
    info: "bg-cyan-500/10 text-cyan-100",
  };

  return (
    <InfoBlock title={title}>
      <div className="space-y-2">
        {items.map((item) => {
          const label = typeof item === "string" ? item : item.name || item.status || item.label;
          const detail = typeof item === "string" ? null : item.use || item.action || item.detail;
          const href = typeof item === "string" ? null : item.href;
          const className = `block rounded-md px-3 py-2 text-xs leading-relaxed ${toneClasses[item.tone] || toneClasses[tone]}`;
          const body = (
            <>
              <span className="font-bold text-white/90">{label}</span>
              {detail && <span className="mt-1 block text-white/55">{detail}</span>}
            </>
          );
          return href ? (
            <a key={`${title}-${label}`} href={href} target="_blank" rel="noreferrer" className={`${className} hover:bg-white/10`}>
              {body}
            </a>
          ) : (
            <div key={`${title}-${label}`} className={className}>{body}</div>
          );
        })}
      </div>
    </InfoBlock>
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
    <main className="min-h-screen overflow-x-hidden bg-[#0A0B12] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="mx-auto max-w-screen-xl px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:py-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-mono uppercase tracking-widest text-[#25F4EE]">Hub Retencao</p>
            <h1 className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-4xl md:text-5xl">Projetos e fluxos</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/45">
              Central visual dos projetos recorrentes: o que dispara, quais ferramentas entram, qual racional eu sigo no backend e qual output precisa sair.
            </p>
          </div>
          <Link href="/hub" className="flex min-h-11 w-full items-center justify-center rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white sm:w-auto">
            ← Voltar ao Hub
          </Link>
        </div>

        <div className="grid min-w-0 gap-5 py-6 lg:grid-cols-[360px_1fr]">
          <aside aria-label="Projetos" className="-mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
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
            <section className="rounded-lg border border-white/10 bg-[#14161F] p-4 sm:p-5">
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

              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
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

                <div className="grid gap-5 lg:grid-cols-2">
                  <ListBlock title="Regras de seguranca" items={active.hardening} tone="info" />
                  <ListBlock title="Regras de vinculo" items={active.unlinkRules} />
                </div>

                <InfoBlock title="Historico de runs">
                  <div className="space-y-2 sm:hidden">
                    {active.runs.map((run) => {
                      const runId = run.id || `${run.date}-${run.mode}`;
                      const selected = runId === selectedRunId;
                      return (
                        <button
                          key={runId}
                          type="button"
                          onClick={() => selectRun(run)}
                          className={`min-h-11 w-full rounded-lg border p-3 text-left ${
                            selected ? "border-[#25F4EE]/50 bg-[#25F4EE]/10" : "border-white/10 bg-black/15"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className={`font-bold ${selected ? "text-[#25F4EE]" : "text-white"}`}>{run.date}</span>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{run.mode}</span>
                          </span>
                          <span className="mt-2 block text-xs leading-relaxed text-white/60">{run.result}</span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-white/40">{run.health}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto sm:block">
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
                <ListBlock title="Ferramentas" items={active.tools} tone="info" />
                <ListBlock title="Riscos e bloqueios" items={active.risks} tone="warn" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
