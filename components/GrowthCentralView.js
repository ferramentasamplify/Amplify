"use client";

const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));
const fmtBRL = (n) =>
  n == null || Number.isNaN(Number(n))
    ? "—"
    : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const categories = [
  { name: "Descoberta e alcance", color: "#fb7185", channels: ["Meta orgânica", "Search Google", "Imprensa", "Relações públicas", "Eventos"], role: "Gerar novas audiências, menções orgânicas, presença em SEO e respostas de IA." },
  { name: "Vendas e conversão", color: "#fb923c", channels: ["SEO", "Social selling", "Email marketing", "Proposta comercial", "Calculadora social"], role: "Quebrar objeções, dar autoridade pré-reunião e transformar resultado em argumento comercial." },
  { name: "Nutrição e relacionamento", color: "#fde047", channels: ["Email MKT", "CRM", "Comunidade", "Customer support", "Canal direto"], role: "Manter relacionamento, responder dúvidas, educar leads e reativar oportunidades." },
  { name: "Expansão de receita", color: "#a5b4fc", channels: ["Indicação", "Cross-sell", "Upsell", "Anúncios", "Novos canais"], role: "Aumentar receita em bases existentes e transformar clientes/creators em canais de crescimento." },
  { name: "Credibilidade institucional", color: "#fed7aa", channels: ["Parcerias", "Fundadores", "Storytelling", "Employer branding", "Depoimentos"], role: "Construir confiança, contexto prévio, alinhamento de discurso e prova social institucional." },
];

const channels = [
  { name: "Meta Ads — Creators WhatsApp", category: "Conversão", funnel: "Creators", status: "parcial", leads: 2121, cpl: 2.9, source: "Meta Ads + Notion Novos Creators", gap: "UTM Campaign/AdSet/Ad vieram vazios no Notion; criativo real ainda é proxy da Meta.", next: "Persistir UTM e creative_id no n8n/Notion antes da próxima escala." },
  { name: "Meta Ads — Marcas LP", category: "Conversão", funnel: "Marcas", status: "medido", leads: 44, cpl: 29.13, source: "Meta Ads + Notion Funil de vendas", gap: "Tem utm_content por anúncio, mas ainda falta status comercial até proposta/fechamento.", next: "Conectar lead pago a reunião, proposta e fechado no CRM/Notion." },
  { name: "Instagram/Meta orgânico", category: "Descoberta", funnel: "Creators", status: "parcial", leads: 115, cpl: null, source: "Notion Novos Creators", gap: "Sem separação por post, reel, story ou perfil.", next: "Padronizar UTMs de bio/story/reels e campo content_id." },
  { name: "TikTok orgânico", category: "Descoberta", funnel: "Creators", status: "parcial", leads: 62, cpl: null, source: "Notion Novos Creators", gap: "Origem existe no Notion, mas sem conteúdo/post específico.", next: "Adicionar link/UTM por bio, post fixado e formulário." },
  { name: "Programa Indique e Ganhe", category: "Receita", funnel: "Creators", status: "parcial", leads: 70, cpl: null, source: "Notion Novos Creators", gap: "Tem origem, mas falta quem indicou, qualidade e agenciamento final.", next: "Criar tabela de referral com indicador, indicado e etapa final." },
  { name: "WhatsApp / Huggy / Chatwoot", category: "Nutrição", funnel: "Ambos", status: "sem tracking", leads: null, cpl: null, source: "Huggy, Chatwoot, Supabase chat_messages", gap: "Conversas existem, mas não estão consolidadas por origem/campanha no dashboard.", next: "Sincronizar eventos de mensagem, resposta, aceite e perda para growth_events." },
  { name: "Comunidade / Circle", category: "Nutrição", funnel: "Creators", status: "sem tracking", leads: null, cpl: null, source: "Circle / Notion / Chatwoot", gap: "Ainda sem tabela única de engajamento e conversão.", next: "Mapear membros, engajamento 30d e impacto em ativação/GMV." },
  { name: "Search Google / SEO", category: "Descoberta", funnel: "Marcas", status: "sem tracking", leads: null, cpl: null, source: "GA4 / Search Console / Landing Pages", gap: "Não conectado no Hub ainda.", next: "Conectar GA4/GSC ou export semanal para medir busca → formulário." },
  { name: "Eventos / PR / Fundadores", category: "Credibilidade", funnel: "Ambos", status: "sem tracking", leads: null, cpl: null, source: "Manual / Notion / Calendar", gap: "Sem padrão de origem para evento, palestra, indicação direta ou PR.", next: "Criar source codes por evento/campanha e campo first_touch_source." },
];

