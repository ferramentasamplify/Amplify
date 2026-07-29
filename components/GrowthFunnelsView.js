"use client";

import { useCallback, useEffect, useState } from "react";

const fmt = (value) => value == null ? "—" : Number(value).toLocaleString("pt-BR");
const fmtPct = (value) => value == null ? "—" : `${Number(value).toFixed(value >= 10 ? 0 : 1).replace(".", ",")}%`;
const fmtMoney = (value) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shift = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return iso(date); };
const shiftFrom = (base, days) => { const date = new Date(`${base}T12:00:00`); date.setDate(date.getDate() + days); return iso(date); };

const TONES = {
  violet: "#9B8CFF", pink: "#FF6FAE", cyan: "#37D7D0", amber: "#F6B84B",
  blue: "#5A8CFF", coral: "#FF765F", green: "#47D7A0", slate: "#8B93A7",
};

function Arrow({ rate, muted = false }) {
  return (
    <div className={`flow-arrow ${muted ? "muted" : ""}`} aria-label={rate == null ? "Conversão indisponível" : `${fmtPct(rate)} de conversão`}>
      <span>{rate == null ? "—" : fmtPct(rate)}</span>
      <svg viewBox="0 0 58 12" aria-hidden="true"><path d="M1 6h51M47 1l6 5-6 5" /></svg>
    </div>
  );
}

function StageBox({ stage, color, primary = false }) {
  const empty = stage.value == null;
  return (
    <div className={`stage-box ${empty ? "empty" : ""} ${primary ? "primary" : ""}`} style={{ "--accent": color }}>
      <span className="stage-label">{stage.label}</span>
      <strong>{fmt(stage.value)}</strong>
      <span className="stage-status">{empty ? "fonte não conectada" : primary ? "entrada no período" : "estado atual"}</span>
    </div>
  );
}

function Flow({ stages, color, compact = false }) {
  return (
    <div className={`stage-flow ${compact ? "compact" : ""}`}>
      {stages.map((stage, index) => (
        <div className="flow-unit" key={stage.key}>
          {index > 0 && <Arrow rate={stage.conversion} muted={stage.value == null} />}
          <StageBox stage={stage} color={color} primary={index === 0} />
        </div>
      ))}
    </div>
  );
}

const TREE_METRICS = [
  ["investment", "Investimento", "money"],
  ["leads", "Leads"],
  ["mql", "MQL"],
  ["sql", "SQL"],
  ["meeting", "Reunião"],
  ["converted", "Venda / agenciado"],
];

