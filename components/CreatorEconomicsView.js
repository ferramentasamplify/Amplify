"use client"
/* eslint-disable react-hooks/set-state-in-effect -- loading state is reset when the request identity changes */

import { useEffect, useMemo, useState } from "react"
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 })
const compactMoney = (value) => new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 }).format(Number(value || 0))
const integer = (value) => Number(value || 0).toLocaleString("pt-BR")
const percent = (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
const ratio = (value) => value == null ? "—" : Number(value) > 0 && Number(value) < 0.01 ? "<0,01x" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`
const date = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"
const monthLabel = (value) => value ? new Date(`${value}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(" de ", " ") : ""

function Metric({ label, value, note, tone = "violet" }) {
  return <div className={`econ-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function TrustPill({ ok, children }) {
  return <span className={`trust-pill ${ok ? "ok" : "warn"}`}><i />{children}</span>
}

function ChartTooltip({ active, payload, label, moneyKeys = [] }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{monthLabel(label)}</strong>{payload.map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{moneyKeys.includes(item.dataKey) ? money(item.value) : integer(item.value)}</b></div>)}</div>
}

function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{integer(item.value)}</b></div>)}</div>
}

function signedInteger(value) {
  if (value == null) return "—"
  return `${value > 0 ? "+" : ""}${integer(value)}`
}

function CreatorDetail({ creator }) {
  return <div className="creator-detail">
    <div className="detail-evidence">
      <div><span>Origem atribuida</span><strong>{creator.acquisition.label}</strong><small>{creator.acquisition.evidence}{creator.acquisition.detail ? ` · ${creator.acquisition.detail}` : ""}</small></div>
      <div><span>Base de aquisicao</span><strong>{creator.acquisition.systemLabel}</strong><small>First-touch em {date(creator.acquisition.entryAt)}</small></div>
      <div><span>Formulario</span><strong>{creator.form.matched ? "Encontrado" : "Nao encontrado"}</strong><small>{creator.form.matched ? `${creator.form.channel || "Canal nao preenchido"} · ${date(creator.form.createdAt)}` : "Sem correspondencia exata do @"}</small></div>
      <div><span>Historico de @</span><strong>{creator.aliases.length}</strong><small>{creator.aliases.map((alias) => `@${alias}`).join(" · ")}</small></div>
      <div><span>Vinculacoes</span><strong>{creator.runs.length}</strong><small>{creator.runs.map((run) => `${date(run.from)}–${date(run.to)} (${run.days}d)`).join(" · ")}</small></div>
    </div>
    <div className="month-tape">
      {creator.monthly.map((item) => <div key={item.month}><span>{monthLabel(item.month)}</span><strong>{money(item.estimatedAmplifyRevenue)}</strong><small>{integer(item.activeDays)} dias · GMV {compactMoney(item.gmv)}</small><i style={{ width: `${Math.min(100, item.estimatedAmplifyRevenue / Math.max(...creator.monthly.map((month) => month.estimatedAmplifyRevenue), 1) * 100)}%` }} /></div>)}
    </div>
  </div>
}

export default function CreatorEconomicsView() {
  const [from, setFrom] = useState("2026-01")
  const [to, setTo] = useState("2026-07")
  const [source, setSource] = useState("all")
  const [queryDraft, setQueryDraft] = useState("")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("revenue")
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState("")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(queryDraft); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [queryDraft])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    setData(null)
    const params = new URLSearchParams({ from, to, source, q: query, sort, page: String(page), limit: "100" })
    fetch(`/api/creator-economics?${params}&_=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Falha ao carregar"); return payload })
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        if (payload.range) { setFrom(payload.range.from); setTo(payload.range.to) }
      })
      .catch((cause) => { if (!cancelled) { setData(null); setError(cause.message) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to, source, query, sort, page])

  const chartData = useMemo(() => (data?.monthly || []).map((item) => ({ ...item, label: monthLabel(item.month) })), [data])
  const dailyData = useMemo(() => data?.affiliationDaily?.series || [], [data])
  const affiliation = data?.affiliationDaily || {}
  const summary = data?.summary || {}
  const paid = data?.paidEconomics || {}
  const showPaid = source === "all" || source === "paid-meta"

  return <main className="economics-page">
    <nav className="econ-topbar">
      <a href="/hub" className="econ-brand"><b>A</b><span>Amplify UGC</span><small>/ economia creator</small></a>
      <a href="/hub" className="econ-back">← Hub de Dashboards</a>
    </nav>

    <div className="econ-wrap">
      <header className="econ-hero">
        <div>
          <span className="econ-kicker"><i /> Unit economics conectado</span>
          <h1>CAC encontra<br /><em>LTV real.</em></h1>
          <p>Da origem de aquisicao ao GMV diario do Partner Center. Cada creator e unido pelo @ e pelo historico de aliases — sem misturar snapshot acumulado com receita nova.</p>
        </div>
        <div className="hero-formula">
          <span>Receita Amplify estimada</span>
          <strong>10%</strong>
          <p>da <b>comissao estimada do creator</b></p>
          <small>Nao usamos mais 1% fixo do GMV.</small>
        </div>
      </header>

      <section className="econ-controls">
        <div className="month-control"><label>Atividade desde<input type="month" value={from} min={data?.coverage?.from?.slice(0, 7)} max={to} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label><span>→</span><label>Ate<input type="month" value={to} min={from} max={data?.coverage?.to?.slice(0, 7)} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label></div>
        <div className="trust-row">
          <TrustPill ok={!paid.meta?.stale}>Meta {paid.meta?.stale ? "indisponivel" : "ao vivo"}</TrustPill>
          <TrustPill ok={Boolean(data?.coverage?.dailySnapshots)}>GMV acumulado · {integer(data?.coverage?.dailySnapshots)} snapshots</TrustPill>
          <TrustPill ok>AmplifyOS nativo · {integer(data?.sources?.amplifyos?.uniqueHandles || 0)} @</TrustPill>
          <TrustPill ok>Join exato por @</TrustPill>
          <TrustPill ok={false}>Desconhecida = Meta assumido</TrustPill>
        </div>
      </section>

      {error && <div className="econ-error"><strong>O painel nao carregou.</strong><span>{error}</span></div>}
      {loading && !data ? <div className="econ-loading"><i /><span>Cruzando aquisicao, formularios e retencao…</span></div> : data && <>
        <section className="affiliation-daily">
          <header className="affiliation-head">
            <div><span className="affiliation-kicker">Ledger diario canonico</span><h2>Agenciados por dia</h2><p>Uma consulta fechada por data no relatorio Criador. Sem inferir vinculo por GMV acumulado.</p></div>
            <span className={`ledger-status ${affiliation.complete ? "ok" : "warn"}`}><i />{affiliation.complete ? `${integer(affiliation.range?.days)} dias completos` : `${integer(affiliation.missingDays?.length)} dias ausentes`}</span>
          </header>
          <div className="affiliation-layout">
            <div className="affiliation-latest">
              <span>Ultimo dia fechado · {date(affiliation.latest?.date)}</span>
              <strong>{integer(affiliation.latest?.affiliatedCreators)}</strong>
              <div><b className={(affiliation.latest?.delta || 0) >= 0 ? "up" : "down"}>{signedInteger(affiliation.latest?.delta)}</b><small> vs. dia anterior</small></div>
              <p>{integer(affiliation.latest?.gmvCreators)} tiveram GMV no dia — leitura separada.</p>
            </div>
            <div className="affiliation-stats">
              <div><span>Maximo no periodo</span><strong>{integer(affiliation.maximum?.affiliatedCreators)}</strong><small>{date(affiliation.maximum?.date)}</small></div>
              <div><span>Minimo no periodo</span><strong>{integer(affiliation.minimum?.affiliatedCreators)}</strong><small>{date(affiliation.minimum?.date)}</small></div>
              <div><span>Media diaria</span><strong>{integer(affiliation.average)}</strong><small>{integer(affiliation.range?.days)} dias fechados</small></div>
              <div><span>Evolucao no periodo</span><strong>{signedInteger(affiliation.growthSinceStart)}</strong><small>primeiro ao ultimo dia</small></div>
            </div>
            <div className="affiliation-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 920, height: 310 }}>
                <ComposedChart data={dailyData} margin={{ top: 18, right: 8, left: -10, bottom: 0 }}>
                  <defs><linearGradient id="affiliationFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".32" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                  <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={54} domain={["dataMin - 40", "dataMax + 40"]} />
                  <YAxis yAxisId="gmv" orientation="right" stroke="#3D7180" tick={{ fontSize: 10 }} width={46} />
                  <Tooltip content={<DailyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <Line yAxisId="gmv" type="monotone" dataKey="gmvCreators" name="Com GMV no dia" stroke="#54D8E8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <footer><span>Fonte: {affiliation.source}</span>{source !== "all" && <b>Serie global — o filtro de origem nao altera o ledger diario.</b>}</footer>
        </section>

        <section className="metric-grid">
          <Metric label="Creators observados" value={integer(summary.observedCreators ?? summary.activeCreators)} note={`${integer(summary.enteredCreators)} apareceram pela primeira vez no relatorio`} />
          <Metric label="Com formulario" value={percent(summary.formMatchRate)} note={`${integer(summary.matchedForms)} @ encontrados na Base de Creators`} tone="blue" />
          <Metric label="GMV observado" value={money(summary.gmv)} note="Somado por fechamento mensal, sem duplicidade" tone="cyan" />
          <Metric label="Receita Amplify" value={money(summary.estimatedAmplifyRevenue)} note="10% da comissao estimada do creator" tone="green" />
          {showPaid && <Metric label="CAC pago · media alocada" value={paid.acquiredCac == null ? "—" : money(paid.acquiredCac)} note={`${integer(paid.cohortCreators)} creators · Meta explicito + desconhecida assumida`} tone="amber" />}
          {showPaid && <Metric label="LTV / CAC pago · agregado" value={ratio(paid.ltvCac)} note={`LTV observado medio ${paid.avgObservedLtv == null ? "—" : money(paid.avgObservedLtv)}`} tone="rose" />}
        </section>

        {showPaid && <section className="paid-callout">
          <div><span>Leitura de CAC</span><strong>{paid.spend == null ? "Meta sem resposta" : `${money(paid.spend)} investidos`}</strong><p>{paid.allocation}</p></div>
          <div><span>CPL Meta observado</span><strong>{paid.leadCpl == null ? "—" : money(paid.leadCpl)}</strong><small>{paid.leads == null ? "Sem resultado retornado" : `${integer(paid.leads)} resultados da plataforma · nao leads CRM`}</small></div>
          <div><span>Receita vitalicia da coorte paga</span><strong>{money(paid.lifetimeRevenue)}</strong><small>Ate {date(data.coverage.to)}</small></div>
        </section>}

        <section className="chart-grid">
          <article className="econ-panel">
            <header><div><span>Retencao por mes</span><h2>Observados, primeiras aparicoes e retornos</h2></div><small>Observado = apareceu no relatorio acumulado do mes; nao significa vinculado agora</small></header>
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 320 }}><ComposedChart data={chartData} margin={{ top: 18, right: 16, left: -8, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#5E6678" tick={{ fontSize: 11 }} /><YAxis stroke="#5E6678" tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} /><Bar dataKey="enteredCreators" name="Primeira aparicao" fill="#9B8CFF" radius={[5, 5, 0, 0]} /><Line dataKey="activeCreators" name="Observados no mes" stroke="#44D7B6" strokeWidth={3} dot={{ r: 3 }} /><Line dataKey="matchedForms" name="Com formulario" stroke="#5A8CFF" strokeWidth={2} strokeDasharray="5 4" dot={false} /><Bar dataKey="returnedCreators" name="Voltaram" fill="#FFB84B" radius={[5, 5, 0, 0]} /></ComposedChart></ResponsiveContainer></div>
          </article>
          <article className="econ-panel">
            <header><div><span>LTV observado</span><h2>GMV vira receita Amplify</h2></div><small>Receita = 10% da comissao estimada</small></header>
            <div className="chart-box"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 320 }}><ComposedChart data={chartData} margin={{ top: 18, right: 16, left: 5, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#47D7A0" stopOpacity=".35" /><stop offset="100%" stopColor="#47D7A0" stopOpacity=".02" /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#5E6678" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compactMoney} stroke="#5E6678" tick={{ fontSize: 10 }} width={72} /><Tooltip content={<ChartTooltip moneyKeys={["gmv", "estimatedAmplifyRevenue"]} />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} /><Bar dataKey="gmv" name="GMV" fill="#3157FF" opacity={.55} radius={[5, 5, 0, 0]} /><Area dataKey="estimatedAmplifyRevenue" name="Receita Amplify" stroke="#47D7A0" strokeWidth={3} fill="url(#revenueFill)" /></ComposedChart></ResponsiveContainer></div>
          </article>
        </section>

        <section className="econ-panel source-panel">
          <header><div><span>Canal de origem</span><h2>Quem trouxe LTV, nao apenas lead</h2></div><small>Super Afiliado separado do Indique e Ganhe pela UTM cadastrada</small></header>
          <div className="source-table-wrap"><table className="source-table"><thead><tr><th>Origem</th><th>Creators observados</th><th>First-touch no periodo</th><th>Com formulario</th><th>GMV</th><th>Receita Amplify</th><th>LTV medio observado</th></tr></thead><tbody>{data.sourceBreakdown.map((row) => <tr key={row.key}><td><button onClick={() => { setSource(row.key); setPage(1) }}>{row.label}</button></td><td>{integer(row.creators)}</td><td>{integer(row.acquired)}</td><td>{percent(row.formMatchRate)}</td><td>{money(row.gmv)}</td><td><strong>{money(row.estimatedAmplifyRevenue)}</strong></td><td>{money(row.avgObservedLtv)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="econ-panel source-panel">
          <header><div><span>Base de aquisicao</span><h2>Nova IA versus operacao antiga</h2></div><small>AmplifyOS inclui apenas entradas nativas; imports legados foram excluidos</small></header>
          <div className="source-table-wrap"><table className="source-table"><thead><tr><th>Sistema first-touch</th><th>Creators observados</th><th>First-touch no periodo</th><th>Com formulario</th><th>GMV</th><th>Receita Amplify</th><th>LTV medio observado</th></tr></thead><tbody>{data.systemBreakdown.map((row) => <tr key={row.key}><td><span className="origin-tag">{row.label}</span></td><td>{integer(row.creators)}</td><td>{integer(row.acquired)}</td><td>{percent(row.formMatchRate)}</td><td>{money(row.gmv)}</td><td><strong>{money(row.estimatedAmplifyRevenue)}</strong></td><td>{money(row.avgObservedLtv)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="econ-panel creator-panel">
          <header className="creator-head"><div><span>Raio-X por creator</span><h2>Do @ ao retorno financeiro</h2></div><div className="creator-tools"><div className="search"><span>@</span><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Buscar creator ou alias" /></div><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="revenue">Receita no periodo</option><option value="lifetime">LTV observado</option><option value="gmv">GMV no periodo</option><option value="days">Dias vinculados</option><option value="ltvCac">LTV / CAC</option><option value="handle">@ alfabetico</option></select></div></header>
          <div className="source-pills"><button className={source === "all" ? "active" : ""} onClick={() => { setSource("all"); setPage(1) }}>Todas as origens</button>{data.sourceOptions.map((item) => <button key={item.key} className={source === item.key ? "active" : ""} onClick={() => { setSource(item.key); setPage(1) }}>{item.label}<b>{integer(item.creators)}</b></button>)}</div>
          <div className="creator-table-wrap"><table className="creator-table"><thead><tr><th>Creator</th><th>Origem</th><th>Formulario</th><th>Dias</th><th>GMV periodo</th><th>Receita periodo</th><th>LTV observado</th><th>CAC alocado</th><th>LTV/CAC</th><th /></tr></thead><tbody>{data.creators.map((creator) => <FragmentRow key={creator.id} creator={creator} expanded={expanded === creator.id} onToggle={() => setExpanded(expanded === creator.id ? "" : creator.id)} />)}{data.creators.length === 0 && <tr><td colSpan="10"><div className="creator-empty"><strong>Nenhum creator ou alias encontrado.</strong><button onClick={() => setQueryDraft("")}>Limpar busca</button></div></td></tr>}</tbody></table></div>
          <footer className="pagination"><span>{integer(data.pagination.total)} creators encontrados</span><div><button disabled={data.pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Anterior</button><b>{data.pagination.page} / {data.pagination.pages}</b><button disabled={data.pagination.page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Proxima →</button></div></footer>
        </section>

        <footer className="econ-method">
          <div><span>Agenciados por dia</span><p>{data.caveats[9]}</p></div><div><span>Receita, nao lucro</span><p>{data.caveats[1]}</p></div><div><span>Identidade</span><p>{data.methodology.identity} {data.methodology.form}</p></div><div><span>CAC</span><p>{data.caveats[2]}</p></div><div><span>Indique / Super</span><p>{data.caveats[7]}</p></div><div><span>Contagem de creators</span><p>{data.caveats[8]}</p></div><div><span>Periodo e retorno</span><p>{data.caveats[5]} {data.caveats[6]}</p></div><div><span>Atualizacao</span><p>Snapshot gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}. Janela comum fechada de {date(data.period?.from)} a {date(data.period?.to)}.</p></div>
        </footer>
      </>}
    </div>

    <style jsx global>{`
      :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#070910!important;color:#F4F6FF!important}.economics-page{min-height:100vh;background:radial-gradient(circle at 78% 4%,rgba(155,140,255,.13),transparent 28%),radial-gradient(circle at 12% 48%,rgba(49,87,255,.08),transparent 26%),#070910;font-family:Inter,system-ui,sans-serif}.econ-topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1480px)/2));border-bottom:1px solid rgba(255,255,255,.08);background:rgba(7,9,16,.86);backdrop-filter:blur(18px);position:sticky;top:0;z-index:20}.econ-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-weight:800}.econ-brand b{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3157FF 0 48%,#EA1A4E 48%);font-size:13px}.econ-brand small{color:#697185;font-family:ui-monospace,monospace;font-weight:500}.econ-back{color:#8E95A8;text-decoration:none;font-size:13px}.econ-wrap{max-width:1480px;margin:auto;padding:42px 24px 72px}.econ-hero{min-height:300px;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.45fr);gap:44px;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.econ-kicker{font:700 11px ui-monospace,monospace;letter-spacing:.17em;text-transform:uppercase;color:#A7AFC1}.econ-kicker i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#47D7A0;box-shadow:0 0 14px #47D7A0;margin-right:8px}.econ-hero h1{font-size:clamp(54px,7vw,94px);line-height:.88;letter-spacing:-.065em;margin:22px 0 24px}.econ-hero h1 em{font-style:normal;color:transparent;-webkit-text-stroke:1px rgba(244,246,255,.52)}.econ-hero p{max-width:760px;color:#969DAF;font-size:16px;line-height:1.65}.hero-formula{border:1px solid rgba(71,215,160,.3);background:linear-gradient(145deg,rgba(71,215,160,.13),rgba(14,18,28,.86));padding:28px;border-radius:20px;box-shadow:0 25px 70px rgba(0,0,0,.25)}.hero-formula>span{font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.12em;color:#74E4B8}.hero-formula>strong{display:block;font-size:76px;line-height:1;margin:16px 0 6px;letter-spacing:-.07em}.hero-formula p{font-size:13px;margin:0 0 14px;color:#C8D0DC}.hero-formula small{color:#6F788B}.econ-controls{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:18px 0}.month-control{display:flex;align-items:end;gap:10px}.month-control label{display:grid;gap:5px;color:#727B8E;font:700 9px ui-monospace;text-transform:uppercase}.month-control input,.creator-tools select{border:1px solid rgba(255,255,255,.1);background:#0E121C;color:#E8EBF3;border-radius:9px;padding:9px 11px;font:600 12px Inter}.month-control>span{padding-bottom:10px;color:#50586A}.trust-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.trust-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 10px;font:700 9px ui-monospace;text-transform:uppercase;color:#8D96A8;background:rgba(255,255,255,.025)}.trust-pill i{width:6px;height:6px;border-radius:50%}.trust-pill.ok i{background:#47D7A0;box-shadow:0 0 8px #47D7A0}.trust-pill.warn i{background:#F6B84B}.metric-grid{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid rgba(255,255,255,.09);border-radius:18px;overflow:hidden;background:#0B0E16}.econ-metric{padding:22px 18px;min-width:0;border-right:1px solid rgba(255,255,255,.07);box-shadow:inset 0 3px 0 var(--tone)}.econ-metric:last-child{border:0}.econ-metric.violet{--tone:#9B8CFF}.econ-metric.blue{--tone:#5A8CFF}.econ-metric.cyan{--tone:#39CFE2}.econ-metric.green{--tone:#47D7A0}.econ-metric.amber{--tone:#F6B84B}.econ-metric.rose{--tone:#FF6D8D}.econ-metric span,.paid-callout span{display:block;color:#7D8598;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.econ-metric strong{display:block;margin:10px 0 7px;font-size:clamp(19px,1.7vw,27px);letter-spacing:-.045em;white-space:nowrap}.econ-metric small{color:#626B7D;font-size:10px;line-height:1.4}.paid-callout{margin:14px 0 18px;display:grid;grid-template-columns:1.6fr .7fr .8fr;border:1px solid rgba(246,184,75,.18);background:rgba(246,184,75,.045);border-radius:14px;overflow:hidden}.paid-callout>div{padding:17px 20px;border-right:1px solid rgba(255,255,255,.06)}.paid-callout>div:last-child{border:0}.paid-callout strong{display:block;margin:7px 0 4px;font-size:17px}.paid-callout p,.paid-callout small{margin:0;color:#727B8D;font-size:10px;line-height:1.5}.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.econ-panel{border:1px solid rgba(255,255,255,.09);background:#0B0E16;border-radius:18px;overflow:hidden}.econ-panel>header{display:flex;justify-content:space-between;align-items:end;gap:20px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.07)}.econ-panel>header span{color:#8B94A8;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.11em}.econ-panel h2{margin:7px 0 0;font-size:23px;letter-spacing:-.035em}.econ-panel>header small{max-width:310px;color:#687185;font-size:10px;text-align:right;line-height:1.45}.chart-box{height:330px;padding:12px 9px 18px}.chart-tip{min-width:170px;padding:12px;background:#10151F;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.4)}.chart-tip>strong{display:block;margin-bottom:7px}.chart-tip>div{display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:7px;color:#8F98AA;font-size:10px;padding:3px 0}.chart-tip i{width:7px;height:7px;border-radius:2px}.chart-tip b{color:#F3F5FA}.source-panel,.creator-panel{margin-top:16px}.source-table-wrap,.creator-table-wrap{overflow:auto}.source-table,.creator-table{width:100%;border-collapse:collapse;white-space:nowrap}.source-table th,.creator-table th{text-align:right;color:#626B7E;font:700 8px ui-monospace;text-transform:uppercase;letter-spacing:.08em;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.07)}.source-table th:first-child,.source-table td:first-child,.creator-table th:first-child,.creator-table td:first-child{text-align:left}.source-table td,.creator-table td{text-align:right;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.055);font-size:11px;color:#A8B0BF}.source-table tr:hover td,.creator-table tr.creator-row:hover td{background:rgba(255,255,255,.022)}.source-table button{border:0;background:transparent;color:#F0F2F7;font-weight:750;cursor:pointer}.creator-head{align-items:center!important}.creator-tools{display:flex;gap:8px}.search{display:flex;align-items:center;border:1px solid rgba(255,255,255,.1);background:#0E121C;border-radius:9px;padding:0 10px;color:#6C7588}.search input{width:210px;border:0;outline:0;background:transparent;color:#fff;padding:10px 7px}.source-pills{display:flex;gap:7px;padding:14px 16px;overflow:auto;border-bottom:1px solid rgba(255,255,255,.07)}.source-pills button{flex:0 0 auto;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02);color:#7F889B;border-radius:999px;padding:7px 10px;font:700 9px Inter;cursor:pointer}.source-pills button.active{border-color:rgba(155,140,255,.45);background:rgba(155,140,255,.12);color:#C9C1FF}.source-pills b{margin-left:7px;color:#555F73}.creator-name{display:flex;align-items:center;gap:9px}.creator-name i{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:rgba(155,140,255,.1);color:#AA9EFF;font-style:normal;font-weight:850}.creator-name strong{color:#F2F4F8}.origin-tag,.form-tag{display:inline-flex;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 8px;color:#9DA6B6;font-size:9px}.form-tag.yes{color:#74E4B8;border-color:rgba(71,215,160,.22);background:rgba(71,215,160,.06)}.return-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#F6B84B;margin-left:5px}.expand-button{width:28px;height:28px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#8C95A8;border-radius:8px;cursor:pointer}.creator-detail-cell{padding:0!important;text-align:left!important;background:#090C13}.creator-detail{padding:18px 20px 22px}.detail-evidence{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.detail-evidence>div{min-width:0;padding:13px;border:1px solid rgba(255,255,255,.07);background:#0D111A;border-radius:10px}.detail-evidence span{display:block;color:#697286;font:700 8px ui-monospace;text-transform:uppercase}.detail-evidence strong{display:block;margin:6px 0 4px;font-size:12px}.detail-evidence small{display:block;color:#7B8497;font-size:9px;line-height:1.5;overflow-wrap:anywhere;white-space:normal}.month-tape{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px;margin-top:10px}.month-tape>div{position:relative;overflow:hidden;padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:9px}.month-tape span,.month-tape small{display:block;color:#6E7789;font-size:8px}.month-tape strong{display:block;margin:5px 0;font-size:11px}.month-tape i{position:absolute;left:0;bottom:0;height:2px;background:#47D7A0}.pagination{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;color:#70798B;font-size:10px}.pagination>div{display:flex;align-items:center;gap:12px}.pagination button{border:1px solid rgba(255,255,255,.09);background:#0E121C;color:#AEB5C2;border-radius:8px;padding:8px 10px;cursor:pointer}.pagination button:disabled{opacity:.35;cursor:not-allowed}.econ-method{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden}.econ-method>div{background:#090C13;padding:17px}.econ-method span{color:#8B94A8;font:700 8px ui-monospace;text-transform:uppercase}.econ-method p{margin:7px 0 0;color:#697286;font-size:9px;line-height:1.55}.econ-loading,.econ-error{min-height:280px;display:grid;place-items:center;align-content:center;gap:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;color:#858EA1}.econ-loading i{width:24px;height:24px;border:2px solid rgba(255,255,255,.12);border-top-color:#9B8CFF;border-radius:50%;animation:spin .8s linear infinite}.econ-error strong{color:#FF809A}@keyframes spin{to{transform:rotate(360deg)}}
      .affiliation-daily{margin:26px 0 22px;border:1px solid rgba(169,155,255,.24);border-radius:18px;background:linear-gradient(145deg,rgba(169,155,255,.09),rgba(12,15,24,.92) 34%,rgba(8,11,18,.96));overflow:hidden;position:relative;box-shadow:0 22px 55px rgba(0,0,0,.22)}.affiliation-daily:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#A99BFF,#54D8E8)}.affiliation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:24px 26px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-kicker{display:block;color:#A99BFF;font:700 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:7px}.affiliation-head h2{margin:0;color:#F7F5FF;font-size:28px;letter-spacing:-.035em}.affiliation-head p{margin:8px 0 0;color:#858DA0;font-size:12px}.ledger-status{display:flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 11px;color:#AEB5C6;font:700 10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em}.ledger-status i{width:7px;height:7px;border-radius:50%}.ledger-status.ok i{background:#47D7A0;box-shadow:0 0 12px #47D7A0}.ledger-status.warn i{background:#FFB84B}.affiliation-layout{display:grid;grid-template-columns:240px 280px minmax(0,1fr);min-height:350px}.affiliation-latest{padding:27px 25px;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;justify-content:center}.affiliation-latest>span,.affiliation-stats span{color:#7F8799;font:700 10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.affiliation-latest>strong{font-size:64px;line-height:.96;letter-spacing:-.07em;margin:16px 0 13px;color:#F8F7FF}.affiliation-latest b{font-size:17px}.affiliation-latest b.up{color:#47D7A0}.affiliation-latest b.down{color:#FF647C}.affiliation-latest small{color:#7F8799}.affiliation-latest p{margin:28px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.07);color:#8D95A8;font-size:11px;line-height:1.5}.affiliation-stats{display:grid;grid-template-columns:1fr 1fr;border-right:1px solid rgba(255,255,255,.07)}.affiliation-stats>div{padding:22px 18px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.affiliation-stats>div:nth-child(2n){border-right:0}.affiliation-stats>div:nth-child(n+3){border-bottom:0}.affiliation-stats strong{font-size:25px;letter-spacing:-.04em;margin:8px 0 3px}.affiliation-stats small{color:#656D80;font-size:10px}.affiliation-chart{height:350px;padding:12px 15px 10px 3px;min-width:0}.affiliation-daily>footer{display:flex;justify-content:space-between;gap:16px;padding:11px 26px;border-top:1px solid rgba(255,255,255,.07);color:#687185;font:600 10px ui-monospace,monospace}.affiliation-daily>footer b{color:#FFB84B;font-weight:600}
      @media(max-width:1180px){.affiliation-layout{grid-template-columns:260px 1fr}.affiliation-stats{border-right:0}.affiliation-chart{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.07)}.metric-grid{grid-template-columns:repeat(3,1fr)}.econ-metric:nth-child(3){border-right:0}.econ-metric:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.07)}.detail-evidence{grid-template-columns:1fr 1fr}.econ-method{grid-template-columns:1fr 1fr}}
      @media(max-width:820px){.affiliation-head{display:grid}.affiliation-layout{grid-template-columns:1fr}.affiliation-latest{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-stats{border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-chart{grid-column:auto}.affiliation-daily>footer{display:grid}.econ-hero{grid-template-columns:1fr;padding-bottom:30px}.hero-formula{max-width:420px}.chart-grid{grid-template-columns:1fr}.paid-callout{grid-template-columns:1fr}.paid-callout>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.econ-controls,.creator-head{align-items:flex-start!important;display:grid!important}.trust-row{justify-content:flex-start}.creator-tools{width:100%}.search{flex:1}.search input{width:100%}.detail-evidence{grid-template-columns:1fr}.econ-method{grid-template-columns:1fr}.econ-brand small{display:none}}
      .creator-empty{min-height:150px;display:grid;place-items:center;align-content:center;gap:12px;color:#969DAF}.creator-empty button{border:1px solid rgba(155,140,255,.4);background:rgba(155,140,255,.12);color:#F4F6FF;border-radius:8px;padding:8px 12px;cursor:pointer}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"]{top:11px!important;bottom:auto!important;right:max(150px,calc((100vw - 1480px)/2 + 150px))!important;width:42px;height:42px;padding:0!important;justify-content:center;font-size:0!important;opacity:.86}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"] span{font-size:14px!important}
      @media(max-width:560px){.affiliation-head{padding:20px 17px}.ledger-status{white-space:normal;width:max-content;max-width:100%}.affiliation-latest{padding:24px 19px}.affiliation-latest>strong{font-size:58px}.affiliation-stats>div{padding:18px 12px}.affiliation-chart{height:285px;padding-left:0}.affiliation-daily>footer{padding:11px 17px}.econ-wrap{padding:28px 12px 50px}.econ-topbar{padding:0 14px}.econ-back{font-size:10px}.econ-hero h1{font-size:52px}.metric-grid{grid-template-columns:1fr 1fr}.econ-metric:nth-child(3){border-right:1px solid rgba(255,255,255,.07)}.econ-metric:nth-child(2n){border-right:0}.econ-metric:nth-child(-n+4){border-bottom:1px solid rgba(255,255,255,.07)}.month-control{width:100%}.month-control label{flex:1}.month-control input{width:100%}.creator-tools{display:grid}.chart-box{height:290px}.econ-panel>header{padding:19px 16px}.econ-panel h2{font-size:20px}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"]{display:none!important}}
    `}</style>
  </main>
}

function FragmentRow({ creator, expanded, onToggle }) {
  return <>
    <tr className="creator-row">
      <td><div className="creator-name"><i>@</i><strong>{creator.handle}</strong>{creator.returnedInRange && <span className="return-dot" title="Voltou no periodo" />}</div></td>
      <td><span className="origin-tag">{creator.acquisition.label}</span></td>
      <td><span className={`form-tag ${creator.form.matched ? "yes" : ""}`}>{creator.form.matched ? "Sim" : "Nao"}</span></td>
      <td>{integer(creator.period.activeDays)}</td>
      <td>{money(creator.period.gmv)}</td>
      <td><strong>{money(creator.period.estimatedAmplifyRevenue)}</strong></td>
      <td>{money(creator.observedLtv)}</td>
      <td>{creator.allocatedCac == null ? "—" : money(creator.allocatedCac)}</td>
      <td>{ratio(creator.ltvCac)}</td>
      <td><button className="expand-button" onClick={onToggle}>{expanded ? "−" : "+"}</button></td>
    </tr>
    {expanded && <tr><td colSpan="10" className="creator-detail-cell"><CreatorDetail creator={creator} /></td></tr>}
  </>
}