const creatorFunnel = ["Leads Notion válidos", "WhatsApp iniciado", "Respondeu", "Qualificado", "Convite enviado", "Agenciado", "Ativo / GMV"].map((name, i) => ({ name, value: i === 0 ? 2121 : null }));
const brandFunnel = ["Leads paid Notion", "Contato feito", "Reunião marcada", "Reunião feita", "Proposta enviada", "Fechado", "Receita"].map((name, i) => ({ name, value: i === 0 ? 44 : null }));

const creatives = [
  { name: "AF111 - Me_segue", funnel: "Creators", thesis: "Convite direto para creator pequeno", leads: 1192, cpl: 2.26, ctr: 8.05, decision: "proteger" },
  { name: "AF106 - Nicole&Matheus", funnel: "Creators", thesis: "Prova/autoridade com creators", leads: 1191, cpl: 2.51, ctr: 2.86, decision: "proteger" },
  { name: "AF90 - Vencedor_Matheus", funnel: "Creators", thesis: "Vencedor antigo de volume", leads: 4138, cpl: 3.11, ctr: 2.87, decision: "refresh" },
  { name: "AF91 - Vencedor_Conversa", funnel: "Creators", thesis: "Conversa/WhatsApp", leads: 510, cpl: 3.22, ctr: 1.92, decision: "refresh" },
  { name: "Mansão Live Shop Luan 1", funnel: "Marcas", thesis: "TikTok Shop + creator como motor", leads: 71, cpl: 19.04, ctr: 3.01, decision: "escalar" },
  { name: "Sede do TikTok Matheus 3", funnel: "Marcas", thesis: "Autoridade TikTok Shop", leads: 15, cpl: 15.98, ctr: 2.76, decision: "escalar" },
  { name: "China 3 (Matheus)", funnel: "Marcas", thesis: "China/importação", leads: 6, cpl: 69.26, ctr: 2.87, decision: "reduzir" },
];

const backlog = [
  ["P0", "Persistir UTMs de creator no Notion", "Destrava criativo → lead real → agenciado", "n8n + Tráfego"],
  ["P0", "Criar schema growth_events", "Une Meta, Notion, WhatsApp e CRM em uma linha do tempo", "Dados"],
  ["P1", "Conectar status comercial de marcas", "Mostra lead → reunião → proposta → fechado", "Vendas"],
  ["P1", "Classificar origem orgânica por conteúdo", "Mostra quais posts/reels geram lead bom", "Conteúdo"],
  ["P2", "Adicionar GA4/Search Console", "Mede Search Google/SEO e conteúdo evergreen", "Conteúdo"],
];

function Card({ children, className = "" }) {
  return <div className={`bg-[#14161F] border border-white/10 rounded-2xl ${className}`}>{children}</div>;
}

function Kpi({ label, value, sub, color }) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight mt-2" style={{ color }}>{value}</p>
      <p className="text-xs text-white/35 mt-1">{sub}</p>
    </Card>
  );
}

function Status({ value }) {
  const style = value === "medido" ? ["#10b981", "rgba(16,185,129,.14)"] : value === "parcial" ? ["#f59e0b", "rgba(245,158,11,.14)"] : ["#ef4444", "rgba(239,68,68,.14)"];
  return <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase" style={{ color: style[0], background: style[1] }}>{value}</span>;
}