function TreeNode({ node, accent, depth = 0, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const expandable = Boolean(node.children?.length);
  const nodeAccent = TONES[node.tone] || accent;
  return (
    <div className={`tree-node depth-${Math.min(depth, 4)} ${open ? "open" : ""}`}>
      <article className="tree-card" style={{ "--tree-accent": nodeAccent }}>
        <button
          className="tree-toggle"
          type="button"
          disabled={!expandable}
          aria-expanded={expandable ? open : undefined}
          onClick={() => expandable && setOpen((value) => !value)}
        >
          <span className="tree-kind">{node.type === "audience" ? "Audiência" : node.type === "channel" ? "Canal" : node.type === "seller" ? "Vendedor" : node.type === "campaign" ? "Campanha" : node.type === "adset" ? "Conjunto" : "Anúncio"}</span>
          <strong>{node.label}</strong>
          {expandable && <span className="tree-action">{open ? "Recolher" : `Abrir ${node.children.length}`} <i>⌄</i></span>}
          {node.metrics?.conversion != null && <span className="tree-conversion">Conversão final <b>{fmtPct(node.metrics.conversion)}</b></span>}
        </button>
        <div className="tree-metrics">
          {TREE_METRICS.map(([key, label, format]) => {
            const value = node.metrics?.[key];
            return <div className={value == null ? "missing" : ""} key={key} title={value == null ? "fonte não conectada" : undefined}>
              <span>{label}</span><b>{format === "money" ? fmtMoney(value) : fmt(value)}</b>
              {value == null && <small>fonte não conectada</small>}
            </div>;
          })}
        </div>
        <div className="tree-costs">
          <div className={node.metrics?.costPerLead == null ? "missing" : ""}>
            <span>Custo por lead</span><b>{fmtMoney(node.metrics?.costPerLead)}</b>
            {node.metrics?.costPerLead == null
              ? <small>investimento ou leads sem fonte</small>
              : node.metrics?.costLeadBasis !== node.metrics?.leads && <small>Base Meta da mesma janela: {fmt(node.metrics?.costLeadBasis)} leads</small>}
          </div>
          <div className={node.metrics?.costPerSale == null ? "missing" : ""}>
            <span>Custo por venda / agenciamento</span><b>{fmtMoney(node.metrics?.costPerSale)}</b>
            {node.metrics?.costPerSale == null && <small>{node.metrics?.investment == null ? "investimento sem fonte" : node.source?.includes("Meta") ? "venda não atribuída a esta fonte" : "nenhuma venda conectada"}</small>}
          </div>
        </div>
        <footer><span>{node.source}</span>{node.reference && <em>{node.reference}</em>}</footer>
      </article>
      {expandable && open && <div className="tree-children">
        {node.children.map((child) => <TreeNode key={child.id} node={child} accent={nodeAccent} depth={depth + 1} />)}
      </div>}
    </div>
  );
}

function HierarchyMap({ tree, accent, metaSource }) {
  if (!tree) return null;
  return <section className="hierarchy-map">
    <div className="map-head">
      <div><span className="eyebrow">Mapa expansível</span><h3>Audiência → origem → mídia</h3><p>Abra somente os ramos com fonte real. Campanha, conjunto e anúncio vêm do snapshot Meta/creative.</p></div>
      <span className={`meta-state ${metaSource?.stale ? "stale" : ""}`}>{metaSource?.stale ? "Meta em snapshot" : "Meta conectado"}</span>
    </div>
    <TreeNode node={tree} accent={accent} defaultOpen />
  </section>;
}

function GMVPanel({ audience, accent }) {
  const groups = (audience.financialGroups || []).filter((group) => group.gmv != null);
  if (!groups.length) return null;
  const sniperLabels = { leads: "Leads do Sniper", machine: "Em prospecção", qualified: "Qualificados", invite: "Convite enviado", converted: "Agenciados" };
  return (
    <section className="gmv-panel" style={{ "--gmv-accent": accent }}>
      <div className="gmv-head">
        <div><span className="eyebrow">Leitura financeira</span><h3>Fluxos de GMV registrados</h3><p>Máquina e Sniper apresentados separadamente.</p></div>
        <div className="gmv-result">
          {groups.map((group) => <div className={group.key === "sniper" ? "sniper-result" : ""} key={group.key}>
            <span>GMV final · {group.label}</span>
            <strong>{fmtMoney(group.gmv)}</strong>
            <small>Amplify 1% · {fmtMoney(group.amplifyGain)}</small>
          </div>)}
        </div>
      </div>
      <div className="gmv-charts">
        {groups.map((group) => {
          const stages = group.stages.filter((stage) => stage.gmv != null);
          const maxStage = Math.max(...stages.map((stage) => stage.gmv), 1);
          const color = group.key === "sniper" ? TONES.blue : accent;
          return <div className="gmv-chart" key={group.key} style={{ "--group-accent": color }}>
            <h4>GMV da {group.label} por etapa</h4>
            {stages.map((stage) => <div className="gmv-row" key={stage.key}>
              <span>{group.key === "sniper" ? sniperLabels[stage.key] : stage.label}</span><b>{fmtMoney(stage.gmv)}</b>
              <div><i style={{ width: `${Math.max(2, (stage.gmv / maxStage) * 100)}%` }} /></div>
              <small>{fmt(stage.gmvCount)} com GMV · {fmtPct(stage.gmvCoverage)}</small>
            </div>)}
          </div>;
        })}
      </div>
    </section>
  );
}

function AudiencePanel({ audience, tree, accent, metaSource }) {
  return (
    <section className="audience-panel" style={{ "--audience": accent }}>
      <div className="audience-head">
        <div>
          <span className="eyebrow">Funil {audience.label}</span>
          <h2>{audience.label}</h2>
        </div>
        <div className="audience-stats">
          <div><span>{audience.quality ? "Leads únicos" : "Leads"}</span><strong>{fmt(audience.totals.leads)}</strong></div>
          <div><span>Convertidos</span><strong>{fmt(audience.totals.converted)}</strong></div>
          <div><span>Conversão</span><strong>{fmtPct(audience.totals.conversion)}</strong></div>
        </div>
      </div>

      <div className="overview-flow">
        <div className="flow-caption"><span className="pulse" /> Visão consolidada</div>
        <div className="scroll-shell"><Flow stages={audience.stages} color={accent} /></div>
      </div>

      <HierarchyMap tree={tree} accent={accent} metaSource={metaSource} />
      <GMVPanel audience={audience} accent={accent} />
    </section>
  );
}

function NewBrandFunnelPanel({ funnel }) {
  if (!funnel) return null;
  const stateLabel = funnel.state === "connected" ? "Tracking conectado" : funnel.state === "partial" ? "Tracking parcial" : "Estrutura pronta · tracking pendente";
  return (
    <section className="new-brand-funnel" style={{ "--new-brand": "#F6B84B" }}>
      <header className="new-brand-head">
        <div>
          <span className="eyebrow">Nova seção · Marcas</span>
          <h2>Novo funil <em>Aula → Mentoria</em></h2>
          <p>Jornada separada do funil atual. Cada quadrado representa uma fase mensurável até a venda da Mentoria TikTok Shop.</p>
        </div>
        <span className={`new-brand-state ${funnel.state}`}>{stateLabel}</span>
      </header>

      <div className="new-brand-stats">
        <div><span>Compras da aula · R$ 97</span><strong>{fmt(funnel.totals.lessonPurchases)}</strong></div>
        <div><span>Vendas da mentoria · R$ 15 mil</span><strong>{fmt(funnel.totals.mentoringSales)}</strong></div>
        <div><span>Conversão total</span><strong>{fmtPct(funnel.totals.totalConversion)}</strong></div>
      </div>

      <div className="new-brand-grid">
        {funnel.stages.map((stage, index) => {
          const unavailable = stage.value == null;
          return <article className={`new-phase ${unavailable ? "unavailable" : ""}`} key={stage.key}>
            <div className="new-phase-top"><span>Fase {String(index + 1).padStart(2, "0")}</span><i>{index + 1}</i></div>
            <h3>{stage.label}</h3>
            <strong className="new-phase-value">{fmt(stage.value)}</strong>
            <div className="new-phase-conversion">
              <span>{index === 0 ? "Entrada do funil" : "Conversão da fase anterior"}</span>
              <b>{index === 0 ? "Base" : fmtPct(stage.conversion)}</b>
            </div>
            <small>{stage.signal}</small>
            {unavailable && <em>fonte ainda não conectada</em>}
          </article>;
        })}
      </div>

      <footer className="new-brand-foot">
        <span><i /> Métrica vazia é “—”, nunca zero inventado.</span>
        <p>Próxima conexão: eventos dedicados da LP, formulário, checkout, consumo da aula e CRM.</p>
      </footer>
    </section>
  );
}

function Loading() {
  return <div className="loading"><span /><p>Montando o mapa dos funis…</p></div>;
}

export default function GrowthFunnelsView() {
  const [from, setFrom] = useState("2026-07-01");
  const [to, setTo] = useState(() => shift(0));
  const [preset, setPreset] = useState("q3");
  const [view, setView] = useState("both");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/growth-funnels?from=${from}&to=${to}&_=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar os funis");
      setData(payload);
      if (payload.range) { setFrom(payload.range.from); setTo(payload.range.to); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => load(true), 300_000);
    return () => clearInterval(timer);
  }, [load]);

  function applyPreset(key) {
    const coverageTo = data?.coverage?.to || shift(0);
    setPreset(key);
    if (key === "7d") setFrom(shiftFrom(coverageTo, -6));
    if (key === "30d") setFrom(shiftFrom(coverageTo, -29));
    if (key === "q3") setFrom("2026-07-01");
    setTo(coverageTo);
  }

  const audiences = data?.audiences || {};
  const showCreators = view === "both" || view === "creators";
  const showBrands = view === "both" || view === "brands";

  return (
    <main className="funnel-page">
      <nav className="topbar">
        <a href="/hub" className="brand"><span className="brand-glyph">A</span><span>Amplify UGC</span><small>/ funis</small></a>
        <a href="/hub" className="back">← Hub de Dashboards</a>
      </nav>

      <div className="page-wrap">
        <header className="hero">
          <div className="hero-copy">
            <span className="hero-kicker"><i /> Growth command center</span>
            <h1>Mapa Expansível<br /><em>dos Funis</em></h1>
            <p>Creators e Marcas começam separados. Abra cada origem até campanha, conjunto e anúncio quando a fonte real estiver conectada.</p>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-a" /><div className="orbit orbit-b" />
            <div className="orbit-core"><span className="orbit-split"><i /><i /></span><small>funis separados</small></div>
            <span className="orbit-label creators">Creators</span><span className="orbit-label brands">Marcas</span>
          </div>
        </header>

        <section className="control-deck">
          <div className="segmented" aria-label="Selecionar visão">
            {[['both','Creators + Marcas'],['creators','Creators'],['brands','Marcas']].map(([key,label]) =>
              <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>
            )}
          </div>
          <div className="presets">
            {[['7d','7 dias'],['30d','30 dias'],['q3','Q3']].map(([key,label]) =>
              <button key={key} className={preset === key ? "active" : ""} onClick={() => applyPreset(key)}>{label}</button>
            )}
          </div>
          <div className="date-fields">
            <label>De<input type="date" value={from} min={data?.coverage?.from} max={to} onChange={(e) => { setPreset(""); setFrom(e.target.value); }} /></label>
            <span>→</span>
            <label>Até<input type="date" value={to} min={from} max={data?.coverage?.to} onChange={(e) => { setPreset(""); setTo(e.target.value); }} /></label>
          </div>
          <button className={`refresh ${refreshing ? "spin" : ""}`} onClick={() => load(true)}><span>↻</span> Atualizar</button>
        </section>

        {error && <div className="error"><strong>Os funis nao carregaram.</strong><span>{error}</span><button onClick={() => load()}>Tentar novamente</button></div>}
        {loading && !data ? <Loading /> : data && <>
          <section className="signal-strip">
            <div className="creator-signal"><span>Creators</span><strong>{fmt(data.summary.creators.leads)}</strong><small>{fmtPct(data.summary.creators.conversion)} lead → agenciado</small></div>
            <div className="brand-signal"><span>Marcas · leads únicos</span><strong>{fmt(data.summary.brands.leads)}</strong><small>{audiences.brands?.quality ? `${fmt(audiences.brands.quality.bitrixMatchedLeads)} conectados ao Bitrix neste período` : "integração comercial pendente"}</small></div>
            <div><span>Atualização</span><strong className="status-value"><i className={data.stale ? "warn" : ""} />{data.stale ? "Snapshot" : "Automático"}</strong><small>{new Date(data.generatedAt).toLocaleString("pt-BR")}</small></div>
          </section>

          <div className="audience-stack">
            {showCreators && <AudiencePanel audience={audiences.creators} tree={data.hierarchy?.creators} metaSource={data.metaSource} accent="#9B8CFF" />}
            {showBrands && <>
              <AudiencePanel audience={audiences.brands} tree={data.hierarchy?.brands} metaSource={data.metaSource} accent="#FF765F" />
              <NewBrandFunnelPanel funnel={data.newBrandFunnel} />
            </>}
          </div>

          <footer className="methodology">
            <div><span>Como ler</span><p>{data.methodology.cohort}</p></div>
            <div><span>GMV registrado</span><p>{data.methodology.creators} Ganho Amplify calculado como exatamente 1% do GMV final registrado.</p></div>
            <div><span>Bitrix conectado</span><p>{data.methodology.brands} Leads sem vínculo determinístico permanecem apenas na entrada, sem conversão inventada.</p></div>
          </footer>
        </>}
      </div>

      <style jsx global>{`
        :global(body){background:#070910!important;color:#F4F6FF!important}.funnel-page{min-height:100vh;overflow-x:hidden;background:radial-gradient(circle at 78% 8%,rgba(155,140,255,.11),transparent 28%),radial-gradient(circle at 12% 42%,rgba(255,118,95,.07),transparent 24%),#070910;color:#F4F6FF;font-family:Inter,system-ui,sans-serif}.topbar{height:64px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1440px)/2));background:rgba(7,9,16,.86);backdrop-filter:blur(18px);position:sticky;top:0;z-index:20}.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800}.brand small{color:#646B7E;font-family:ui-monospace,monospace;font-weight:500}.brand-glyph{display:grid;place-items:center;width:28px;height:28px;background:linear-gradient(135deg,#3157FF 0 48%,#EA1A4E 48%);border-radius:8px;font-size:13px}.back{color:#8E95A8;text-decoration:none;font-size:13px}.back:hover{color:#fff}.page-wrap{max-width:1440px;margin:auto;padding:44px 24px 72px}.hero{min-height:300px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);position:relative;overflow:hidden}.hero-copy{max-width:780px;position:relative;z-index:2}.hero-kicker,.eyebrow{font:700 11px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#A7AFC1}.hero-kicker i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#47D7A0;box-shadow:0 0 14px #47D7A0;margin-right:8px}.hero h1{font-size:clamp(52px,7vw,94px);line-height:.88;letter-spacing:-.065em;margin:22px 0 24px;font-weight:850}.hero h1 em{font-style:normal;color:transparent;-webkit-text-stroke:1px rgba(244,246,255,.5)}.hero p{max-width:690px;color:#969DAF;font-size:16px;line-height:1.6}.hero-orbit{width:330px;height:250px;position:relative;flex:0 0 330px}.orbit{position:absolute;border:1px solid rgba(255,255,255,.12);border-radius:50%;inset:30px;transform:rotate(-14deg)}.orbit-b{inset:66px 20px;transform:rotate(24deg);border-color:rgba(155,140,255,.27)}.orbit-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:112px;height:112px;border-radius:50%;display:grid;place-content:center;text-align:center;background:#10131E;border:1px solid rgba(155,140,255,.5);box-shadow:0 0 50px rgba(155,140,255,.14)}.orbit-core>span{font-size:28px;font-weight:900}.orbit-split{display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:7px}.orbit-split i{display:block;width:18px;height:18px;border-radius:6px;transform:rotate(45deg)}.orbit-split i:first-child{background:#9B8CFF;box-shadow:0 0 14px rgba(155,140,255,.45)}.orbit-split i:last-child{background:#FF765F;box-shadow:0 0 14px rgba(255,118,95,.4)}.orbit-core small{font:600 10px ui-monospace;color:#7F879A;text-transform:uppercase}.orbit-label{position:absolute;font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.12em}.orbit-label.creators{left:18px;top:45px;color:#9B8CFF}.orbit-label.brands{right:8px;bottom:46px;color:#FF765F}.control-deck{margin:24px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px;border:1px solid rgba(255,255,255,.09);background:#0D1018;border-radius:14px}.segmented,.presets{display:flex;background:#070910;border:1px solid rgba(255,255,255,.07);padding:3px;border-radius:10px}.segmented button,.presets button{border:0;background:transparent;color:#777F92;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer}.segmented button.active{background:#F4F6FF;color:#090B12}.presets button.active{background:rgba(155,140,255,.15);color:#C4BAFF}.date-fields{display:flex;align-items:end;gap:8px;margin-left:auto}.date-fields label{display:grid;gap:4px;color:#666E81;font:700 9px ui-monospace;text-transform:uppercase}.date-fields input{color:#CBD0DC;background:#070910;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:7px 9px;font:600 11px ui-monospace;color-scheme:dark}.date-fields>span{padding-bottom:8px;color:#5D6578}.refresh{border:1px solid rgba(255,255,255,.1);background:#151925;color:#DDE1EA;border-radius:9px;padding:9px 13px;font-weight:700;font-size:12px;cursor:pointer}.refresh.spin span{display:inline-block;animation:spin 1s linear infinite}.signal-strip{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid rgba(255,255,255,.09);border-radius:16px;overflow:hidden;background:#0B0E16;margin-bottom:24px}.signal-strip>div{padding:20px 22px;border-right:1px solid rgba(255,255,255,.08);display:grid;gap:5px}.signal-strip>div:last-child{border:0}.signal-strip span{font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.1em;color:#747C90}.signal-strip strong{font-size:28px;letter-spacing:-.04em}.signal-strip small{font-size:10px;color:#646C80}.creator-signal strong{color:#9B8CFF}.brand-signal strong{color:#FF765F}.status-value{font-size:16px!important;display:flex;align-items:center;gap:8px}.status-value i{width:8px;height:8px;border-radius:50%;background:#47D7A0;box-shadow:0 0 10px #47D7A0}.status-value i.warn{background:#F6B84B;box-shadow:none}.audience-stack{display:grid;gap:28px}.audience-panel{border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,color-mix(in srgb,var(--audience) 5%,#0B0E16),#0B0E16 36%);border-radius:22px;overflow:hidden}.audience-panel:before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--audience),transparent 72%)}.audience-head{padding:28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.07)}.audience-head .eyebrow{color:var(--audience)}.audience-head h2{font-size:36px;letter-spacing:-.05em;margin:6px 0 0}.audience-stats{display:flex;gap:34px}.audience-stats div{display:grid;gap:4px}.audience-stats span{font:700 9px ui-monospace;text-transform:uppercase;color:#6F778B}.audience-stats strong{font-size:20px}.overview-flow{padding:24px 28px;border-bottom:1px solid rgba(255,255,255,.07)}.flow-caption{font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.12em;color:#798196;margin-bottom:16px}.pulse{display:inline-block;width:6px;height:6px;background:var(--audience);border-radius:50%;margin-right:6px;box-shadow:0 0 10px var(--audience)}.scroll-shell{overflow-x:auto;padding-bottom:5px}.stage-flow{display:flex;align-items:center;min-width:max-content}.flow-unit{display:flex;align-items:center}.stage-box{width:160px;min-height:104px;padding:15px;border:1px solid color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.1));background:color-mix(in srgb,var(--accent) 7%,#10131D);border-radius:12px;display:flex;flex-direction:column;justify-content:space-between}.stage-box.primary{background:var(--accent);color:#090B12;border-color:var(--accent)}.stage-box.empty{border-style:dashed;background:#0D1018}.stage-label{font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.08em;color:#8991A4}.primary .stage-label,.primary .stage-status{color:rgba(9,11,18,.62)}.stage-box strong{font-size:27px;letter-spacing:-.04em}.stage-status{font-size:9px;color:#5F677B}.empty strong{color:#7A8296}.flow-arrow{width:82px;display:grid;place-items:center;gap:3px;color:#8F97A9}.flow-arrow span{font:800 10px ui-monospace}.flow-arrow svg{width:58px}.flow-arrow path{stroke:currentColor;fill:none;stroke-width:1.2}.flow-arrow.muted{color:#404757}.channel-head{display:flex;align-items:end;justify-content:space-between;padding:24px 28px 15px}.channel-head h3{font-size:17px;margin:0 0 5px}.channel-head p{font-size:12px;color:#6E7689}.coverage-badge{font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--audience);border:1px solid color-mix(in srgb,var(--audience) 30%,transparent);background:color-mix(in srgb,var(--audience) 8%,transparent);padding:6px 9px;border-radius:999px}.channel-list{padding:0 14px 14px}.channel-row{display:grid;grid-template-columns:190px 1fr;align-items:center;border-top:1px solid rgba(255,255,255,.055);padding:14px}.channel-name{display:flex;align-items:stretch;gap:10px;min-width:0;padding:10px;border:1px solid color-mix(in srgb,var(--channel) 22%,rgba(255,255,255,.07));background:color-mix(in srgb,var(--channel) 5%,#0D1018);border-radius:11px}.channel-mark{width:7px;min-height:66px;border-radius:10px;background:var(--channel);box-shadow:0 0 18px color-mix(in srgb,var(--channel) 35%,transparent)}.channel-summary{display:grid;grid-template-columns:1fr;gap:4px;min-width:0;width:100%}.channel-summary>strong{font-size:12px}.channel-summary>small{font-size:9px;color:#697186;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.channel-final{display:grid;grid-template-columns:1fr auto;align-items:end;gap:1px 8px;margin-top:4px;padding-top:7px;border-top:1px solid color-mix(in srgb,var(--channel) 22%,rgba(255,255,255,.06))}.channel-final em{font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.07em;color:#7E879B;font-style:normal}.channel-final b{grid-row:1/3;grid-column:2;font-size:19px;line-height:1;color:var(--channel);letter-spacing:-.04em}.channel-final i{font-size:8px;color:#596174;font-style:normal}.compact .stage-box{width:120px;min-height:70px;padding:10px}.compact .stage-box strong{font-size:18px}.compact .stage-label{font-size:8px}.compact .stage-status{display:none}.compact .flow-arrow{width:60px}.compact .flow-arrow svg{width:42px}.channel-scroll{padding-left:8px}.gmv-panel{margin:10px 28px 28px;padding:24px;border:1px solid rgba(71,215,160,.18);background:linear-gradient(135deg,rgba(71,215,160,.055),rgba(246,184,75,.025));border-radius:16px}.gmv-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.07)}.gmv-head .eyebrow{color:#47D7A0}.gmv-head h3{font-size:22px;margin:6px 0}.gmv-head p{font-size:11px;color:#687186}.gmv-result{display:flex;gap:1px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);border-radius:11px;overflow:hidden}.gmv-result>div{display:grid;gap:3px;min-width:170px;padding:13px 16px;background:#0D1118}.gmv-result span{font:700 8px ui-monospace;text-transform:uppercase;color:#778094}.gmv-result strong{font-size:22px;color:#47D7A0}.gmv-result small{font-size:8px;color:#596174}.gmv-result .sniper-result{background:rgba(75,154,255,.07)}.gmv-result .sniper-result strong{color:#4B9AFF}.gmv-charts{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:22px}.gmv-chart{padding:16px;border:1px solid rgba(255,255,255,.07);background:rgba(7,9,16,.42);border-radius:12px}.gmv-chart h4{font-size:12px;margin:0 0 15px;color:#C7CDDA}.gmv-row{display:grid;grid-template-columns:125px 1fr auto;align-items:center;gap:5px 12px;margin-top:12px}.gmv-row>span{font-size:9px;color:#858EA2}.gmv-row>b{grid-column:3;font-size:12px;color:#DCE2EC}.gmv-row>div{grid-column:2/4;height:7px;background:rgba(255,255,255,.055);border-radius:99px;overflow:hidden}.gmv-row>div i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--group-accent),#47D7A0)}.gmv-row>small{grid-column:2/4;font-size:8px;color:#555E71}.methodology{margin-top:24px;display:grid;grid-template-columns:1.2fr .8fr 1.2fr;gap:1px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden}.methodology>div{background:#0B0E16;padding:18px}.methodology span{font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.1em;color:#858DA0}.methodology p{font-size:11px;line-height:1.5;color:#697186;margin-top:7px}.loading{min-height:360px;display:grid;place-content:center;justify-items:center;gap:12px;color:#7D8598}.loading span{width:34px;height:34px;border-radius:50%;border:2px solid rgba(155,140,255,.18);border-top-color:#9B8CFF;animation:spin .8s linear infinite}.error{padding:18px;border:1px solid rgba(255,118,95,.28);background:rgba(255,118,95,.07);border-radius:12px;display:flex;gap:12px;align-items:center;color:#FFB1A4}.error span{color:#A78380;font-size:12px}.error button{margin-left:auto;background:#FF765F;border:0;border-radius:8px;padding:8px 11px;font-weight:800;cursor:pointer}@keyframes spin{to{transform:rotate(360deg)}}
        .hierarchy-map{padding:26px 28px 30px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(4,6,12,.28)}.map-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.map-head h3{font-size:20px;letter-spacing:-.025em;margin:7px 0 5px}.map-head p{margin:0;color:#737C91;font-size:12px;line-height:1.5}.meta-state{flex:0 0 auto;border:1px solid rgba(71,215,160,.25);background:rgba(71,215,160,.08);color:#74E4B8;border-radius:999px;padding:7px 10px;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.08em}.meta-state.stale{border-color:rgba(246,184,75,.28);background:rgba(246,184,75,.08);color:#F6C66F}.tree-node{position:relative;min-width:0}.tree-card{min-width:0;display:grid;grid-template-columns:minmax(220px,1.25fr) minmax(420px,2fr);border:1px solid rgba(255,255,255,.09);background:#0E121C;border-radius:14px;overflow:hidden;box-shadow:inset 3px 0 0 color-mix(in srgb,var(--tree-accent) 70%,transparent)}.tree-toggle{min-width:0;border:0;border-right:1px solid rgba(255,255,255,.07);background:transparent;color:#F3F5FC;padding:15px 16px;text-align:left;display:grid;grid-template-columns:1fr auto;gap:4px 10px;cursor:pointer}.tree-toggle:disabled{cursor:default}.tree-toggle:focus-visible{outline:2px solid var(--tree-accent);outline-offset:-3px}.tree-kind{grid-column:1/-1;color:var(--tree-accent);font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.12em}.tree-toggle strong{min-width:0;font-size:13px;line-height:1.25;overflow-wrap:anywhere}.tree-action{align-self:center;color:#8E96A9;font:700 9px ui-monospace;white-space:nowrap}.tree-action i{display:inline-block;font-style:normal;font-size:13px;transition:transform .18s}.tree-node.open>.tree-card .tree-action i{transform:rotate(180deg)}.tree-conversion{grid-column:1/-1;justify-self:start;display:inline-flex;align-items:center;gap:7px;margin-top:5px;padding:5px 8px;border:1px solid color-mix(in srgb,var(--tree-accent) 30%,rgba(255,255,255,.08));border-radius:999px;background:color-mix(in srgb,var(--tree-accent) 9%,transparent);color:#8F98AB;font:700 8px ui-monospace;text-transform:uppercase;letter-spacing:.06em}.tree-conversion b{color:var(--tree-accent);font-size:11px;letter-spacing:0}.tree-metrics{min-width:0;display:grid;grid-template-columns:repeat(6,minmax(62px,1fr))}.tree-metrics>div{min-width:0;padding:12px 9px;border-right:1px solid rgba(255,255,255,.055);display:grid;align-content:center;gap:3px}.tree-metrics>div:last-child{border:0}.tree-metrics span{color:#747D91;font:700 8px ui-monospace;text-transform:uppercase;line-height:1.2}.tree-metrics b{font-size:13px;overflow-wrap:anywhere}.tree-metrics small{color:#535B6C;font-size:7px;line-height:1.1}.tree-metrics .missing b{color:#646C7D}.tree-costs{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.07);background:color-mix(in srgb,var(--tree-accent) 4%,#090C14)}.tree-costs>div{min-width:0;padding:11px 14px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:3px 12px}.tree-costs>div+div{border-left:1px solid rgba(255,255,255,.07)}.tree-costs span{color:#8992A5;font:700 8px ui-monospace;text-transform:uppercase;letter-spacing:.07em}.tree-costs b{color:var(--tree-accent);font-size:16px}.tree-costs small{grid-column:1/-1;color:#555E70;font-size:8px}.tree-costs .missing b{color:#646C7D}.tree-card footer{grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;padding:6px 14px;border-top:1px solid rgba(255,255,255,.055);color:#596175;font:600 8px ui-monospace}.tree-card footer em{font-style:normal;text-align:right}.tree-children{position:relative;display:grid;gap:9px;margin:9px 0 0 32px;padding-left:18px}.tree-children:before{content:"";position:absolute;left:0;top:-9px;bottom:16px;width:1px;background:linear-gradient(var(--tree-accent),rgba(255,255,255,.06))}.tree-children>.tree-node:before{content:"";position:absolute;left:-18px;top:28px;width:18px;height:1px;background:color-mix(in srgb,var(--tree-accent) 55%,rgba(255,255,255,.08))}.tree-node.depth-2 .tree-card,.tree-node.depth-3 .tree-card,.tree-node.depth-4 .tree-card{background:#0B0F18}.tree-node.depth-4 .tree-kind{color:#8992A6}
        .new-brand-funnel{border:1px solid rgba(246,184,75,.22);border-radius:22px;overflow:hidden;background:linear-gradient(145deg,rgba(246,184,75,.075),rgba(12,15,24,.96) 38%);box-shadow:0 24px 70px rgba(0,0,0,.22)}.new-brand-head{padding:30px 32px 22px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(255,255,255,.07)}.new-brand-head h2{margin:8px 0 8px;font-size:34px;line-height:1;letter-spacing:-.045em}.new-brand-head h2 em{font-style:normal;color:var(--new-brand)}.new-brand-head p{margin:0;max-width:720px;color:#8E96A9;font-size:13px;line-height:1.55}.new-brand-state{flex:0 0 auto;padding:8px 11px;border-radius:999px;border:1px solid rgba(246,184,75,.28);background:rgba(246,184,75,.08);color:#F6C66F;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.08em}.new-brand-state.connected{border-color:rgba(71,215,160,.28);background:rgba(71,215,160,.08);color:#74E4B8}.new-brand-stats{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.new-brand-stats>div{display:grid;gap:5px;padding:18px 24px;border-right:1px solid rgba(255,255,255,.07)}.new-brand-stats>div:last-child{border-right:0}.new-brand-stats span{color:#747D91;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.08em}.new-brand-stats strong{font-size:24px;letter-spacing:-.035em}.new-brand-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;padding:24px}.new-phase{min-width:0;aspect-ratio:1/1;display:flex;flex-direction:column;padding:17px;border:1px solid rgba(246,184,75,.18);border-radius:15px;background:linear-gradient(160deg,rgba(246,184,75,.09),rgba(10,13,21,.92) 48%);box-shadow:inset 0 1px 0 rgba(255,255,255,.035);position:relative;overflow:hidden}.new-phase:after{content:"";position:absolute;right:-35px;bottom:-35px;width:88px;height:88px;border:1px solid rgba(246,184,75,.12);border-radius:50%}.new-phase-top{display:flex;align-items:center;justify-content:space-between;color:#C3974E;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.new-phase-top i{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:rgba(246,184,75,.12);font-style:normal;color:#F6C66F}.new-phase h3{margin:14px 0 8px;min-height:2.7em;font-size:15px;line-height:1.3;letter-spacing:-.015em}.new-phase-value{font-size:32px;line-height:1;letter-spacing:-.045em;color:#FFF}.new-phase-conversion{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}.new-phase-conversion span{max-width:100px;color:#737C90;font-size:9px;line-height:1.25}.new-phase-conversion b{color:#F6C66F;font-size:13px}.new-phase>small{display:block;margin-top:9px;color:#7E879A;font-size:9px;line-height:1.35}.new-phase>em{margin-top:6px;color:#596174;font:700 8px ui-monospace;text-transform:uppercase;letter-spacing:.06em}.new-brand-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 24px;border-top:1px solid rgba(255,255,255,.07);color:#737C90;font-size:10px}.new-brand-foot span{display:flex;align-items:center;gap:7px}.new-brand-foot i{width:6px;height:6px;border-radius:50%;background:#F6B84B}.new-brand-foot p{margin:0;text-align:right}.new-phase.unavailable .new-phase-value{color:#697185}
        @media(max-width:1200px){.new-brand-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.new-phase{aspect-ratio:auto;min-height:230px}}
        @media(max-width:900px){.new-brand-head{display:grid}.new-brand-state{justify-self:start}.new-brand-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.new-brand-stats{grid-template-columns:1fr 1fr}.new-brand-stats>div:nth-child(2){border-right:0}.new-brand-stats>div:last-child{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.07)}}
        @media(max-width:900px){.hero-orbit{display:none}.signal-strip{grid-template-columns:repeat(2,1fr)}.signal-strip>div:nth-child(2){border-right:0}.signal-strip>div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.08)}.signal-strip>div:last-child{grid-column:1/-1}.audience-head{align-items:flex-start}.audience-stats{gap:16px}.channel-row{grid-template-columns:190px 1fr}.gmv-charts{grid-template-columns:1fr}.methodology{grid-template-columns:1fr}.date-fields{margin-left:0}.control-deck{align-items:flex-end}.tree-card{grid-template-columns:1fr}.tree-toggle{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.tree-metrics{grid-template-columns:repeat(3,1fr)}.tree-metrics>div:nth-child(3){border-right:0}.tree-metrics>div:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.055)}}
        @media(max-width:620px){.new-brand-head{padding:24px 18px 18px}.new-brand-head h2{font-size:30px}.new-brand-stats>div{padding:15px 14px}.new-brand-stats strong{font-size:20px}.new-brand-grid{grid-template-columns:1fr;padding:14px}.new-phase{min-height:220px}.new-brand-foot{display:grid;padding:14px 18px}.new-brand-foot p{text-align:left}.topbar{padding:0 16px}.brand small{display:none}.back{font-size:11px}.page-wrap{padding:28px 14px 48px}.hero{min-height:250px}.hero h1{font-size:54px}.hero p{font-size:14px}.control-deck{display:grid;grid-template-columns:1fr auto}.segmented{grid-column:1/-1}.segmented button{flex:1}.presets{grid-column:1/-1}.presets button{flex:1}.date-fields{grid-column:1/-1;width:100%}.date-fields label{flex:1}.date-fields input{width:100%}.signal-strip{grid-template-columns:1fr 1fr}.signal-strip>div{padding:16px}.signal-strip strong{font-size:22px}.audience-head{padding:22px 18px;display:grid;gap:18px}.audience-head h2{font-size:31px}.audience-stats{justify-content:space-between;width:100%;gap:12px}.audience-stats strong{font-size:17px}.overview-flow{padding:20px 18px}.channel-head{padding:20px 18px 12px;align-items:start}.channel-head p{max-width:220px}.coverage-badge{display:none}.channel-list{padding:0 5px 8px}.channel-row{grid-template-columns:170px 1fr;padding:12px 8px}.channel-summary>small{max-width:128px}.stage-box{width:138px}.flow-arrow{width:68px}.gmv-panel{margin:10px 8px 18px;padding:16px}.gmv-head{display:grid;align-items:start}.gmv-result{display:grid;grid-template-columns:1fr 1fr;width:100%}.gmv-result>div{min-width:0;padding:12px}.gmv-result strong{font-size:18px}.gmv-charts{gap:14px}.gmv-chart{padding:13px}.gmv-row{grid-template-columns:84px 1fr auto;gap:5px 8px}.gmv-row>span{line-height:1.2}.methodology{grid-template-columns:1fr}.hero-kicker{font-size:9px}.hierarchy-map{padding:20px 10px 24px}.map-head{display:grid;gap:10px}.meta-state{justify-self:start}.tree-children{margin-left:8px;padding-left:8px}.tree-children>.tree-node:before{left:-8px;width:8px}.tree-toggle{padding:13px 12px}.tree-metrics>div{padding:10px 7px}.tree-metrics b{font-size:12px}.tree-card footer{display:grid}.tree-card footer em{text-align:left}.tree-action{font-size:8px}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
      `}</style>
    </main>
  );
}