function Funnel({ title, stages, color }) {
  const max = Math.max(...stages.map((s) => s.value || 0), 1);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white">{title}</h2>
        <span style={{ color }}>⌁</span>
      </div>
      <div className="space-y-3">
        {stages.map((s, i) => {
          const width = s.value ? Math.max(10, (s.value / max) * 100) : 8;
          return (
            <div key={s.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/55">{i + 1}. {s.name}</span>
                <span className={s.value ? "text-white font-bold" : "text-yellow-300"}>{fmtNum(s.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${width}%`, background: s.value ? color : "rgba(255,255,255,.16)" }} /></div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-white/35 mt-4 leading-relaxed">As etapas vazias são o mapa do que falta conectar: WhatsApp, CRM, Notion e fechamento.</p>
    </Card>
  );
}

export default function GrowthCentralView() {
  const measured = channels.filter((c) => c.status === "medido").length;
  const partial = channels.filter((c) => c.status === "parcial").length;
  const noTracking = channels.filter((c) => c.status === "sem tracking").length;

  return (
    <main className="min-h-screen bg-[#0A0B12] text-white">
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE] mb-2">Content-led Growth · Hub</p>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Central de Growth</h1>
            <p className="text-white/45 text-sm mt-3 max-w-3xl">Mapa de canais, funis e conversões para saber quais conteúdos geram lead, lead bom e receita. MVP baseado nos dados atuais de OpenClaw, Meta Ads e Notion.</p>
          </div>
          <a href="/hub" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors">← Voltar ao Hub</a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Creators MTD" value="2.121" sub="Meta julho 6.250 · CPL real R$ 2,90" color="#a78bfa" />
          <Kpi label="Marcas MTD" value="44" sub="Meta julho 259 · CPL real R$ 29,13" color="#fb923c" />
          <Kpi label="Canais mapeados" value="25" sub={`${measured} medido · ${partial} parcial · ${noTracking} sem tracking`} color="#25F4EE" />
          <Kpi label="Gargalo #1" value="UTM Creator" sub="Lead entra no Notion sem campaign/adset/ad" color="#ef4444" />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
          {categories.map((c) => <Card key={c.name} className="p-4">
            <div className="h-1.5 rounded-full mb-4" style={{ background: c.color }} />
            <h2 className="text-sm font-bold">{c.name}</h2>
            <p className="text-xs text-white/45 leading-relaxed mt-2 min-h-20">{c.role}</p>
            <div className="flex flex-wrap gap-1.5 mt-4">{c.channels.map((x) => <span key={x} className="px-2 py-1 rounded-full bg-white/5 text-[10px] text-white/45">{x}</span>)}</div>
          </Card>)}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Funnel title="Funil Creators" stages={creatorFunnel} color="#a78bfa" />
          <Funnel title="Funil Marcas" stages={brandFunnel} color="#fb923c" />
        </div>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-extrabold">Inventário de canais e tracking</h2>
            <p className="text-xs text-white/35 mt-1">O MVP separa o que já é medido, o que é parcial e o que ainda está invisível.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm text-left">
              <thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                <tr><th className="p-4">Canal</th><th className="p-4">Categoria</th><th className="p-4">Funil</th><th className="p-4">Leads</th><th className="p-4">CPL</th><th className="p-4">Status</th><th className="p-4">Gap</th><th className="p-4">Próxima ação</th></tr>
              </thead>
              <tbody>
                {channels.map((c) => <tr key={c.name} className="border-t border-white/5 align-top">
                  <td className="p-4 font-bold text-white">{c.name}<div className="text-[10px] font-normal text-white/30 mt-1">{c.source}</div></td>
                  <td className="p-4 text-white/55">{c.category}</td><td className="p-4 text-white/55">{c.funnel}</td><td className="p-4 font-bold">{fmtNum(c.leads)}</td><td className="p-4 font-bold">{fmtBRL(c.cpl)}</td><td className="p-4"><Status value={c.status} /></td><td className="p-4 text-xs text-white/45 leading-relaxed max-w-xs">{c.gap}</td><td className="p-4 text-xs text-white/45 leading-relaxed max-w-xs">{c.next}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid xl:grid-cols-[1.4fr_.8fr] gap-4">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="font-extrabold">Criativos e teses que já puxam crescimento</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm text-left"><thead className="bg-white/5 text-white/40 text-xs uppercase tracking-wider"><tr><th className="p-4">Criativo</th><th className="p-4">Funil</th><th className="p-4">Tese</th><th className="p-4">Leads</th><th className="p-4">CPL</th><th className="p-4">CTR</th><th className="p-4">Decisão</th></tr></thead><tbody>{creatives.map((c) => <tr key={c.name} className="border-t border-white/5"><td className="p-4 font-bold">{c.name}</td><td className="p-4 text-white/55">{c.funnel}</td><td className="p-4 text-xs text-white/45">{c.thesis}</td><td className="p-4 font-bold">{fmtNum(c.leads)}</td><td className="p-4 font-bold">{fmtBRL(c.cpl)}</td><td className="p-4 font-bold">{c.ctr.toFixed(2)}%</td><td className="p-4"><span className="px-2 py-1 rounded-full bg-white/5 text-xs font-bold uppercase">{c.decision}</span></td></tr>)}</tbody></table></div>
          </Card>
          <Card className="p-5">
            <h2 className="font-extrabold mb-4">Backlog para virar dashboard real</h2>
            <div className="space-y-3">{backlog.map(([p, item, impact, owner]) => <div key={item} className="bg-white/5 rounded-xl p-3 border border-white/5"><div className="flex justify-between text-xs"><span className="font-bold text-[#25F4EE]">{p}</span><span className="text-white/35">{owner}</span></div><p className="font-bold text-sm mt-2">{item}</p><p className="text-xs text-white/40 mt-1 leading-relaxed">{impact}</p></div>)}</div>
          </Card>
        </div>

        <Card className="p-5 border-l-4" style={{ borderLeftColor: "#25F4EE" }}>
          <p className="text-sm text-white/65 leading-relaxed"><strong className="text-white">Pitch do MVP:</strong> “Esse dashboard é o mapa de crescimento da Amplify: todos os canais, os funis de Creators e Marcas, quais canais já medimos, quais estão parciais e quais ainda estão invisíveis. A partir daqui a gente para de discutir opinião e passa a saber qual conteúdo gera lead, lead bom e receita.”</p>
        </Card>
      </div>
    </main>
  );
}
