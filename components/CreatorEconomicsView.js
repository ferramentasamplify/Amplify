"use client"
/* eslint-disable react-hooks/set-state-in-effect -- loading state is reset when the request identity changes */

import { useEffect, useMemo, useState } from "react"
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ZAxis } from "recharts"
import { deriveCreatorBaseHealth } from "../lib/creator-base-health.mjs"
import { CREATOR_DASHBOARD_SECTIONS, filterDashboardRows, normalizeCreatorDashboardSection } from "../lib/creator-dashboard.mjs"

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 })
const compactMoney = (value) => new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 }).format(Number(value || 0))
const integer = (value) => Number(value || 0).toLocaleString("pt-BR")
const decimal = (value) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const percent = (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
const ratio = (value) => value == null ? "—" : Number(value) > 0 && Number(value) < 0.01 ? "<0,01x" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`
const date = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"
const monthLabel = (value) => value ? new Date(`${value}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(" de ", " ") : ""
const originLabel = (acquisition) => acquisition?.key === "unknown" ? "Meta Ads + tracking perdido" : acquisition?.label
const tierOrder = ["start", "silver", "gold", "diamond", "safira"]

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

function RetentionTooltip({ active, payload, label, moneyKeys = [], percentKeys = [] }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{monthLabel(label)}</strong>{payload.map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{moneyKeys.includes(item.dataKey) ? money(item.value) : percentKeys.includes(item.dataKey) ? percent(item.value) : integer(item.value)}</b></div>)}</div>
}

function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{integer(item.value)}</b></div>)}</div>
}

function DailyGmvTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{["dailyGmv", "gmvAverage7Days", "gmvTotal30Days"].includes(item.dataKey) ? money(item.value) : integer(item.value)}</b></div>)}</div>
}

function FlowAnalysisTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.dataKey.endsWith("Average7Days") ? Number(item.value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : signedInteger(item.value)}</b></div>)}</div>
}

function AffiliationMovementTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{integer(item.value)}</b></div>)}</div>
}

function ProfitabilityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const title = /^\d{4}-\d{2}-\d{2}$/.test(String(label)) ? date(label) : /^\d{4}-\d{2}$/.test(String(label)) ? monthLabel(label) : label
  return <div className="chart-tip"><strong>{title}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{money(item.value)}</b></div>)}</div>
}

function BaseHealthTooltip({ active, payload, label, mode = "percent" }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip"><strong>{date(label)}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{mode === "money" ? money(item.value) : percent(item.value)}</b></div>)}</div>
}

function ActivationMilestoneTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return <div className="chart-tip"><strong>{item.label}</strong><div><i style={{ background: "#54D8E8" }} /><span>Creators que ja geraram GMV</span><b>{percent(item.activationPercent)}</b></div><div><i style={{ background: "#727B8C" }} /><span>Base elegivel</span><b>{integer(item.eligibleCreators)}</b></div></div>
}

function ActivationSpeedTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return <div className="chart-tip"><strong>{item.label}</strong><div><i style={{ background: "#A99BFF" }} /><span>Tempo ate o primeiro GMV</span><b>{integer(item.days)} dias</b></div></div>
}

function CohortQualityTooltip({ active, payload, label, mode = "activation" }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return <div className="chart-tip"><strong>{monthLabel(label)}</strong><div><i style={{ background: mode === "activation" ? "#54D8E8" : "#F6B84B" }} /><span>{mode === "activation" ? "Ativaram ate D+30" : "GMV medio por creator em 30d"}</span><b>{mode === "activation" ? percent(item.activation30Percent) : money(item.averageGmv30)}</b></div><div><i style={{ background: "#727B8C" }} /><span>Creators da safra</span><b>{integer(item.matureEntrants)}</b></div>{mode === "gmv" && <div><i style={{ background: "#8B6D3B" }} /><span>GMV mediano</span><b>{money(item.medianGmv30)}</b></div>}</div>
}

function WeeklyGmvTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload.find((entry) => entry.value != null)?.payload
  if (!item) return null
  return <div className="chart-tip"><strong>{label}</strong><div><i style={{ background: item.kind === "observado" ? "#54D8E8" : "#A99BFF" }} /><span>GMV {item.kind}</span><b>{money(item.gmv)}</b></div>{item.kind === "previsto" && <div><i style={{ background: "#6E648E" }} /><span>Faixa do modelo</span><b>{compactMoney(item.lowGmv)}–{compactMoney(item.highGmv)}</b></div>}</div>
}

function MovementTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tip movement-tip"><strong>{date(label)}</strong>{payload.filter((item) => item.value != null).map((item) => <div key={item.dataKey}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.dataKey === "exitedGmvPrior30d" ? money(item.value) : integer(item.value)}</b></div>)}</div>
}

function LostGmvShareTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload.find((entry) => entry.payload)?.payload
  if (!item) return null
  return <div className="chart-tip movement-tip"><strong>{date(label)}</strong><div><i style={{ background: "#54D8E8" }} /><span>Desvinculados</span><b>{integer(item.exits)}</b></div><div><i style={{ background: "#FF647C" }} /><span>Percentual de GMV 30d perdido</span><b>{percent(item.lostGmvPercentOfRemainingBase)}</b></div><div><i style={{ background: "#A94D5E" }} /><span>GMV previo dos que sairam</span><b>{money(item.exitedGmvPrior30d)}</b></div><div><i style={{ background: "#727B8C" }} /><span>GMV previo da base remanescente</span><b>{money(item.remainingAffiliatedGmvPrior30d)}</b></div></div>
}

function signedInteger(value) {
  if (value == null) return "—"
  return `${value > 0 ? "+" : ""}${integer(value)}`
}

function CreatorDetail({ creator }) {
  return <div className="creator-detail">
    <div className="detail-evidence">
      <div><span>Origem atribuida</span><strong>{originLabel(creator.acquisition)}</strong><small>{creator.acquisition.key === "unknown" ? "Regra operacional: sem origem identificada = Meta" : creator.acquisition.evidence}{creator.acquisition.detail ? ` · ${creator.acquisition.detail}` : ""}</small></div>
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
  const [portfolioMonth, setPortfolioMonth] = useState("2026-07")
  const [tierTransitionMonth, setTierTransitionMonth] = useState("2026-07")
  const [movementWindow, setMovementWindow] = useState("30")
  const [exitChartView, setExitChartView] = useState("combined")
  const [dashboardSection, setDashboardSection] = useState("overview")
  const [focusCreatorExplorer, setFocusCreatorExplorer] = useState(false)
  const [selectedExitDate, setSelectedExitDate] = useState("")
  const [businessUnitMonth, setBusinessUnitMonth] = useState("")
  const [portfolioForecastScenario, setPortfolioForecastScenario] = useState("moving7d")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")


  useEffect(() => {
    const readSection = () => {
      const params = new URLSearchParams(window.location.search)
      setDashboardSection(normalizeCreatorDashboardSection(params.get("section")))
    }
    readSection()
    window.addEventListener("popstate", readSection)
    return () => window.removeEventListener("popstate", readSection)
  }, [])

  const selectDashboardSection = (section, { replace = false } = {}) => {
    const nextSection = normalizeCreatorDashboardSection(section)
    setDashboardSection(nextSection)
    const url = new URL(window.location.href)
    if (nextSection === "overview") url.searchParams.delete("section")
    else url.searchParams.set("section", nextSection)
    if (replace) window.history.replaceState({}, "", url)
    else window.history.pushState({}, "", url)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const openCreatorExplorer = (alias) => {
    setQueryDraft(alias || "")
    setPage(1)
    setFocusCreatorExplorer(true)
    selectDashboardSection("acquisition")
  }

  useEffect(() => {
    if (dashboardSection !== "acquisition" || !focusCreatorExplorer || !data) return undefined
    const timer = window.setTimeout(() => {
      document.querySelector(".creator-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
      setFocusCreatorExplorer(false)
    }, 50)
    return () => window.clearTimeout(timer)
  }, [dashboardSection, focusCreatorExplorer, data])

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
        const portfolioMonths = payload.portfolioAnalytics?.monthly || []
        if (portfolioMonths.length) setPortfolioMonth((current) => portfolioMonths.some((item) => item.month === current) ? current : portfolioMonths.at(-1).month)
        const exitDays = (payload.portfolioAnalytics?.daily || []).filter((item) => Number(item.exits || 0) > 0)
        if (exitDays.length) setSelectedExitDate((current) => exitDays.some((item) => item.date === current) ? current : exitDays.at(-1).date)
        const tierTransitions = payload.creatorTierAnalytics?.transitions || []
        if (tierTransitions.length) setTierTransitionMonth((current) => tierTransitions.some((item) => item.toMonth === current) ? current : tierTransitions.at(-1).toMonth)
      })
      .catch((cause) => { if (!cancelled) { setData(null); setError(cause.message) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to, source, query, sort, page])

  const chartData = useMemo(() => (data?.monthly || []).map((item) => ({ ...item, label: monthLabel(item.month) })), [data])
  const dailyData = useMemo(() => data?.affiliationDaily?.series || [], [data])
  const weekendIndexes = useMemo(() => dailyData.flatMap((item, index) => {
    const weekDay = new Date(`${item.date}T12:00:00Z`).getUTCDay()
    return weekDay === 0 || weekDay === 6 ? [index] : []
  }), [dailyData])
  const baseHealthData = useMemo(() => deriveCreatorBaseHealth(dailyData), [dailyData])
  const affiliation = data?.affiliationDaily || {}
  const portfolio = data?.portfolioAnalytics || {}
  const tierAnalytics = data?.creatorTierAnalytics || {}
  const selectedTierTransition = tierAnalytics.transitions?.find((item) => item.toMonth === tierTransitionMonth) || tierAnalytics.transitions?.at(-1) || {}
  const tierMatrixMax = Math.max(1, ...(selectedTierTransition.matrix || []).flatMap((row) => row.cells.map((cell) => cell.count)))
  const migrationFlows = (selectedTierTransition.flows || []).filter((flow) => flow.from !== flow.to).slice(0, 10)
  const latestTierMonth = tierAnalytics.monthly?.at(-1) || {}
  const latestAboveStart = ["silver", "gold", "diamond", "safira"].reduce((total, key) => total + Number(latestTierMonth[key] || 0), 0)
  const baseHealthLatest = baseHealthData.at(-1) || {}
  const lagAnalytics = data?.creatorLagAnalytics || {}
  const portfolioForecast = lagAnalytics.portfolioForecast || {}
  const portfolioForecastScenarios = portfolioForecast.scenarios || []
  const visiblePortfolioForecastScenarios = portfolioForecastScenarios.filter((item) => item.key === "moving7d" || item.key === "required")
  const selectedPortfolioForecast = portfolioForecastScenarios.find((item) => item.key === portfolioForecastScenario) || portfolioForecastScenarios.find((item) => item.key === "moving7d") || portfolioForecastScenarios[0] || {}
  const portfolioForecastSeries = portfolioForecast.series || []
  const selectedActiveKey = `${selectedPortfolioForecast.key || "moving7d"}Active`
  const selectedEntriesKey = `${selectedPortfolioForecast.key || "moving7d"}Entries`
  const selectedExitsKey = `${selectedPortfolioForecast.key || "moving7d"}Exits`
  const selectedPortfolioFlowSeries = portfolioForecastSeries.filter((item) => item[selectedEntriesKey] != null || item[selectedExitsKey] != null)
  const maturity = lagAnalytics.maturity || {}
  const maturityPoints = maturity.points || []
  const activationMilestones = [0, 7, 14, 30, 60].map((ageDays) => ({ ...(maturityPoints.find((item) => item.ageDays === ageDays) || {}), label: `D+${ageDays}` }))
  const activationSpeedData = [
    { label: "50% dos ativados", days: Number(maturity.medianDaysToFirstGmvAmongActivated30 || 0) },
    { label: "75% dos ativados", days: Number(maturity.p75DaysToFirstGmv || 0) },
    { label: "90% dos ativados", days: Number(maturity.p90DaysToFirstGmv || 0) },
  ]
  const stockDrawdown = lagAnalytics.stockDrawdown || {}
  const lagForecast = lagAnalytics.forecast || {}
  const recentCohorts = lagForecast.recentCohorts || {}
  const weeklyGmvData = useMemo(() => {
    const rows = data?.creatorLagAnalytics?.forecast?.series || []
    const observed = rows.filter((item) => item.actualGmv != null).slice(-28)
    const predicted = rows.filter((item) => item.actualGmv == null && item.forecastGmv != null).slice(0, 28)
    const groupWeeks = (values, kind) => Array.from({ length: 4 }, (_, index) => {
      const week = values.slice(index * 7, index * 7 + 7)
      if (!week.length) return null
      const sum = (key) => week.reduce((total, item) => total + Number(item[key] || 0), 0)
      return {
        period: `${date(week[0].date).slice(0, 5)}–${date(week.at(-1).date).slice(0, 5)}`,
        kind,
        gmv: sum(kind === "observado" ? "actualGmv" : "forecastGmv"),
        observedGmv: kind === "observado" ? sum("actualGmv") : null,
        forecastGmv: kind === "previsto" ? sum("forecastGmv") : null,
        lowGmv: kind === "previsto" ? sum("lowGmv") : null,
        highGmv: kind === "previsto" ? sum("highGmv") : null,
      }
    }).filter(Boolean)
    return [...groupWeeks(observed, "observado"), ...groupWeeks(predicted, "previsto")]
  }, [data])
  const matureMonthlyCohorts = (maturity.monthlyCohorts || []).filter((item) => item.complete)
  const movementData = portfolio.daily || []
  const flowAnalysisData = useMemo(() => {
    const rows = data?.portfolioAnalytics?.daily || []
    return rows.map((item, index) => {
      const window7 = rows.slice(Math.max(0, index - 6), index + 1)
      const window30 = rows.slice(Math.max(0, index - 29), index + 1)
      const entries7 = window7.filter((row) => row.firstAppearances != null).map((row) => Number(row.firstAppearances))
      const exits7 = window7.filter((row) => row.exits != null).map((row) => Number(row.exits))
      const entries30 = window30.reduce((total, row) => total + Number(row.additions || 0), 0)
      const exits30 = window30.reduce((total, row) => total + Number(row.exits || 0), 0)
      return {
        date: item.date,
        entriesAverage7Days: entries7.length ? entries7.reduce((total, value) => total + value, 0) / entries7.length : null,
        exitsAverage7Days: exits7.length ? exits7.reduce((total, value) => total + value, 0) / exits7.length : null,
        entriesTotal30Days: entries30,
        exitsTotal30Days: exits30,
        netTotal30Days: entries30 - exits30,
      }
    })
  }, [data])
  const latestFlowAnalysis = flowAnalysisData.at(-1) || {}
  const movementChartData = movementWindow === "all" ? movementData : movementData.slice(-Number(movementWindow))
  const latestMovement = movementData.at(-1) || {}
  const selectedExitDay = selectedExitDate ? movementData.find((item) => item.date === selectedExitDate) || {} : {}
  const selectedExitedCreators = [...(selectedExitDay.exitedCreators || [])].sort((left, right) => Number(right.gmvPrior30d || 0) - Number(left.gmvPrior30d || 0) || String(left.authorId).localeCompare(String(right.authorId)))
  const visibleExitEvents = movementChartData.reduce((total, item) => total + Number(item.exits || 0), 0)
  const visibleExitGmvPrior30d = movementChartData.reduce((total, item) => total + Number(item.exitedGmvPrior30d || 0), 0)
  const exitRankingByEvents = [...movementChartData].filter((item) => Number(item.exits || 0) > 0).sort((left, right) => Number(right.exits || 0) - Number(left.exits || 0) || String(right.date).localeCompare(String(left.date))).slice(0, 10)
  const exitRankingByGmv = [...movementChartData].filter((item) => Number(item.exitedGmvPrior30d || 0) > 0).sort((left, right) => Number(right.exitedGmvPrior30d || 0) - Number(left.exitedGmvPrior30d || 0) || String(right.date).localeCompare(String(left.date))).slice(0, 10)
  const setExitWindow = (window) => {
    setMovementWindow(window)
    const rows = window === "all" ? movementData : movementData.slice(-Number(window))
    setSelectedExitDate(rows.filter((item) => Number(item.exits || 0) > 0).at(-1)?.date || "")
  }
  const selectedReturnsTotal = movementChartData.reduce((total, item) => total + Number(item.returns || 0), 0)
  const selectedReturnsDailyAverage = movementChartData.length ? selectedReturnsTotal / movementChartData.length : 0
  const selectedPortfolioMonth = portfolio.monthly?.find((item) => item.month === portfolioMonth) || portfolio.monthly?.at(-1) || {}
  const summary = data?.summary || {}
  const paid = data?.paidEconomics || {}
  const profitability = data?.profitability || {}
  const profitSummary = profitability.summary || {}
  const originProfitability = profitability.byOrigin || []
  const retention = data?.retentionAnalytics || {}
  const creatorBusinessUnit = data?.creatorBusinessUnit || {}
  const businessUnitActuals = creatorBusinessUnit.actuals || {}
  const businessUnitMonths = businessUnitActuals.monthly || []
  const businessUnitInventory = businessUnitActuals.inventory || {}
  const consideredInventory = businessUnitActuals.consideredInventory || {}
  const selectedBusinessUnitMonth = businessUnitMonths.find((item) => item.month === businessUnitMonth) || businessUnitMonths.at(-1) || {}
  const q3PlanMonths = creatorBusinessUnit.plan?.months || []
  const showPaid = source === "all" || source === "paid-meta"
  const activeSourceLabel = data?.sourceOptions?.find((item) => item.key === source)?.label || source
  const overviewTableRows = filterDashboardRows(chartData, { from, to })
  const baseTableRows = filterDashboardRows(dailyData, { from, to })
  const activationTableRows = filterDashboardRows(matureMonthlyCohorts.map((item) => ({ ...item, month: item.entryMonth || item.month })), { from, to })
  const retentionTableRows = filterDashboardRows(retention.monthly || [], { from, to })
  const financeTableRows = filterDashboardRows(businessUnitMonths, { from, to })

  return <main className="economics-page">
    <nav className="econ-topbar">
      <a href="/hub" className="econ-brand"><b>A</b><span>Amplify UGC</span><small>/ business unit creators</small></a>
      <a href="/hub" className="econ-back">← Hub de Dashboards</a>
    </nav>

    <div className="econ-wrap">
      <header className="econ-hero">
        <div>
          <span className="econ-kicker"><i /> Unit economics conectado</span>
          <h1>Business Unit Creators</h1>
          <p>Dashboard oficial para operar base, ativacao, movimentacao, retencao, GMV, aquisicao e resultado financeiro da BU.</p>
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
          <TrustPill ok={Boolean(affiliation.range?.days)}>GMV diario canonico · {integer(affiliation.range?.days)} dias</TrustPill>
          <TrustPill ok>AmplifyOS nativo · {integer(data?.sources?.amplifyos?.uniqueHandles || 0)} @</TrustPill>
          <TrustPill ok>Join exato por @</TrustPill>
          <TrustPill ok>Desconhecida incluida em Meta</TrustPill>
          {source !== "all" && <button type="button" className="global-filter-chip" onClick={() => { setSource("all"); setPage(1) }} aria-label={`Limpar filtro de origem ${activeSourceLabel}`}>Origem ativa: {activeSourceLabel} ×</button>}
        </div>
      </section>

      <nav className="creator-dashboard-nav" aria-label="Secoes do dashboard Creator BU">
        {CREATOR_DASHBOARD_SECTIONS.map((section) => <button key={section.id} type="button" className={dashboardSection === section.id ? "active" : ""} aria-current={dashboardSection === section.id ? "page" : undefined} onClick={() => selectDashboardSection(section.id)}><span>{section.label}</span><small>{section.tableLabel}</small></button>)}
      </nav>

      {error && <div className="econ-error"><strong>O painel nao carregou.</strong><span>{error}</span></div>}
      {loading && !data ? <div className="econ-loading"><i /><span>Cruzando aquisicao, formularios e retencao…</span></div> : data && <>
        {dashboardSection === "base" && <div className="dashboard-surface" data-dashboard-section="base">
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
                  <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
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

        <section className="affiliation-gmv-copy">
          <header className="affiliation-gmv-head">
            <div><span className="affiliation-kicker">Leitura combinada</span><h2>Agenciados + GMV diario</h2><p>O mesmo grafico do ledger, agora com o volume financeiro de cada dia em um eixo proprio.</p></div>
            <div className="daily-gmv-latest"><span>GMV no ultimo dia fechado</span><strong>{compactMoney(affiliation.latest?.dailyGmv)}</strong><small>{money(affiliation.latest?.dailyGmv)} · {date(affiliation.latest?.date)}</small></div>
          </header>
          <div className="affiliation-gmv-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={dailyData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationGmvFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="dailyGmv" orientation="right" stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<DailyGmvTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationGmvFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="affiliated" type="monotone" dataKey="gmvCreators" name="Com GMV no dia" stroke="#54D8E8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="dailyGmv" type="monotone" dataKey="dailyGmv" name="GMV diario" stroke="#F6B84B" strokeWidth={2.6} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span>GMV diario = soma de <b>sum_cl_pay_amt</b> no relatorio Criador fechado de cada data.</span><em>Eixo financeiro em R$ separado das contagens.</em></footer>
        </section>

        <section className="affiliation-gmv-copy affiliation-gmv-month-copy">
          <header className="affiliation-gmv-head">
            <div><span className="affiliation-kicker">Leitura mensal acumulada</span><h2>Agenciados + creators com GMV no mes</h2><p>Creators unicos que ja tiveram algum GMV no mes ate cada data, sem usar informacao de dias futuros.</p></div>
            <div className="daily-gmv-latest"><span>Com GMV no mes ate {date(affiliation.latest?.date)}</span><strong>{integer(affiliation.latest?.gmvCreatorsMonthToDate)}</strong><small>creators unicos · acumulado MTD</small></div>
          </header>
          <div className="affiliation-gmv-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={dailyData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationGmvMonthFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="dailyGmv" orientation="right" stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<DailyGmvTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationGmvMonthFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="affiliated" type="monotone" dataKey="gmvCreatorsMonthToDate" name="Com GMV no mes" stroke="#54D8E8" strokeWidth={2.2} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="dailyGmv" type="monotone" dataKey="dailyGmv" name="GMV diario" stroke="#F6B84B" strokeWidth={2.6} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Com GMV no mes</b> = creators unicos com algum GMV desde o primeiro dia do mes ate a data; a contagem reinicia a cada mes.</span><em>Eixo financeiro em R$ separado das contagens.</em></footer>
        </section>

        <section className="affiliation-gmv-copy affiliation-gmv-rolling-copy">
          <header className="affiliation-gmv-head">
            <div><span className="affiliation-kicker">Janela movel de monetizacao</span><h2>Agenciados + creators com GMV nos ultimos 30 dias</h2><p>Creators vinculados no dia que tiveram algum GMV na data ou nos 29 dias anteriores, sem reiniciar no inicio do mes.</p></div>
            <div className="daily-gmv-latest"><span>Com GMV nos 30 dias ate {date(affiliation.latest?.date)}</span><strong>{integer(affiliation.latest?.gmvCreatorsLast30Days)}</strong><small>creators unicos · janela movel</small></div>
          </header>
          <div className="affiliation-gmv-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={dailyData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationGmvRollingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="dailyGmv" orientation="right" stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<DailyGmvTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationGmvRollingFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="affiliated" type="monotone" dataKey="gmvCreatorsLast30Days" name="Com GMV nos ultimos 30 dias" stroke="#54D8E8" strokeWidth={2.2} dot={false} />
                <Line yAxisId="dailyGmv" type="monotone" dataKey="dailyGmv" name="GMV diario" stroke="#F6B84B" strokeWidth={2.6} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Com GMV nos ultimos 30 dias</b> = creators vinculados no dia com algum GMV na data ou nos 29 dias anteriores. Quem vendeu na janela, mas foi desvinculado, nao conta: so conta quem continua vinculado na data analisada.</span><em>Nos primeiros 29 dias do historico, usa somente os dias disponiveis. Eixo financeiro em R$ separado das contagens.</em></footer>
        </section>

        <section className="affiliation-gmv-copy affiliation-gmv-average7-copy">
          <header className="affiliation-gmv-head">
            <div><span className="affiliation-kicker">Fases de GMV · media movel</span><h2>Creators com GMV 30d + GMV medio dos ultimos 7 dias</h2><p>A mesma leitura de carteira, com o ruido diario suavizado para destacar semanas e mudancas persistentes de nivel.</p></div>
            <div className="daily-gmv-latest"><span>GMV medio 7d ate {date(affiliation.latest?.date)}</span><strong>{money(affiliation.latest?.gmvAverage7Days)}</strong><small>media diaria · data + 6 dias anteriores</small></div>
          </header>
          <div className="affiliation-gmv-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={dailyData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationGmvAverage7Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="gmvAverage7" orientation="right" stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<DailyGmvTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationGmvAverage7Fill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="affiliated" type="monotone" dataKey="gmvCreatorsLast30Days" name="Com GMV nos ultimos 30 dias" stroke="#54D8E8" strokeWidth={2.2} dot={false} />
                <Line yAxisId="gmvAverage7" type="monotone" dataKey="gmvAverage7Days" name="GMV medio dos ultimos 7 dias" stroke="#F6B84B" strokeWidth={2.8} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>GMV medio 7d</b> = media do GMV diario da data e dos 6 dias anteriores.</span><em>Mostra fases fortes sem deixar um unico pico dominar a leitura.</em></footer>
        </section>

        <section className="affiliation-gmv-copy affiliation-gmv-total30-copy">
          <header className="affiliation-gmv-head">
            <div><span className="affiliation-kicker">Volume economico · janela movel</span><h2>Creators com GMV 30d + GMV acumulado nos ultimos 30 dias</h2><p>Creators e volume financeiro na mesma janela movel, para comparar expansao da base monetizada com crescimento de GMV.</p></div>
            <div className="daily-gmv-latest"><span>GMV acumulado 30d ate {date(affiliation.latest?.date)}</span><strong>{money(affiliation.latest?.gmvTotal30Days)}</strong><small>total movel · data + 29 dias anteriores</small></div>
          </header>
          <div className="affiliation-gmv-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={dailyData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationGmvTotal30Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, dailyData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="affiliated" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="gmvTotal30" orientation="right" stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<DailyGmvTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="affiliated" type="monotone" dataKey="affiliatedCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationGmvTotal30Fill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="affiliated" type="monotone" dataKey="gmvCreatorsLast30Days" name="Com GMV nos ultimos 30 dias" stroke="#54D8E8" strokeWidth={2.2} dot={false} />
                <Line yAxisId="gmvTotal30" type="monotone" dataKey="gmvTotal30Days" name="GMV acumulado nos ultimos 30 dias" stroke="#F6B84B" strokeWidth={2.8} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>GMV acumulado 30d</b> = soma do GMV diario da data e dos 29 dias anteriores.</span><em>Usa a mesma janela da serie de creators com GMV.</em></footer>
        </section>

        <section id="creator-base-health" className="creator-base-health">
          <header className="base-health-head">
            <div><span className="affiliation-kicker">Saude da base · janela movel de 30 dias</span><h2>Produtividade, cobertura e concentracao do GMV</h2><p>Cada grafico responde uma pergunta com numerador e denominador proprios, sempre usando a mesma janela movel de 30 dias.</p></div>
            <div className="base-health-latest">
              <div><span>GMV por monetizado 30d</span><strong>{money(baseHealthLatest.gmvPerMonetizedCreator30Days)}</strong><small>{integer(baseHealthLatest.gmvCreatorsLast30Days)} creators com GMV</small></div>
              <div><span>Base que gera 80%</span><strong>{percent(baseHealthLatest.gmv80CreatorShareActivePercent30Days)}</strong><small>{integer(baseHealthLatest.gmv80CreatorCount30Days)} creators</small></div>
              <div><span>Cobertura com GMV 30d</span><strong>{percent(baseHealthLatest.monetizedCoverage30DaysPercent)}</strong><small>sobre {integer(baseHealthLatest.affiliatedCreators)} agenciados</small></div>
              <div><span>Monetizados que geram 80%</span><strong>{percent(baseHealthLatest.gmv80CreatorShareMonetizedPercent30Days)}</strong><small>concentracao dentro da base produtiva</small></div>
            </div>
          </header>

          <div className="base-health-grid">
            <article className="base-health-card base-health-productivity">
              <header><div><span>Produtividade economica</span><h3>GMV medio por agenciado com GMV nos ultimos 30 dias</h3></div><strong>{money(baseHealthLatest.gmvPerMonetizedCreator30Days)}</strong></header>
              <p>GMV acumulado da janela dividido somente pelos creators unicos que tiveram algum GMV na mesma janela.</p>
              <div className="base-health-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 610, height: 300 }}><ComposedChart data={baseHealthData} margin={{ top: 15, right: 8, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><CartesianGrid horizontal={false} stroke="rgba(173,181,197,.15)" strokeWidth={0.7} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, baseHealthData.length - 1))} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={28} /><YAxis stroke="#A5783A" tickFormatter={compactMoney} tick={{ fontSize: 9 }} width={62} domain={["dataMin - 300", "dataMax + 300"]} /><Tooltip content={<BaseHealthTooltip mode="money" />} /><Line type="monotone" dataKey="gmvPerMonetizedCreator30Days" name="GMV medio por monetizado 30d" stroke="#F6B84B" strokeWidth={3} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
              <footer>Quanto maior, maior o GMV medio gerado por creator que efetivamente monetizou.</footer>
            </article>

            <article className="base-health-card base-health-active-concentration">
              <header><div><span>Dependencia economica</span><h3>Percentual da base ativa que gera 80% do GMV</h3></div><strong>{percent(baseHealthLatest.gmv80CreatorShareActivePercent30Days)}</strong></header>
              <p>Menor grupo necessario para atingir 80% do GMV movel, dividido por todos os agenciados observados no dia.</p>
              <div className="base-health-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 610, height: 300 }}><ComposedChart data={baseHealthData} margin={{ top: 15, right: 8, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><CartesianGrid horizontal={false} stroke="rgba(173,181,197,.15)" strokeWidth={0.7} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, baseHealthData.length - 1))} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={28} /><YAxis stroke="#C68C58" tickFormatter={percent} tick={{ fontSize: 9 }} width={48} domain={[0, "dataMax + 1"]} /><Tooltip content={<BaseHealthTooltip />} /><Line type="monotone" dataKey="gmv80CreatorShareActivePercent30Days" name="% da base que gera 80% do GMV" stroke="#FF9B68" strokeWidth={3} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
              <footer>Quanto menor, maior a dependencia de poucos creators para sustentar o GMV.</footer>
            </article>

            <article className="base-health-card base-health-coverage">
              <header><div><span>Amplitude da monetizacao</span><h3>Percentual da base com GMV nos ultimos 30 dias</h3></div><strong>{percent(baseHealthLatest.monetizedCoverage30DaysPercent)}</strong></header>
              <p>Creators unicos com algum GMV em D-29 a D divididos pelo total de agenciados observados na data.</p>
              <div className="base-health-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 610, height: 300 }}><ComposedChart data={baseHealthData} margin={{ top: 15, right: 8, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><CartesianGrid horizontal={false} stroke="rgba(173,181,197,.15)" strokeWidth={0.7} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, baseHealthData.length - 1))} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={28} /><YAxis stroke="#3D7B82" tickFormatter={percent} tick={{ fontSize: 9 }} width={48} domain={[(value) => Math.max(0, Math.floor(value - 5)), (value) => Math.min(100, Math.ceil(value + 5))]} /><Tooltip content={<BaseHealthTooltip />} /><Line type="monotone" dataKey="monetizedCoverage30DaysPercent" name="% da base com GMV 30d" stroke="#54D8E8" strokeWidth={3} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
              <footer>Quanto maior, mais ampla e menos ociosa esta a monetizacao da carteira.</footer>
            </article>

            <article className="base-health-card base-health-monetized-concentration">
              <header><div><span>Concentracao entre produtivos</span><h3>Percentual dos monetizados que gera 80% do GMV</h3></div><strong>{percent(baseHealthLatest.gmv80CreatorShareMonetizedPercent30Days)}</strong></header>
              <p>Creators do grupo dos 80% divididos apenas pelos creators que tiveram algum GMV nos mesmos 30 dias.</p>
              <div className="base-health-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 610, height: 300 }}><ComposedChart data={baseHealthData} margin={{ top: 15, right: 8, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><CartesianGrid horizontal={false} stroke="rgba(173,181,197,.15)" strokeWidth={0.7} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, baseHealthData.length - 1))} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={28} /><YAxis stroke="#7568A8" tickFormatter={percent} tick={{ fontSize: 9 }} width={48} domain={[0, "dataMax + 2"]} /><Tooltip content={<BaseHealthTooltip />} /><Line type="monotone" dataKey="gmv80CreatorShareMonetizedPercent30Days" name="% dos monetizados que gera 80%" stroke="#A99BFF" strokeWidth={3} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
              <footer>Se cair, o resultado esta ficando mais concentrado mesmo dentro do grupo que monetiza.</footer>
            </article>
          </div>

          <footer className="base-health-method"><span><b>Mesma janela:</b> todos os numeradores e denominadores economicos usam D-29 a D.</span><span><b>Base ativa:</b> agenciados observados no ledger na data.</span><em>Nos primeiros 29 dias do historico, a janela usa somente os dias disponiveis.</em></footer>
        </section>

        {portfolioForecastSeries.length > 0 && <section id="portfolio-projection" className="portfolio-projection-section">
          <header className="portfolio-projection-head">
            <div><span className="portfolio-projection-kicker">Media movel 7d + saida proporcional</span><h2>Com o ritmo atual, chegamos a 4.000 creators ativos?</h2><p>Mantem a media de entradas dos ultimos 7 dias e aplica a taxa recente de desvinculacao sobre o estoque projetado de cada dia.</p></div>
            <div className="portfolio-backtest-pill"><span>Resposta ate 30/09</span><strong>{selectedPortfolioForecast.reachesTarget ? "SIM" : "NAO"}</strong><small>{selectedPortfolioForecast.reachesTarget ? "o ritmo atual atinge a meta" : `projecao de ${integer(selectedPortfolioForecast.projectedEndActive)} creators`}</small></div>
          </header>

          <div className="portfolio-projection-summary">
            <div><span>Estoque auditado em {date(portfolioForecast.asOf)}</span><strong>{integer(portfolioForecast.currentActive)}</strong><small>creators observados no ledger</small></div>
            <div><span>Projecao proporcional em 30/09</span><strong>{integer(selectedPortfolioForecast.projectedEndActive)}</strong><small>{selectedPortfolioForecast.gapToTarget >= 0 ? `${integer(selectedPortfolioForecast.gapToTarget)} acima da meta` : `faltam ${integer(Math.abs(selectedPortfolioForecast.gapToTarget || 0))}`}</small></div>
            <div><span>Saldo liquido inicial</span><strong>{portfolioForecast.movingAverage7d?.netPerDay >= 0 ? "+" : ""}{decimal(portfolioForecast.movingAverage7d?.netPerDay)}/dia</strong><small>{decimal(portfolioForecast.movingAverage7d?.entriesPerDay)} entradas - {decimal(portfolioForecast.movingAverage7d?.initialExitsPerDay)} saidas no inicio</small></div>
            <div><span>Data estimada para 4.000</span><strong>{date(portfolioForecast.movingAverage7d?.estimatedTargetDate)}</strong><small>{portfolioForecast.movingAverage7d?.daysToTarget == null ? "ritmo atual nao sustenta a meta" : `${integer(portfolioForecast.movingAverage7d?.daysToTarget)} dias, com saida proporcional`}</small></div>
          </div>

          <div className="portfolio-scenario-switch" role="group" aria-label="Cenarios da projecao de carteira">
            {visiblePortfolioForecastScenarios.map((scenario) => <button key={scenario.key} type="button" className={selectedPortfolioForecast.key === scenario.key ? "active" : ""} onClick={() => setPortfolioForecastScenario(scenario.key)}><span>{scenario.label}</span><b>{integer(scenario.projectedEndActive)}</b></button>)}
          </div>

          <div className="portfolio-projection-grid">
            <article className="portfolio-projection-card portfolio-stock-card">
              <header><div><span>Estoque observado + projetado</span><h3>Tendencia diaria de creators ativos</h3></div><small>Um unico eixo Y · contagem de creators</small></header>
              <div className="portfolio-stock-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1260, height: 410 }}><ComposedChart data={portfolioForecastSeries} margin={{ top: 18, right: 12, left: 2, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#596273" tick={{ fontSize: 10 }} minTickGap={30} /><YAxis allowDecimals={false} stroke="#687386" tick={{ fontSize: 10 }} width={58} domain={["dataMin - 100", "dataMax + 100"]} /><Tooltip content={<AffiliationMovementTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} /><Line type="monotone" dataKey="actualActive" name="Ativos observados" stroke="#E8ECF5" strokeWidth={2.8} dot={false} connectNulls={false} /><Line type="monotone" dataKey={selectedActiveKey} name={selectedPortfolioForecast.label || "Cenario selecionado"} stroke="#A99BFF" strokeWidth={3} dot={false} connectNulls={false} />{selectedPortfolioForecast.key !== "required" && <Line type="monotone" dataKey="requiredActive" name="Ritmo necessario" stroke="#47D7A0" strokeWidth={2.2} strokeDasharray="7 5" dot={false} connectNulls={false} />}<Line type="linear" dataKey="targetActive" name="Meta 4.000" stroke="#F6B84B" strokeWidth={1.7} strokeDasharray="3 5" dot={false} /></ComposedChart></ResponsiveContainer></div>
            </article>

            <article className="portfolio-projection-card">
              <header><div><span>Motor do estoque</span><h3>Entradas e desvinculacoes projetadas</h3></div><small>Mesmo eixo Y · {selectedPortfolioForecast.label}</small></header>
              <div className="portfolio-flow-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 350 }}><ComposedChart data={selectedPortfolioFlowSeries} margin={{ top: 18, right: 10, left: 0, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#596273" tick={{ fontSize: 10 }} minTickGap={28} /><YAxis allowDecimals={false} stroke="#687386" tick={{ fontSize: 10 }} width={46} domain={[0, "dataMax + 5"]} /><Tooltip content={<AffiliationMovementTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} /><Line type="monotone" dataKey={selectedEntriesKey} name="Entradas projetadas" stroke="#47D7A0" strokeWidth={2.7} dot={false} connectNulls={false} /><Line type="monotone" dataKey={selectedExitsKey} name="Desvinculacoes esperadas" stroke="#FF647C" strokeWidth={2.7} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
            </article>

            <article className="portfolio-projection-card portfolio-assumption-card">
              <header><div><span>Premissas do cenario</span><h3>{selectedPortfolioForecast.label}</h3></div><small>Atualizado com o ledger fechado</small></header>
              <div className="portfolio-assumption-grid">
                <div><span>Entradas · media 7d</span><strong>{decimal(selectedPortfolioForecast.entriesPerDay)}/dia</strong></div>
                <div><span>Taxa de saida · 7d</span><strong>{percent(selectedPortfolioForecast.exitRateDailyPercent)}/dia</strong></div>
                <div><span>Saidas · inicio → 30/09</span><strong>{decimal(selectedPortfolioForecast.initialExitsPerDay)} → {decimal(selectedPortfolioForecast.finalExitsPerDay)}/dia</strong></div>
                <div><span>Entradas necessarias</span><strong>{decimal(portfolioForecast.movingAverage7d?.requiredEntriesPerDay)}/dia</strong></div>
              </div>
              <p>{selectedPortfolioForecast.note}</p>
            </article>
          </div>

          <div className="portfolio-growth-strip">
            <div><span>Meta Q3 de novos</span><strong>{integer(portfolioForecast.q3NewCreatorTarget)}</strong><small>{integer(portfolioForecast.q3NewObservedLedger)} primeiras aparicoes observadas em julho</small></div>
            <div><span>Meta de leads creator</span><strong>{integer(portfolioForecast.creatorLeadTarget)}</strong><small>{integer(portfolioForecast.creatorLeadsCurrent)} registrados ate agora</small></div>
            <div><span>Budget creator Q3</span><strong>{money(portfolioForecast.creatorBudgetQ3)}</strong><small>ultimos 7d: {money(portfolioForecast.last7CreatorSpend)} · CPL {money(portfolioForecast.last7CreatorCpl)}</small></div>
            <div><span>Conversao necessaria restante</span><strong>{percent(portfolioForecast.requiredRemainingBusinessConversionPercent)}</strong><small>atual acumulada: {percent(portfolioForecast.businessConversionCurrentPercent)}</small></div>
          </div>

          <footer className="portfolio-projection-note"><b>Formula:</b> ativos de amanha = ativos de hoje + media 7d de entradas - (ativos de hoje × taxa diaria de saida 7d). <em>{portfolioForecast.caveat} Retornos nao entram porque o grafico de referencia usa somente primeiras aparicoes.</em></footer>
        </section>}

        <section className="dashboard-table-card" data-dashboard-table="base">
          <header><div><span>Detalhamento reativo</span><h2>Historico diario da base</h2></div><small>{integer(baseTableRows.length)} dias nos filtros globais</small></header>
          <div className="dashboard-table-scroll"><table><thead><tr><th>Data</th><th>Agenciados</th><th>Com GMV no dia</th><th>Com GMV 30d</th><th>GMV diario</th><th>GMV medio 7d</th><th>GMV acumulado 30d</th></tr></thead><tbody>{baseTableRows.slice().reverse().map((row) => <tr key={row.date}><td>{date(row.date)}</td><td>{integer(row.affiliatedCreators)}</td><td>{integer(row.gmvCreators)}</td><td>{integer(row.gmvCreatorsLast30Days)}</td><td>{money(row.dailyGmv)}</td><td>{money(row.gmvAverage7Days)}</td><td><strong>{money(row.gmvTotal30Days)}</strong></td></tr>)}{baseTableRows.length === 0 && <tr><td colSpan="7"><div className="dashboard-table-empty">Nenhum resultado para os filtros ativos.</div></td></tr>}</tbody></table></div>
        </section>
        </div>}

        {dashboardSection === "activation" && <div className="dashboard-surface" data-dashboard-section="activation">
        {lagAnalytics.schemaVersion === 1 && <section id="lag-forecast" className="lag-forecast-section lag-simple-section">
          <header className="lag-simple-head">
            <div><span className="lag-kicker">Do agenciamento ao GMV</span><h2>O que acontece depois que um creator entra?</h2><p>Leitura direta de ativacao, velocidade, qualidade das safras e GMV esperado. Sem correlacoes tecnicas ou curvas com duas escalas.</p></div>
            <div className="lag-thesis"><span>Principal gargalo</span><strong>{integer(Math.round(100 - Number(maturity.activation30Percent || 0)))} de cada 100</strong><small>ainda nao geraram GMV ate D+30</small></div>
          </header>

          <div className="lag-simple-grid">
            <article className="lag-simple-card activation-card">
              <header><div><span>Conversao acumulada</span><h3>De cada 100 novos, quantos ja geraram GMV?</h3></div><small>{integer(maturity.cohortCreators)} creators analisados</small></header>
              <div className="lag-simple-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 340 }}><ComposedChart data={activationMilestones} margin={{ top: 18, right: 12, left: -6, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="label" stroke="#667083" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="#5E7880" tick={{ fontSize: 10 }} width={48} /><Tooltip content={<ActivationMilestoneTooltip />} /><Bar dataKey="activationPercent" name="Creators com GMV" fill="#54D8E8" radius={[7, 7, 0, 0]} maxBarSize={58} /></ComposedChart></ResponsiveContainer></div>
              <footer><b>{percent(maturity.activation30Percent)}</b> ativam ate D+30; <em>{percent(100 - Number(maturity.activation30Percent || 0))} permanecem sem GMV.</em></footer>
            </article>

            <article className="lag-simple-card speed-card">
              <header><div><span>Velocidade de ativacao</span><h3>Em quantos dias acontece o primeiro GMV?</h3></div><small>entre os que ativam ate D+30</small></header>
              <div className="lag-simple-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 560, height: 340 }}><ComposedChart layout="vertical" data={activationSpeedData} margin={{ top: 22, right: 28, left: 18, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} /><XAxis type="number" domain={[0, "dataMax + 3"]} tickFormatter={(value) => `${value}d`} stroke="#716A8D" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={118} stroke="#6D7688" tick={{ fontSize: 10 }} /><Tooltip content={<ActivationSpeedTooltip />} /><Bar dataKey="days" name="Dias ate o primeiro GMV" fill="#A99BFF" radius={[0, 7, 7, 0]} maxBarSize={34} /></ComposedChart></ResponsiveContainer></div>
              <footer>A mediana e <b>D+{integer(maturity.medianDaysToFirstGmvAmongActivated30)}</b>; 90% dos que ativam fazem o primeiro GMV ate <em>D+{integer(maturity.p90DaysToFirstGmv)}</em>.</footer>
            </article>
          </div>

          <div className="lag-cohort-grid">
            <article className="lag-simple-card">
              <header><div><span>Qualidade por mes de entrada</span><h3>Percentual da safra que ativa ate D+30</h3></div><small>somente safras com 30 dias completos</small></header>
              <div className="lag-cohort-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 650, height: 330 }}><ComposedChart data={matureMonthlyCohorts} margin={{ top: 18, right: 12, left: -4, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#667083" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="#5E7880" tick={{ fontSize: 10 }} width={48} /><Tooltip content={<CohortQualityTooltip mode="activation" />} /><Bar dataKey="activation30Percent" name="Ativacao ate D+30" fill="#54D8E8" radius={[6, 6, 0, 0]} maxBarSize={48} /></ComposedChart></ResponsiveContainer></div>
              <footer>Permite comparar se as safras recentes estao ativando melhor ou pior, sem misturar meses ainda incompletos.</footer>
            </article>

            <article className="lag-simple-card">
              <header><div><span>Valor por safra</span><h3>GMV medio por creator nos primeiros 30 dias</h3></div><small>mes de primeira aparicao</small></header>
              <div className="lag-cohort-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 650, height: 330 }}><ComposedChart data={matureMonthlyCohorts} margin={{ top: 18, right: 12, left: 4, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#667083" tick={{ fontSize: 10 }} /><YAxis tickFormatter={compactMoney} stroke="#8A7547" tick={{ fontSize: 10 }} width={70} /><Tooltip content={<CohortQualityTooltip mode="gmv" />} /><Bar dataKey="averageGmv30" name="GMV medio em 30d" fill="#F6B84B" radius={[6, 6, 0, 0]} maxBarSize={48} /></ComposedChart></ResponsiveContainer></div>
              <footer>A media e concentrada: os 10% maiores geram <b>{percent(maturity.top10ShareGmv30Percent)}</b> do GMV D0–D30. Leia junto com a ativacao.</footer>
            </article>
          </div>

          <article className="lag-simple-card weekly-forecast-card">
            <header><div><span>Previsao operacional, sem ruido diario</span><h3>GMV por semana: ultimas 4 observadas e proximas 4 previstas</h3></div><div className="weekly-forecast-total"><span>Proximos 30 dias</span><strong>{compactMoney(lagForecast.forecastGmv)}</strong><small>faixa {compactMoney(lagForecast.lowGmv)}–{compactMoney(lagForecast.highGmv)}</small></div></header>
            <div className="lag-weekly-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1320, height: 370 }}><ComposedChart data={weeklyGmvData} margin={{ top: 20, right: 14, left: 4, bottom: 2 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="period" stroke="#667083" tick={{ fontSize: 10 }} /><YAxis tickFormatter={compactMoney} stroke="#736C8A" tick={{ fontSize: 10 }} width={76} /><Tooltip content={<WeeklyGmvTooltip />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} /><Bar dataKey="observedGmv" name="GMV observado" fill="#54D8E8" radius={[7, 7, 0, 0]} maxBarSize={70} /><Bar dataKey="forecastGmv" name="GMV previsto" fill="#A99BFF" radius={[7, 7, 0, 0]} maxBarSize={70} /></ComposedChart></ResponsiveContainer></div>
            <footer><span>Erro historico do modelo: <b>{percent(lagForecast.backtestWapePercent)}</b>.</span><span>Novos dos ultimos 30d devem contribuir <b>{compactMoney(recentCohorts.expectedNext30Gmv)}</b> no proximo periodo.</span><em>A previsao total ja inclui o efeito das coortes; nao somar novamente.</em></footer>
          </article>

          <article className="lag-evidence-card">
            <div><span>Teste real da carteira</span><h3>Menos creators nao significou menos GMV.</h3><p>Entre {date(stockDrawdown.peakDate)} e {date(stockDrawdown.troughDate)}, a base encolheu, mas o GMV dos 30 dias seguintes cresceu. O que saiu tinha baixa participacao economica.</p></div>
            <div className="lag-evidence-comparison"><div className="down"><span>Creators ativos</span><strong>{integer(stockDrawdown.peakStock)} → {integer(stockDrawdown.troughStock)}</strong><small>{signedInteger(stockDrawdown.stockChange)} creators</small></div><div className="up"><span>GMV 30d</span><strong>{compactMoney(stockDrawdown.prior30Gmv)} → {compactMoney(stockDrawdown.future30Gmv)}</strong><small>+{percent(stockDrawdown.futureVsPriorGmvPercent)}</small></div><div><span>Peso de quem saiu</span><strong>{percent(stockDrawdown.lostShareOfPeakPrior30Gmv)}</strong><small>do GMV anterior</small></div></div>
          </article>

          <div className="lag-method-note"><b>Como ler:</b> entrada e a primeira aparicao do creator no ledger. Ativacao significa ter algum GMV. GMV medio pode ser puxado por poucos creators; por isso ativacao e valor aparecem em graficos separados.</div>
        </section>}

        <section className="dashboard-table-card" data-dashboard-table="activation">
          <header><div><span>Detalhamento reativo</span><h2>Safras maduras de ativacao</h2></div><small>Somente safras com 30 dias completos</small></header>
          <div className="dashboard-table-scroll"><table><thead><tr><th>Safra</th><th>Creators</th><th>Ativacao D+30</th><th>GMV medio D0-D30</th><th>GMV mediano D0-D30</th></tr></thead><tbody>{activationTableRows.slice().reverse().map((row) => <tr key={row.month}><td>{monthLabel(row.month)}</td><td>{integer(row.matureEntrants)}</td><td><strong>{percent(row.activation30Percent)}</strong></td><td>{money(row.averageGmv30)}</td><td>{money(row.medianGmv30)}</td></tr>)}{activationTableRows.length === 0 && <tr><td colSpan="5"><div className="dashboard-table-empty">Nenhum resultado para os filtros ativos.</div></td></tr>}</tbody></table></div>
        </section>
        </div>}

        {dashboardSection === "movement" && <div className="dashboard-surface" data-dashboard-section="movement">
        <section className="affiliation-movement-copy">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Fluxo diario da carteira</span><h2>Agenciados, novos e desvinculados</h2><p>Estoque total e movimentacoes calculadas pela diferenca entre dois relatorios diarios consecutivos.</p></div>
            <div className="daily-movement-latest">
              <div><span>Novos no ultimo dia</span><strong className="positive">+{integer(latestMovement.additions)}</strong></div>
              <div><span>Desvinculados observados</span><strong className="negative">-{integer(latestMovement.exits)}</strong></div>
            </div>
          </header>
          <div className="affiliation-movement-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={movementData} margin={{ top: 20, right: 8, left: -8, bottom: 2 }}>
                <defs><linearGradient id="affiliationMovementFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A99BFF" stopOpacity=".27" /><stop offset="100%" stopColor="#A99BFF" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="active" stroke="#766F91" tick={{ fontSize: 10 }} width={52} domain={["dataMin - 40", "dataMax + 40"]} />
                <YAxis yAxisId="movement" orientation="right" stroke="#617267" tick={{ fontSize: 10 }} width={48} domain={[0, "dataMax + 10"]} />
                <Tooltip content={<AffiliationMovementTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area yAxisId="active" type="monotone" dataKey="activeCreators" name="Agenciados no dia" stroke="#A99BFF" strokeWidth={3} fill="url(#affiliationMovementFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line yAxisId="movement" type="monotone" dataKey="additions" name="Novos agenciados" stroke="#47D7A0" strokeWidth={2.4} dot={false} connectNulls={false} />
                <Line yAxisId="movement" type="monotone" dataKey="exits" name="Desvinculados observados" stroke="#FF647C" strokeWidth={2.4} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Novos:</b> apareceu hoje e nao estava no relatorio anterior.</span><span><b>Desvinculados observados:</b> estava ontem e nao apareceu hoje.</span><em>Leitura inferida pela presenca diaria; nao e um evento formal de status do Partner Center.</em></footer>
        </section>

        <section className="affiliation-movement-copy affiliation-flow-only">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Entradas x saidas</span><h2>Novos agenciados e desvinculados por dia</h2><p>Duas series de contagem, no mesmo eixo Y e exatamente na mesma escala.</p></div>
          </header>
          <div className="affiliation-movement-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={movementData} margin={{ top: 20, right: 12, left: -4, bottom: 2 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis allowDecimals={false} stroke="#6B7383" tick={{ fontSize: 10 }} width={52} domain={[0, "dataMax + 10"]} />
                <Tooltip content={<AffiliationMovementTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line type="monotone" dataKey="firstAppearances" name="Novos agenciados" stroke="#47D7A0" strokeWidth={2.8} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="exits" name="Desvinculados observados" stroke="#FF647C" strokeWidth={2.8} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Novos agenciados:</b> primeira aparicao observada do creator no ledger.</span><span><b>Desvinculados:</b> presente no dia anterior e ausente no dia atual.</span><em>As duas linhas usam a mesma unidade e o mesmo eixo.</em></footer>
        </section>

        <section className="movement-section econ-panel">
          <header><div><span>Movimentacao diaria da base</span><h2>Desvinculados e GMV previo 30d</h2></div><div className="movement-head-side"><small>Clique em um dia para ver abaixo quem saiu. Use a leitura mais clara para sua decisao.</small><div className="view-switch" role="group" aria-label="Modo de leitura do grafico"><button type="button" aria-pressed={exitChartView === "combined"} className={exitChartView === "combined" ? "active" : ""} onClick={() => setExitChartView("combined")}>Combinado</button><button type="button" aria-pressed={exitChartView === "split"} className={exitChartView === "split" ? "active" : ""} onClick={() => setExitChartView("split")}>Separado</button><button type="button" aria-pressed={exitChartView === "ranking"} className={exitChartView === "ranking" ? "active" : ""} onClick={() => setExitChartView("ranking")}>Ranking</button></div><div className="view-switch" role="group" aria-label="Janela do grafico"><button type="button" aria-pressed={movementWindow === "30"} className={movementWindow === "30" ? "active" : ""} onClick={() => setExitWindow("30")}>30d</button><button type="button" aria-pressed={movementWindow === "60"} className={movementWindow === "60" ? "active" : ""} onClick={() => setExitWindow("60")}>60d</button><button type="button" aria-pressed={movementWindow === "all"} className={movementWindow === "all" ? "active" : ""} onClick={() => setExitWindow("all")}>Tudo</button></div></div></header>
          <div className="movement-kpis movement-kpis-exits">
            <div><span>Desvinculados no periodo</span><strong>{integer(visibleExitEvents)}</strong><small>eventos dentro da janela selecionada</small></div>
            <div><span>GMV previo 30d associado</span><strong>{compactMoney(visibleExitGmvPrior30d)}</strong><small>soma dos 30 dias anteriores a cada saida</small></div>
          </div>
          {exitChartView === "combined" && <div className="movement-chart" role="img" aria-label="Grafico combinado: pontos azuis representam desvinculados; linha vermelha representa GMV previo 30 dias">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1320, height: 350 }}>
              <ComposedChart data={movementChartData} margin={{ top: 20, right: 12, left: -2, bottom: 0 }} onClick={(event) => { if (event?.activeLabel) setSelectedExitDate(event.activeLabel) }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis yAxisId="people" stroke="#6B7180" tick={{ fontSize: 10 }} width={42} />
                <YAxis yAxisId="gmv" orientation="right" tickFormatter={compactMoney} stroke="#A94D5E" tick={{ fontSize: 10 }} width={72} />
                <ZAxis zAxisId="exitDots" range={[18, 18]} />
                <Tooltip content={<MovementTooltip />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                {selectedExitDay.date && <ReferenceLine yAxisId="people" x={selectedExitDay.date} stroke="#F4F6FF" strokeOpacity={0.5} strokeDasharray="3 4" />}
                <Scatter yAxisId="people" zAxisId="exitDots" dataKey="exits" name="Desvinculados · pontos" fill="#54D8E8" fillOpacity={0.72} cursor="pointer" />
                <Line yAxisId="gmv" type="monotone" dataKey="exitedGmvPrior30d" name="GMV previo 30d · linha" stroke="#FF647C" strokeWidth={3} dot={false} activeDot={{ r: 5, cursor: "pointer" }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>}
          {exitChartView === "split" && <div className="movement-split-grid">
            <article><header><span>Quantidade</span><h3>Desvinculados por dia</h3></header><div className="movement-split-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 300 }}><ComposedChart data={movementChartData} margin={{ top: 14, right: 8, left: -8, bottom: 0 }} onClick={(event) => { if (event?.activeLabel) setSelectedExitDate(event.activeLabel) }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={26} /><YAxis allowDecimals={false} stroke="#3F8E9A" tick={{ fontSize: 9 }} width={42} /><ZAxis zAxisId="exitDots" range={[18, 18]} /><Tooltip content={<MovementTooltip />} />{selectedExitDay.date && <ReferenceLine x={selectedExitDay.date} stroke="#F4F6FF" strokeOpacity={0.45} strokeDasharray="3 4" />}<Scatter zAxisId="exitDots" dataKey="exits" name="Desvinculados · pontos" fill="#54D8E8" fillOpacity={0.72} cursor="pointer" /></ComposedChart></ResponsiveContainer></div></article>
            <article><header><span>Valor associado</span><h3>GMV previo 30d por saida</h3></header><div className="movement-split-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 300 }}><ComposedChart data={movementChartData} margin={{ top: 14, right: 8, left: 2, bottom: 0 }} onClick={(event) => { if (event?.activeLabel) setSelectedExitDate(event.activeLabel) }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 9 }} minTickGap={26} /><YAxis tickFormatter={compactMoney} stroke="#A94D5E" tick={{ fontSize: 9 }} width={66} /><Tooltip content={<MovementTooltip />} />{selectedExitDay.date && <ReferenceLine x={selectedExitDay.date} stroke="#F4F6FF" strokeOpacity={0.45} strokeDasharray="3 4" />}<Line type="monotone" dataKey="exitedGmvPrior30d" name="GMV previo 30d · linha" stroke="#FF647C" strokeWidth={3} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div></article>
          </div>}
          {exitChartView === "ranking" && <div className="movement-ranking-grid">
            <article><header><span>Top 10 dias</span><h3>Mais desvinculacoes</h3></header><ol>{exitRankingByEvents.map((row) => <li key={`events-${row.date}`}><button type="button" onClick={() => setSelectedExitDate(row.date)}><span>{date(row.date)}</span><strong>{integer(row.exits)} creators</strong></button></li>)}</ol></article>
            <article><header><span>Top 10 dias</span><h3>Maior GMV previo associado</h3></header><ol>{exitRankingByGmv.map((row) => <li key={`gmv-${row.date}`}><button type="button" onClick={() => setSelectedExitDate(row.date)}><span>{date(row.date)}</span><strong>{money(row.exitedGmvPrior30d)}</strong></button></li>)}</ol></article>
          </div>}
          <div className="exit-day-drilldown" data-dashboard-table="movement">
            <header>
              <div><span>Creators que sairam</span><h3>{selectedExitDay.date ? date(selectedExitDay.date) : "Selecione um dia"}</h3>{selectedExitDay.date && <button className="dashboard-selection-chip" type="button" onClick={() => setSelectedExitDate("")}>Data ativa: {date(selectedExitDay.date)} ×</button>}</div>
              <div><strong>{integer(selectedExitDay.exits || 0)}</strong><span>desvinculados</span><b>{money(selectedExitDay.exitedGmvPrior30d || 0)}</b><small>GMV previo 30d</small></div>
            </header>
            {selectedExitedCreators.length ? <div className="exit-creators-table-wrap"><table className="exit-creators-table">
              <thead><tr><th>#</th><th>Creator</th><th>GMV previo 30d</th></tr></thead>
              <tbody>{selectedExitedCreators.map((creator, index) => <tr key={`${selectedExitDay.date}-${creator.authorId}`}><td>{index + 1}</td><td><strong>{creator.alias ? `@${creator.alias.replace(/^@/, "")}` : `Creator ${creator.authorId}`}</strong><small>ID {creator.authorId}</small></td><td>{money(creator.gmvPrior30d)}</td></tr>)}</tbody>
            </table></div> : <div className="exit-creators-empty">Nenhum creator saiu no dia selecionado.</div>}
          </div>
          <footer><span>{portfolio.definitions?.exit}</span><b>{portfolio.definitions?.gmvPrior30d}</b>{source !== "all" && <em>Visao global: filtro de origem nao aplicado.</em>}</footer>
        </section>

        <section className="lost-gmv-share-section affiliation-movement-copy">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Impacto diario das saidas</span><h2>Percentual de GMV 30d perdido</h2><p>Compara o potencial recente dos creators que sairam com o potencial da base que permaneceu vinculada no mesmo dia.</p></div>
            <div className="daily-movement-latest">
              <div><span>Desvinculados em {date(latestMovement.date)}</span><strong style={{ color: "#54D8E8" }}>{integer(latestMovement.exits)}</strong></div>
              <div><span>GMV 30d perdido</span><strong className="negative">{latestMovement.lostGmvPercentOfRemainingBase == null ? "—" : percent(latestMovement.lostGmvPercentOfRemainingBase)}</strong></div>
            </div>
          </header>
          <div className="affiliation-movement-chart" role="img" aria-label="Pontos azuis mostram desvinculados por dia; linha vermelha mostra o percentual de GMV previo 30 dias perdido">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={movementChartData} margin={{ top: 20, right: 12, left: -4, bottom: 2 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis yAxisId="people" allowDecimals={false} stroke="#3F8E9A" tick={{ fontSize: 10 }} width={52} domain={[0, "dataMax + 10"]} />
                <YAxis yAxisId="percent" orientation="right" tickFormatter={percent} stroke="#A94D5E" tick={{ fontSize: 10 }} width={58} domain={[0, "auto"]} />
                <ZAxis zAxisId="exitDots" range={[18, 18]} />
                <Tooltip content={<LostGmvShareTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Scatter yAxisId="people" zAxisId="exitDots" dataKey="exits" name="Desvinculados · pontos azuis" fill="#54D8E8" fillOpacity={0.72} />
                <Line yAxisId="percent" type="monotone" dataKey="lostGmvPercentOfRemainingBase" name="Percentual de GMV 30d perdido" stroke="#FF647C" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Numerador:</b> GMV previo 30d dos creators que sairam no dia.</span><span><b>Denominador:</b> GMV previo 30d da base que permaneceu vinculada no dia.</span><em>Formula: numerador ÷ denominador × 100. Os primeiros 30 dias incompletos nao recebem percentual. O seletor 30d, 60d ou Tudo do bloco acima controla este grafico.</em></footer>
        </section>

        <section className="affiliation-movement-copy affiliation-returns-only">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Reativacao da carteira</span><h2>Creators que voltaram por dia</h2><p>Mostra somente creators que reapareceram depois de pelo menos um dia ausentes, sem misturar primeiras aparicoes ou saidas.</p></div>
            <div className="daily-movement-latest">
              <div><span>Retornos no periodo</span><strong className="returning">{integer(selectedReturnsTotal)}</strong></div>
              <div><span>Media por dia</span><strong className="returning">{decimal(selectedReturnsDailyAverage)}</strong></div>
            </div>
          </header>
          <div className="affiliation-movement-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={movementChartData} margin={{ top: 20, right: 12, left: -4, bottom: 2 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis allowDecimals={false} stroke="#8A7547" tick={{ fontSize: 10 }} width={52} domain={[0, "dataMax + 2"]} />
                <Tooltip content={<MovementTooltip />} />
                <Bar dataKey="returns" name="Creators que voltaram" fill="#F6B84B" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Retorno:</b> creator presente hoje, ausente ontem e ja observado antes no historico.</span><span>O seletor de 30d, 60d ou tudo do bloco acima tambem controla este grafico.</span><em>Retorno nao e primeira aparicao e nao entra como novo agenciado.</em></footer>
        </section>

        <section className="affiliation-movement-copy affiliation-flow-only affiliation-flow-average7-copy">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Ritmo real · media movel</span><h2>Media de entradas e saidas dos ultimos 7 dias</h2><p>Suaviza os picos diarios e deixa claro se a velocidade de aquisicao esta acima ou abaixo da velocidade de saida.</p></div>
            <div className="daily-movement-latest">
              <div><span>Entradas · media 7d</span><strong className="positive">{Number(latestFlowAnalysis.entriesAverage7Days || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/dia</strong></div>
              <div><span>Saidas · media 7d</span><strong className="negative">{Number(latestFlowAnalysis.exitsAverage7Days || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/dia</strong></div>
            </div>
          </header>
          <div className="affiliation-movement-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={flowAnalysisData} margin={{ top: 20, right: 12, left: -4, bottom: 2 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, flowAnalysisData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis allowDecimals={false} stroke="#6B7383" tick={{ fontSize: 10 }} width={52} domain={[0, "auto"]} />
                <Tooltip content={<FlowAnalysisTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line type="monotone" dataKey="entriesAverage7Days" name="Entradas · media movel 7d" stroke="#47D7A0" strokeWidth={3} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="exitsAverage7Days" name="Saidas · media movel 7d" stroke="#FF647C" strokeWidth={3} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Media 7d:</b> media diaria da data e dos 6 dias anteriores.</span><span><b>Entradas:</b> somente primeira aparicao; retornos nao entram.</span><em>Linhas de sabado e domingo preservadas.</em></footer>
        </section>

        <section className="affiliation-movement-copy affiliation-flow-only affiliation-flow-net30-copy">
          <header className="affiliation-movement-head">
            <div><span className="affiliation-kicker">Expansao liquida · janela movel</span><h2>Saldo acumulado da carteira nos ultimos 30 dias</h2><p>Uma unica linha para responder se a carteira ganhou ou perdeu creators no periodo recente, sem ruido diario.</p></div>
            <div className="daily-gmv-latest"><span>Saldo 30d ate {date(latestFlowAnalysis.date)}</span><strong className={(latestFlowAnalysis.netTotal30Days || 0) >= 0 ? "positive" : "negative"}>{signedInteger(latestFlowAnalysis.netTotal30Days)}</strong><small>{integer(latestFlowAnalysis.entriesTotal30Days)} entradas − {integer(latestFlowAnalysis.exitsTotal30Days)} saidas</small></div>
          </header>
          <div className="affiliation-movement-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1240, height: 390 }}>
              <ComposedChart data={flowAnalysisData} margin={{ top: 20, right: 12, left: -4, bottom: 2 }}>
                <defs><linearGradient id="affiliationFlowNet30Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54D8E8" stopOpacity=".24" /><stop offset="100%" stopColor="#54D8E8" stopOpacity=".01" /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <CartesianGrid horizontal={false} stroke="rgba(173,181,197,.18)" strokeWidth={0.8} verticalCoordinatesGenerator={({ offset }) => weekendIndexes.map((index) => offset.left + index * offset.width / Math.max(1, flowAnalysisData.length - 1))} />
                <XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#5E6678" tick={{ fontSize: 10 }} minTickGap={32} />
                <YAxis stroke="#6B7383" tick={{ fontSize: 10 }} width={58} domain={["dataMin - 20", "dataMax + 20"]} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,.48)" strokeDasharray="5 5" />
                <Tooltip content={<FlowAnalysisTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area type="monotone" dataKey="netTotal30Days" name="Saldo acumulado nos ultimos 30 dias" stroke="#54D8E8" strokeWidth={3} fill="url(#affiliationFlowNet30Fill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer><span><b>Saldo 30d:</b> entradas observadas menos saidas observadas entre D-29 e D.</span><span>Acima de zero = expansao; abaixo de zero = contracao.</span><em>Entradas incluem primeira aparicao e retornos, para reconciliar exatamente a variacao do estoque ativo.</em></footer>
        </section>
        </div>}

        {dashboardSection === "retention" && <div className="dashboard-surface" data-dashboard-section="retention">
        <section className="retention-analytics-section">
          <header className="retention-analytics-head">
            <div><span className="affiliation-kicker">Retencao observada</span><h2>Quanto tempo levamos para perder um creator?</h2><p>Duracao dos ciclos que terminaram em uma saida observada, com retorno posterior e GMV previo associado.</p></div>
            <div className="retention-censor"><span>Amostra encerrada</span><strong>{integer(retention.summary?.exitEventsWithDuration)} saidas</strong><small>Creators ainda presentes estao censurados e nao entram na media.</small></div>
          </header>
          <div className="retention-summary-grid">
            <div><span>Tempo medio ate saida</span><strong>{retention.summary?.meanDaysToExit == null ? "—" : `${decimal(retention.summary.meanDaysToExit)} dias`}</strong><small>{integer(retention.summary?.exitEventsWithDuration)} ciclos completos</small></div>
            <div><span>Mediana ate saida</span><strong>{retention.summary?.medianDaysToExit == null ? "—" : `${decimal(retention.summary.medianDaysToExit)} dias`}</strong><small>menos sensivel a extremos</small></div>
            <div><span>Creators unicos que sairam</span><strong>{integer(retention.summary?.uniqueExitedCreators)}</strong><small>author_id unicos na janela</small></div>
            <div><span>Sairam e voltaram depois</span><strong>{retention.summary?.laterReturnPercent == null ? "—" : percent(retention.summary.laterReturnPercent)}</strong><small>{integer(retention.summary?.uniqueExitedCreatorsWithLaterReturn)} creators com retorno posterior</small></div>
          </div>
          <div className="retention-chart-grid">
            <article>
              <header><div><span>Desvinculados e retornos</span><h3>Saidas observadas versus creators que voltaram</h3></div><small>Barras = movimentos no mes · linha = retorno posterior da coorte</small></header>
              <div className="retention-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 330 }}><ComposedChart data={retention.monthly || []} margin={{ top: 18, right: 12, left: 2, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#596273" tick={{ fontSize: 10 }} /><YAxis yAxisId="people" stroke="#7A8497" tick={{ fontSize: 10 }} width={45} /><YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="#A99BFF" tick={{ fontSize: 9 }} width={42} /><Tooltip content={<RetentionTooltip percentKeys={["cohortReturnPercentDisplay"]} />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} /><Bar yAxisId="people" dataKey="observedExits" name="Desvinculados observados" fill="#F06F7D" radius={[5, 5, 0, 0]} /><Bar yAxisId="people" dataKey="observedReturns" name="Voltaram no mes" fill="#47D7A0" radius={[5, 5, 0, 0]} /><Line yAxisId="rate" type="monotone" dataKey="cohortReturnPercentDisplay" name="Retorno posterior da coorte" stroke="#A99BFF" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} /></ComposedChart></ResponsiveContainer></div>
            </article>
            <article>
              <header><div><span>GMV previo 30 dias</span><h3>Volume associado aos creators que sairam</h3></div><small>GMV anterior a saida · nao implica causalidade</small></header>
              <div className="retention-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 330 }}><ComposedChart data={retention.monthly || []} margin={{ top: 18, right: 12, left: 2, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#596273" tick={{ fontSize: 10 }} /><YAxis yAxisId="gmv" tickFormatter={compactMoney} stroke="#F6B84B" tick={{ fontSize: 9 }} width={70} /><YAxis yAxisId="people" orientation="right" stroke="#62D8FF" tick={{ fontSize: 9 }} width={42} /><Tooltip content={<RetentionTooltip moneyKeys={["exitedGmvPrior30d"]} />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} /><Bar yAxisId="gmv" dataKey="exitedGmvPrior30d" name="GMV previo 30d" fill="#C48A30" radius={[5, 5, 0, 0]} /><Line yAxisId="people" type="monotone" dataKey="exitedCreatorsWithGmv30d" name="Saidas com GMV nos 30d" stroke="#62D8FF" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} /></ComposedChart></ResponsiveContainer></div>
            </article>
          </div>
          <div className="retention-analytics-grid">
            <article>
              <header><span>Tempo medio por categoria</span><small>Amostra de eventos encerrados</small></header>
              <div className="retention-tier-list">{(retention.byTier || []).map((item) => <div key={item.key}><span>{item.label}</span><strong>{decimal(item.meanDaysToExit)} dias</strong><small>mediana {decimal(item.medianDaysToExit)} · n={integer(item.exitEvents)}</small></div>)}</div>
            </article>
            <article>
              <header><span>Leitura mensal das saidas</span><small>Volume, retorno e GMV anterior</small></header>
              <div className="retention-month-list">{(retention.monthly || []).map((item) => <div key={item.month}><span>{monthLabel(item.month)} · {integer(item.observedExits)} saidas / {integer(item.observedReturns)} retornos</span><strong>{money(item.exitedGmvPrior30d)}</strong><small>{item.cohortReturnPercentDisplay == null ? `retorno: amostra insuficiente (n=${integer(item.cohortExitedCreators)})` : `${percent(item.cohortReturnPercentDisplay)} voltaram depois · GMV medio/saida ${money(item.avgGmvPrior30dPerExit)}`} · {item.completeWindow ? "janela completa" : "janela parcial"}</small></div>)}</div>
            </article>
          </div>
          <footer><span>{retention.methodology}</span><b>{retention.caveat}</b></footer>
        </section>
        <section className="dashboard-table-card" data-dashboard-table="retention">
          <header><div><span>Detalhamento reativo</span><h2>Retencao mensal</h2></div><small>Eventos completos e janelas parciais identificados</small></header>
          <div className="dashboard-table-scroll"><table><thead><tr><th>Mes</th><th>Saidas</th><th>Retornos</th><th>Retorno posterior</th><th>GMV previo 30d</th><th>GMV medio por saida</th><th>Janela</th></tr></thead><tbody>{retentionTableRows.slice().reverse().map((row) => <tr key={row.month}><td>{monthLabel(row.month)}</td><td>{integer(row.observedExits)}</td><td>{integer(row.observedReturns)}</td><td>{row.cohortReturnPercentDisplay == null ? "—" : percent(row.cohortReturnPercentDisplay)}</td><td><strong>{money(row.exitedGmvPrior30d)}</strong></td><td>{money(row.avgGmvPrior30dPerExit)}</td><td>{row.completeWindow ? "Completa" : "Parcial"}</td></tr>)}{retentionTableRows.length === 0 && <tr><td colSpan="7"><div className="dashboard-table-empty">Nenhum resultado para os filtros ativos.</div></td></tr>}</tbody></table></div>
        </section>
        </div>}

        {dashboardSection === "finance" && <div className="dashboard-surface" data-dashboard-section="finance">
        <section className="dashboard-table-card" data-dashboard-table="finance">
          <header><div><span>Detalhamento reativo</span><h2>Fechamento mensal da Creator BU</h2></div><small>Clique no mes para abrir custos e lancamentos</small></header>
          <div className="dashboard-table-scroll"><table><thead><tr><th>Mes</th><th>Receita Creator BU</th><th>Custo observado</th><th>Premissa salarial</th><th>Custo considerado</th><th>Resultado considerado</th><th>Linhas</th></tr></thead><tbody>{financeTableRows.slice().reverse().map((row) => <tr key={row.month} className={selectedBusinessUnitMonth.month === row.month ? "selected" : ""}><td><button type="button" onClick={() => setBusinessUnitMonth(row.month)} aria-current={selectedBusinessUnitMonth.month === row.month ? "true" : undefined}>{monthLabel(row.month)}</button></td><td>{money(row.revenue)}</td><td>{row.actualCost == null ? "—" : money(row.actualCost)}</td><td>{money(row.assumptionCost)}</td><td>{money(row.consideredCost)}</td><td><strong>{money(row.consideredResult)}</strong></td><td>{integer(row.lineItemCount)}</td></tr>)}{financeTableRows.length === 0 && <tr><td colSpan="7"><div className="dashboard-table-empty">Nenhum resultado para os filtros ativos.</div></td></tr>}</tbody></table></div>
        </section>
        <section className="creator-bu-section">
          <header className="creator-bu-head">
            <div><span className="profit-kicker">Business Unit Creators</span><h2>Ganho mensal versus gasto mensal</h2><p>Todos os gastos validos disponiveis no Notion e na Meta entram no inventario para revisao. O grafico evita apenas sobreposicoes identificadas entre as fontes.</p></div>
            <div className={`creator-bu-status ${businessUnitActuals.status || "unavailable"}`}><span>{businessUnitActuals.status === "observed" ? "Notion + Meta + premissa" : "Notion indisponivel · premissa ativa"}</span><strong>{businessUnitActuals.status === "observed" ? `${integer(businessUnitActuals.reviewRows)} linhas para revisar` : "Resultado parcial"}</strong><small>{businessUnitActuals.status === "observed" ? `${integer(businessUnitActuals.fetchedRows)} Notion + ${integer(businessUnitActuals.supplementalRows)} Meta` : businessUnitActuals.error || businessUnitActuals.source}</small></div>
          </header>
          <div className="creator-bu-inventory">
            <header><div><span>Inventario completo · sem filtro de exclusao</span><h3>Todos os gastos encontrados para voce revisar</h3></div><small>Linhas sobrepostas continuam visiveis e marcadas</small></header>
            <div className="creator-bu-inventory-summary">
              <div><span>Soma bruta das fontes</span><strong>{money(businessUnitInventory.totalCost)}</strong><small>{integer(businessUnitInventory.lineItemCount)} linhas visiveis</small></div>
              <div><span>Observado contabilizado</span><strong>{money(consideredInventory.totalCost)}</strong><small>{integer(businessUnitActuals.includedRows)} linhas sem sobreposicao</small></div>
              <div><span>Possiveis duplicidades</span><strong>{integer((businessUnitInventory.lineItemCount || 0) - (businessUnitActuals.includedRows || 0))}</strong><small>mantidas abaixo para sua decisao</small></div>
            </div>
            <div className="creator-bu-inventory-grid">{(businessUnitInventory.categories || []).map((category) => <details key={category.key}><summary><span>{category.label}</span><strong>{money(category.amount)}</strong><small>{integer(category.lineItems.length)} linhas</small></summary><div>{category.lineItems.length ? category.lineItems.map((line) => <article key={line.id} className={line.includedInResult === false ? "review-overlap" : ""}><div><strong>{line.name}</strong><small>{line.reviewStatus === "possible-overlap-meta" ? "POSSIVEL SOBREPOSICAO META · visivel, fora do resultado" : line.sourceKind === "meta-live" ? `META AO VIVO · ${line.sourcePeriod?.from || line.month} a ${line.sourcePeriod?.to || line.month}` : `${line.tipo || "Sem Tipo"} · ${line.provedor || "Sem Provedor"} · ${monthLabel(line.month)}`}</small></div><b>{money(line.value)}</b></article>) : <p>Nenhuma linha nesta categoria.</p>}</div></details>)}</div>
          </div>
          <div className="creator-bu-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1180, height: 340 }}>
              <ComposedChart data={businessUnitMonths} margin={{ top: 20, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke="#596273" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={compactMoney} stroke="#627064" tick={{ fontSize: 10 }} width={72} />
                <Tooltip content={<ProfitabilityTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="revenue" name="Ganho mensal" fill="#7165D6" radius={[5, 5, 0, 0]} />
                <Bar dataKey="consideredCost" name="Gasto mensal considerado" fill="#C48A30" radius={[5, 5, 0, 0]} />
                <Line type="monotone" dataKey="consideredResult" name="Resultado considerado" stroke="#47D7A0" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="creator-bu-month-tabs" role="tablist" aria-label="Mes do realizado Creator BU">
            {businessUnitMonths.map((item) => <button key={item.month} type="button" role="tab" aria-selected={selectedBusinessUnitMonth.month === item.month} className={selectedBusinessUnitMonth.month === item.month ? "active" : ""} onClick={() => setBusinessUnitMonth(item.month)}><span>{monthLabel(item.month)}</span><strong>{money(item.revenue)}</strong><small>Gasto considerado {money(item.consideredCost)}</small></button>)}
          </div>
          <div className="creator-bu-actual-summary">
            <div><span>Receita Creator BU</span><strong>{money(selectedBusinessUnitMonth.revenue)}</strong><small>10% da comissao estimada</small></div>
            <div><span>Custo real contabilizado</span><strong className="cost">{selectedBusinessUnitMonth.actualCost == null ? "—" : money(selectedBusinessUnitMonth.actualCost)}</strong><small>{integer(selectedBusinessUnitMonth.lineItemCount)} linhas sem sobreposicao</small></div>
            <div><span>Premissa salarios retencao</span><strong className="cost">{money(selectedBusinessUnitMonth.assumptionCost)}</strong><small>{selectedBusinessUnitMonth.assumptionLineItemCount ? "R$ 5 mil por pessoa · informada" : "substituida por linha observada"}</small></div>
            <div><span>Resultado considerado da BU</span><strong>{money(selectedBusinessUnitMonth.consideredResult)}</strong><small>receita menos observado e premissa; plano separado</small></div>
          </div>
          <div className="creator-bu-drilldown">
            {(selectedBusinessUnitMonth.categories || []).map((category) => <details key={category.key}><summary><span>{category.label}</span><strong>{money(category.amount)}</strong><small>{integer(category.lineItems.length)} linhas</small></summary><div>{category.lineItems.length ? category.lineItems.map((line) => <article key={line.id}><div><strong>{line.name}</strong><small>{line.sourceKind === "assumption" ? "PREMISSA INFORMADA · nao e lancamento contabil" : `${line.tipo || "Sem Tipo"} · ${line.provedor || "Sem Provedor"}`}</small></div><b>{money(line.value)}</b></article>) : <p>Nenhuma linha observada ou premissa classificada neste mes.</p>}</div></details>)}
          </div>
          <div className="creator-bu-plan">
            <header><div><span>Plano Q3 · referencia separada</span><h3>Orcamento validado da Creator BU</h3></div><small>{creatorBusinessUnit.plan?.planId} · Projetos e Vendas excluidos</small></header>
            <div>{q3PlanMonths.map((item) => <article key={item.month}><h4>{monthLabel(item.month)}</h4><dl><div><dt>Aquisicao · area</dt><dd>{money(item.areas.acquisition.area)}</dd></div><div><dt>Aquisicao · time</dt><dd>{money(item.areas.acquisition.team)}</dd></div><div><dt>Retencao · area</dt><dd>{money(item.areas.retention.area)}</dd></div><div><dt>Retencao · time</dt><dd>{money(item.areas.retention.team)}</dd></div><div><dt>Growth · area</dt><dd>{money(item.areas.growth.area)}</dd></div><div><dt>Growth · trafego pago</dt><dd>{money(item.areas.growth.paidTraffic)}</dd></div></dl></article>)}</div>
            <footer>Plano nao preenche mes sem realizado e nunca e somado aos custos reais.</footer>
          </div>
          <footer><span>{businessUnitActuals.methodology}</span><b>{creatorBusinessUnit.definitions?.planSeparation}</b></footer>
        </section>

        <section className="profitability-section">
          <header className="profitability-head">
            <div><span className="profit-kicker">Custos e lucratividade</span><h2>Quanto a operacao deixa depois do que ja conhecemos</h2><p>Receita diaria da Amplify contra custos comprovados. A cobertura cresce conforme novas fontes de custo forem cadastradas.</p></div>
            <div className="profit-coverage"><i /><span>Cobertura parcial</span><b>1 categoria com valor</b><small>{date(profitability.period?.from)} a {date(profitability.period?.to)}</small></div>
          </header>

          <div className="profit-summary">
            <div><span>Receita Amplify estimada</span><strong>{money(profitSummary.amplifyRevenue)}</strong><small>10% da comissao estimada dos creators</small></div>
            <div><span>Custos conhecidos</span><strong className="cost">{profitSummary.knownCost == null ? "—" : money(profitSummary.knownCost)}</strong><small>hoje: trafego pago Meta</small></div>
            <div><span>Resultado apos custos conhecidos</span><strong className={(profitSummary.resultAfterKnownCosts || 0) >= 0 ? "result-positive" : "result-negative"}>{profitSummary.resultAfterKnownCosts == null ? "—" : money(profitSummary.resultAfterKnownCosts)}</strong><small>nao e lucro liquido contabil</small></div>
            <div><span>Margem parcial</span><strong>{profitSummary.knownMargin == null ? "—" : percent(profitSummary.knownMargin)}</strong><small>{integer(profitSummary.pendingCostCategories)} categorias ainda pendentes</small></div>
          </div>

          <div className="profit-warning"><b>Leitura atual:</b> a margem considera trafego pago, mas ainda nao desconta IA, Indique e Ganhe nem outros custos operacionais.</div>

          <div className="profit-chart-grid">
            <article className="profit-card profit-daily-chart">
              <header><div><span>Fluxo financeiro diario</span><h3>Receita, custo e resultado por dia</h3></div><small>Eixo X: dias fechados · Eixo Y: R$</small></header>
              <div className="profit-chart profit-chart-wide"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1260, height: 360 }}><ComposedChart data={profitability.daily || []} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}><defs><linearGradient id="profitResultFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#47D7A0" stopOpacity=".2" /><stop offset="100%" stopColor="#47D7A0" stopOpacity=".01" /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#596273" tick={{ fontSize: 10 }} minTickGap={30} /><YAxis tickFormatter={compactMoney} stroke="#627064" tick={{ fontSize: 10 }} width={72} /><Tooltip content={<ProfitabilityTooltip />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} /><Area type="monotone" dataKey="resultAfterKnownCosts" name="Resultado apos custos conhecidos" stroke="#47D7A0" fill="url(#profitResultFill)" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="amplifyRevenue" name="Receita Amplify (10%)" stroke="#A99BFF" strokeWidth={2.6} dot={false} /><Line type="monotone" dataKey="knownCost" name="Custos conhecidos" stroke="#F6B84B" strokeWidth={2.3} dot={false} /></ComposedChart></ResponsiveContainer></div>
            </article>

            <article className="profit-card">
              <header><div><span>Acumulado no periodo</span><h3>Receita e resultado acumulados</h3></div><small>O resultado cresce apenas contra custos registrados</small></header>
              <div className="profit-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 320 }}><ComposedChart data={profitability.daily || []} margin={{ top: 18, right: 10, left: 2, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => date(value).slice(0, 5)} stroke="#596273" tick={{ fontSize: 10 }} minTickGap={32} /><YAxis tickFormatter={compactMoney} stroke="#627064" tick={{ fontSize: 10 }} width={68} /><Tooltip content={<ProfitabilityTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} /><Line type="monotone" dataKey="cumulativeRevenue" name="Receita acumulada" stroke="#A99BFF" strokeWidth={2.7} dot={false} /><Line type="monotone" dataKey="cumulativeKnownCost" name="Custo acumulado" stroke="#F6B84B" strokeWidth={2.2} dot={false} /><Line type="monotone" dataKey="cumulativeResultAfterKnownCosts" name="Resultado acumulado" stroke="#47D7A0" strokeWidth={2.7} dot={false} /></ComposedChart></ResponsiveContainer></div>
            </article>

            <article className="profit-card">
              <header><div><span>Fechamento mensal</span><h3>Resultado conhecido por mes</h3></div><small>Meses montados pelos dias canonicos fechados</small></header>
              <div className="profit-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 620, height: 320 }}><ComposedChart data={profitability.monthly || []} margin={{ top: 18, right: 10, left: 2, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#596273" tick={{ fontSize: 10 }} /><YAxis tickFormatter={compactMoney} stroke="#627064" tick={{ fontSize: 10 }} width={68} /><Tooltip content={<ProfitabilityTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} /><Bar dataKey="amplifyRevenue" name="Receita Amplify" fill="#7266D8" radius={[5, 5, 0, 0]} /><Bar dataKey="knownCost" name="Custo conhecido" fill="#C48A30" radius={[5, 5, 0, 0]} /><Line type="monotone" dataKey="resultAfterKnownCosts" name="Resultado conhecido" stroke="#47D7A0" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} /></ComposedChart></ResponsiveContainer></div>
            </article>

            <article className="profit-card profit-origin-card">
              <header><div><span>Rentabilidade por origem</span><h3>Receita e custo conhecido de cada canal</h3></div><small>Origem: {date(profitability.originPeriod?.from)} a {date(profitability.originPeriod?.to)} · custo ausente nunca vira zero</small></header>
              <div className="profit-origin-layout">
                <div className="profit-origin-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 390 }}><ComposedChart layout="vertical" data={originProfitability.slice(0, 10)} margin={{ top: 8, right: 18, left: 12, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} /><XAxis type="number" tickFormatter={compactMoney} stroke="#596273" tick={{ fontSize: 9 }} /><YAxis type="category" dataKey="label" width={135} stroke="#70798A" tick={{ fontSize: 9 }} /><Tooltip content={<ProfitabilityTooltip />} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} /><Bar dataKey="amplifyRevenue" name="Receita Amplify" fill="#7165D6" radius={[0, 5, 5, 0]} /><Bar dataKey="knownCost" name="Custo conhecido" fill="#C48A30" radius={[0, 5, 5, 0]} /></ComposedChart></ResponsiveContainer></div>
                <div className="origin-profit-table">{originProfitability.slice(0, 10).map((item) => <div key={item.key}><span>{item.label}</span><strong>GMV {compactMoney(item.gmv)}</strong><small>Receita Amplify {compactMoney(item.amplifyRevenue)}</small><b className={item.costStatus}>{item.knownCost == null ? "Custo pendente" : `Custo ${compactMoney(item.knownCost)}`}</b><em>{item.resultAfterKnownCosts == null ? "Resultado indisponivel" : `Resultado ${compactMoney(item.resultAfterKnownCosts)}`}</em></div>)}</div>
              </div>
            </article>
          </div>

          <div className="cost-registry">
            <header><span>Cadastro progressivo de custos</span><b>Valores ausentes nao entram no resultado</b></header>
            <div>{(profitability.costRegistry || []).map((item) => <article key={item.key} className={item.status}><i /><span>{item.label}</span><strong>{item.amount == null ? "Aguardando fonte" : money(item.amount)}</strong><small>{item.status === "observed" ? "Observado diariamente" : item.status === "unavailable" ? "Fonte indisponivel" : "Pendente de cadastro"}</small></article>)}</div>
          </div>

          <footer><span>{profitability.definitions?.revenue}</span><span>{profitability.definitions?.knownCost}</span><b>{profitability.definitions?.result}</b>{source !== "all" && <em>Visao global: o filtro de origem nao altera esta secao.</em>}</footer>
        </section>
        </div>}

        {dashboardSection === "portfolio" && <div className="dashboard-surface" data-dashboard-section="portfolio">
        <section className="portfolio-grid">
          <article className="econ-panel monthly-performance">
            <header><div><span>GMV mensal da carteira</span><h2>Volume e creators vendendo</h2></div><small>Soma dos relatorios fechados de um unico dia, sem delta de snapshot acumulado.</small></header>
            <div className="portfolio-chart"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 330 }}><ComposedChart data={portfolio.monthly || []} margin={{ top: 18, right: 10, left: 5, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={monthLabel} stroke="#5E6678" tick={{ fontSize: 10 }} /><YAxis yAxisId="gmv" tickFormatter={compactMoney} stroke="#536B91" tick={{ fontSize: 10 }} width={74} /><YAxis yAxisId="people" orientation="right" stroke="#4F887A" tick={{ fontSize: 10 }} width={48} /><Tooltip content={<ChartTooltip moneyKeys={["totalGmv"]} />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} /><Bar yAxisId="gmv" dataKey="totalGmv" name="GMV mensal" fill="#5277FF" radius={[6, 6, 0, 0]} /><Line yAxisId="people" dataKey="creatorsWithGmv" name="Creators com GMV" stroke="#47D7A0" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} /></ComposedChart></ResponsiveContainer></div>
          </article>

          <article className="econ-panel monthly-ranking" data-dashboard-table="portfolio">
            <header><div><span>GMV mensal por pessoa</span><h2>Quem moveu o mes</h2></div><select value={selectedPortfolioMonth.month || portfolioMonth} onChange={(event) => setPortfolioMonth(event.target.value)}>{(portfolio.monthly || []).map((item) => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></header>
            <div className="month-health">
              <div><span>GMV</span><strong>{compactMoney(selectedPortfolioMonth.totalGmv)}</strong></div>
              <div><span>Com GMV</span><strong>{integer(selectedPortfolioMonth.creatorsWithGmv)}</strong></div>
              <div><span>Mediana</span><strong>{money(selectedPortfolioMonth.medianGmvPerSeller)}</strong></div>
              <div><span>Top 5</span><strong>{percent(selectedPortfolioMonth.top5Share)}</strong></div>
            </div>
            <div className="ranking-wrap"><table className="monthly-ranking-table"><thead><tr><th>#</th><th>Creator</th><th>GMV mensal</th><th>Share</th><th>Dias</th></tr></thead><tbody>{(selectedPortfolioMonth.topCreators || []).slice(0, 12).map((creator, index) => <tr key={creator.authorId}><td>{index + 1}</td><td><button type="button" onClick={() => openCreatorExplorer(creator.alias || creator.authorId)} aria-label={`Abrir raio-X de @${creator.alias || creator.authorId}`}>@{creator.alias || creator.authorId}</button></td><td><strong>{money(creator.gmv)}</strong></td><td>{percent(creator.share)}</td><td>{integer(creator.activeDays)}</td></tr>)}</tbody></table></div>
          </article>
        </section>

        {tierAnalytics.transitions?.length > 0 && <section className="tier-transition-section">
          <header className="tier-transition-head">
            <div><span className="tier-kicker">Classificacao interna por GMV mensal</span><h2>Quem subiu, caiu ou permaneceu de categoria</h2><p>Todo movimento e calculado pelo GMV real dos relatorios diarios fechados, agregado por <b>author_id</b> em cada mes.</p></div>
            <label><span>Comparar meses</span><select value={selectedTierTransition.toMonth || tierTransitionMonth} onChange={(event) => setTierTransitionMonth(event.target.value)}>{(tierAnalytics.transitions || []).map((item) => <option key={item.toMonth} value={item.toMonth}>{monthLabel(item.fromMonth)} → {monthLabel(item.toMonth)}</option>)}</select></label>
          </header>

          <div className="tier-rules">{(tierAnalytics.tiers || []).map((tier) => <div key={tier.key} style={{ "--tier-color": tier.color }}><i /><span>{tier.label}</span><strong>{compactMoney(tier.minExclusive)}–{compactMoney(tier.maxInclusive)}</strong></div>)}</div>

          <div className="tier-chart-focus-head"><div><span>Evolucao mensal dos monetizados</span><h3>Creators com GMV, de Start para cima</h3><p>Este grafico exclui completamente a base sem GMV para mostrar somente a distribuicao entre as categorias internas.</p></div><div><span>{monthLabel(latestTierMonth.month)}</span><strong>{integer(latestTierMonth.categorizedCreators)}</strong><small>monetizados · {integer(latestAboveStart)} acima de Start</small></div></div>
          <div className="tier-monthly-chart tier-monetized-only-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1360, height: 350 }}>
              <ComposedChart data={tierAnalytics.monthly || []} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} stroke="#5E6678" tick={{ fontSize: 10 }} />
                <YAxis stroke="#697285" tick={{ fontSize: 10 }} width={48} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                {(tierAnalytics.tiers || []).map((tier) => <Bar key={tier.key} dataKey={tier.key} name={tier.label} stackId="tiers" fill={tier.color} radius={tier.key === "safira" ? [5, 5, 0, 0] : undefined} />)}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="tier-transition-kpis">
            <div className="up"><span>Subiram</span><strong>{integer(selectedTierTransition.promoted)}</strong><small>entre categorias internas</small></div>
            <div className="down"><span>Cairam</span><strong>{integer(selectedTierTransition.demoted)}</strong><small>entre categorias internas</small></div>
            <div><span>Permaneceram</span><strong>{integer(selectedTierTransition.retained)}</strong><small>na mesma categoria</small></div>
            <div className="enter"><span>Entraram em categoria</span><strong>{integer(selectedTierTransition.enteredTier)}</strong><small>vieram de Sem GMV ou fora da base</small></div>
            <div className="leave"><span>Sairam de categoria</span><strong>{integer(selectedTierTransition.leftTier)}</strong><small>foram para Sem GMV ou fora da base</small></div>
          </div>

          <div className="tier-transition-layout">
            <article className="tier-matrix-card">
              <header><div><span>Matriz de transicao</span><h3>{monthLabel(selectedTierTransition.fromMonth)} → {monthLabel(selectedTierTransition.toMonth)}</h3></div><small>Linha = origem · coluna = destino</small></header>
              <div className="tier-matrix-scroll"><table><thead><tr><th>De \ Para</th>{(tierAnalytics.tiers || []).map((tier) => <th key={tier.key}>{tier.label}</th>)}<th>Total</th></tr></thead><tbody>{(selectedTierTransition.matrix || []).map((row) => <tr key={row.from}><th>{row.label}</th>{row.cells.map((cell) => <td key={cell.to} className={row.from === cell.to ? "same" : ""} style={{ backgroundColor: `rgba(84,216,232,${0.035 + cell.count / tierMatrixMax * 0.42})` }}><strong>{integer(cell.count)}</strong></td>)}<td className="row-total">{integer(row.total)}</td></tr>)}</tbody></table></div>
            </article>

            <article className="tier-flow-card">
              <header><div><span>Maiores mudancas</span><h3>Fluxos fora da diagonal</h3></div><small>Inclui Sem GMV e Fora da base</small></header>
              <div>{migrationFlows.map((flow) => { const fromIndex = tierOrder.indexOf(flow.from); const toIndex = tierOrder.indexOf(flow.to); const tone = fromIndex >= 0 && toIndex > fromIndex ? "up" : fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex ? "down" : "neutral"; return <div key={`${flow.from}-${flow.to}`} className={tone}><span>{flow.fromLabel}</span><i>→</i><b>{flow.toLabel}</b><strong>{integer(flow.count)}</strong></div> })}</div>
            </article>
          </div>

          <footer><span>{tierAnalytics.definition}</span><em>{tierAnalytics.auxiliaryStates}</em>{selectedTierTransition.aboveSafira > 0 && <b>Atencao: {integer(selectedTierTransition.aboveSafira)} movimentos envolveram GMV acima de R$ 1 mi.</b>}</footer>
        </section>}
        </div>}

        {dashboardSection === "overview" && <div className="dashboard-surface" data-dashboard-section="overview">
        <section className="metric-grid">
          <Metric label="Creators observados" value={integer(summary.observedCreators ?? summary.activeCreators)} note={`${integer(summary.enteredCreators)} apareceram pela primeira vez no relatorio`} />
          <Metric label="Com formulario" value={percent(summary.formMatchRate)} note={`${integer(summary.matchedForms)} @ encontrados na Base de Creators`} tone="blue" />
          <Metric label="GMV observado" value={money(summary.gmv)} note="Somado do ledger diario por @, sem duplicidade" tone="cyan" />
          <Metric label="Receita Amplify" value={money(summary.estimatedAmplifyRevenue)} note="10% da comissao estimada do creator" tone="green" />
          {showPaid && <Metric label="CAC pago · media alocada" value={paid.acquiredCac == null ? "—" : money(paid.acquiredCac)} note={`${integer(paid.cohortCreators)} creators · Meta explicito + desconhecida assumida`} tone="amber" />}
          {showPaid && <Metric label="GMV Meta + tracking perdido" value={compactMoney(paid.gmv)} note={`${integer(paid.attributedCreators)} @ conferidos no ledger diario`} tone="rose" />}
        </section>

        {showPaid && <section className="paid-callout">
          <div><span>Investimento Meta</span><strong>{paid.spend == null ? "Meta sem resposta" : money(paid.spend)}</strong><p>{paid.allocation}</p><small>CPL plataforma {paid.leadCpl == null ? "—" : money(paid.leadCpl)} · {integer(paid.leads)} resultados</small></div>
          <div><span>GMV real dos @ Meta</span><strong>{money(paid.gmv)}</strong><small>{integer(paid.explicitMetaCreators)} Meta explicitos + {integer(paid.assumedTrackingLossCreators)} sem tracking · {ratio(paid.gmvPerRealInvested)} por R$ 1 investido</small></div>
          <div><span>Receita Amplify estimada</span><strong>{money(paid.estimatedAmplifyRevenue)}</strong><small>10% da comissao estimada · {ratio(paid.amplifyRevenuePerRealInvested)} por R$ 1 investido · resultado conhecido {money(paid.resultAfterKnownCosts)}</small></div>
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

        <section className="dashboard-table-card" data-dashboard-table="overview">
          <header><div><span>Detalhamento reativo</span><h2>Resumo mensal oficial</h2></div><small>{monthLabel(from)} a {monthLabel(to)}</small></header>
          <div className="dashboard-table-scroll"><table><thead><tr><th>Mes</th><th>Creators observados</th><th>Primeiras aparicoes</th><th>Retornos</th><th>Com formulario</th><th>GMV</th><th>Receita Amplify</th></tr></thead><tbody>{overviewTableRows.slice().reverse().map((row) => <tr key={row.month}><td>{monthLabel(row.month)}</td><td>{integer(row.activeCreators)}</td><td>{integer(row.enteredCreators)}</td><td>{integer(row.returnedCreators)}</td><td>{integer(row.matchedForms)}</td><td>{money(row.gmv)}</td><td><strong>{money(row.estimatedAmplifyRevenue)}</strong></td></tr>)}{overviewTableRows.length === 0 && <tr><td colSpan="7"><div className="dashboard-table-empty">Nenhum resultado para os filtros ativos.</div></td></tr>}</tbody></table></div>
        </section>
        </div>}

        {dashboardSection === "acquisition" && <div className="dashboard-surface" data-dashboard-section="acquisition">
        <section className="econ-panel source-panel">
          <header><div><span>Canal de origem</span><h2>Quem trouxe GMV, nao apenas lead</h2></div><small>Origem nao identificada entra em Meta por perda de tracking</small></header>
          <div className="source-table-wrap"><table className="source-table"><thead><tr><th>Origem</th><th>Creators observados</th><th>First-touch no periodo</th><th>Com formulario</th><th>GMV</th><th>Receita Amplify</th><th>LTV medio observado</th></tr></thead><tbody>{data.sourceBreakdown.map((row) => <tr key={row.key}><td><button onClick={() => { setSource(row.key); setPage(1) }}>{row.label}</button></td><td>{integer(row.creators)}</td><td>{integer(row.acquired)}</td><td>{percent(row.formMatchRate)}</td><td>{money(row.gmv)}</td><td><strong>{money(row.estimatedAmplifyRevenue)}</strong></td><td>{money(row.avgObservedLtv)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="econ-panel source-panel">
          <header><div><span>Base de aquisicao</span><h2>Nova IA versus operacao antiga</h2></div><small>AmplifyOS inclui apenas entradas nativas; imports legados foram excluidos</small></header>
          <div className="source-table-wrap"><table className="source-table"><thead><tr><th>Sistema first-touch</th><th>Creators observados</th><th>First-touch no periodo</th><th>Com formulario</th><th>GMV</th><th>Receita Amplify</th><th>LTV medio observado</th></tr></thead><tbody>{data.systemBreakdown.map((row) => <tr key={row.key}><td><span className="origin-tag">{row.label}</span></td><td>{integer(row.creators)}</td><td>{integer(row.acquired)}</td><td>{percent(row.formMatchRate)}</td><td>{money(row.gmv)}</td><td><strong>{money(row.estimatedAmplifyRevenue)}</strong></td><td>{money(row.avgObservedLtv)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="econ-panel creator-panel" data-dashboard-table="acquisition">
          <header className="creator-head"><div><span>Raio-X por creator</span><h2>Do @ ao retorno financeiro</h2></div><div className="creator-tools"><div className="search"><span>@</span><input aria-label="Buscar creator ou alias" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Buscar creator ou alias" /></div><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="revenue">Receita no periodo</option><option value="lifetime">LTV observado</option><option value="gmv">GMV no periodo</option><option value="days">Dias vinculados</option><option value="ltvCac">LTV / CAC</option><option value="handle">@ alfabetico</option></select></div></header>
          <div className="source-pills"><button className={source === "all" ? "active" : ""} onClick={() => { setSource("all"); setPage(1) }}>Todas as origens</button>{data.sourceOptions.map((item) => <button key={item.key} className={source === item.key ? "active" : ""} onClick={() => { setSource(item.key); setPage(1) }}>{item.label}<b>{integer(item.creators)}</b></button>)}</div>
          <div className="creator-table-wrap"><table className="creator-table"><thead><tr><th>Creator</th><th>Origem</th><th>Formulario</th><th>Dias</th><th>GMV periodo</th><th>Receita periodo</th><th>LTV observado</th><th>CAC alocado</th><th>LTV/CAC</th><th /></tr></thead><tbody>{data.creators.map((creator) => <FragmentRow key={creator.id} creator={creator} expanded={expanded === creator.id} onToggle={() => setExpanded(expanded === creator.id ? "" : creator.id)} />)}{data.creators.length === 0 && <tr><td colSpan="10"><div className="creator-empty"><strong>Nenhum creator ou alias encontrado.</strong><button onClick={() => setQueryDraft("")}>Limpar busca</button></div></td></tr>}</tbody></table></div>
          <footer className="pagination"><span>{integer(data.pagination.total)} creators encontrados</span><div><button disabled={data.pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Anterior</button><b>{data.pagination.page} / {data.pagination.pages}</b><button disabled={data.pagination.page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Proxima →</button></div></footer>
        </section>
        </div>}

        {dashboardSection === "overview" && <footer className="econ-method">
          <div><span>Agenciados por dia</span><p>{data.caveats[9]}</p></div><div><span>Saidas e GMV 30d</span><p>{data.caveats[10]} {data.caveats[11]}</p></div><div><span>Receita, nao lucro</span><p>{data.caveats[1]}</p></div><div><span>Identidade</span><p>{data.methodology.identity} {data.methodology.form}</p></div><div><span>CAC</span><p>{data.caveats[2]}</p></div><div><span>Indique / Super</span><p>{data.caveats[7]}</p></div><div><span>GMV por @</span><p>{data.caveats[8]}</p></div><div><span>Periodo e retorno</span><p>{data.caveats[5]} {data.caveats[6]}</p></div><div><span>Atualizacao</span><p>Snapshot gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}. Janela comum fechada de {date(data.period?.from)} a {date(data.period?.to)}.</p></div>
        </footer>}
      </>}
    </div>

    <style jsx global>{`
      .creator-dashboard-nav{position:sticky;top:72px;z-index:19;display:flex;gap:8px;margin:16px 0 24px;padding:8px;overflow-x:auto;overscroll-behavior-inline:contain;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(8,11,18,.94);box-shadow:0 14px 40px rgba(0,0,0,.3);backdrop-filter:blur(18px);scrollbar-width:thin}.creator-dashboard-nav button{min-width:146px;min-height:52px;display:grid;align-content:center;gap:3px;padding:8px 12px;border:1px solid transparent;border-radius:11px;background:transparent;color:#8B94A7;text-align:left;cursor:pointer;transition:.18s ease}.creator-dashboard-nav button:hover,.creator-dashboard-nav button:focus-visible{border-color:rgba(84,216,232,.32);color:#DCE5F3;outline:0}.creator-dashboard-nav button.active{border-color:rgba(84,216,232,.45);background:linear-gradient(135deg,rgba(84,216,232,.16),rgba(169,155,255,.09));color:#F7FAFF;box-shadow:inset 0 0 0 1px rgba(84,216,232,.08)}.creator-dashboard-nav span{font-size:11px;font-weight:800;white-space:nowrap}.creator-dashboard-nav small{color:#657086;font:600 8px ui-monospace,monospace;white-space:nowrap}.creator-dashboard-nav button.active small{color:#87A7AF}
      .dashboard-surface{animation:dashboardSurfaceIn .24s ease both;min-width:0}@keyframes dashboardSurfaceIn{from{opacity:.3;transform:translateY(5px)}to{opacity:1;transform:none}}
      .dashboard-table-card{margin:18px 0 24px;border:1px solid rgba(84,216,232,.2);border-radius:17px;background:linear-gradient(145deg,rgba(84,216,232,.045),#0A0E16 34%);overflow:hidden}.dashboard-table-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.dashboard-table-card>header span{display:block;color:#54D8E8;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em}.dashboard-table-card h2{margin:5px 0 0;color:#EEF3FA;font-size:20px;letter-spacing:-.025em}.dashboard-table-card>header small{color:#778195;font:600 9px ui-monospace,monospace}.dashboard-table-scroll{width:100%;max-height:520px;overflow:auto}.dashboard-table-scroll table{width:100%;min-width:820px;border-collapse:collapse}.dashboard-table-scroll th{position:sticky;top:0;z-index:2;padding:11px 14px;background:#0C111B;color:#727D91;font:750 8px ui-monospace,monospace;text-align:left;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}.dashboard-table-scroll td{padding:11px 14px;border-top:1px solid rgba(255,255,255,.055);color:#B9C0CE;font-size:10px;white-space:nowrap}.dashboard-table-scroll tr:hover td{background:rgba(84,216,232,.035)}.dashboard-table-scroll td strong{color:#F1F4F9}.dashboard-table-empty{min-height:130px;display:grid;place-items:center;color:#7E8799}
      .dashboard-selection-chip{min-height:44px;margin-top:8px;padding:8px 12px;border:1px solid rgba(84,216,232,.35);border-radius:999px;background:rgba(84,216,232,.09);color:#BFF8FF;font:750 9px ui-monospace,monospace;cursor:pointer}.dashboard-selection-chip:hover,.dashboard-selection-chip:focus-visible{border-color:#54D8E8;outline:0}
      .global-filter-chip{min-height:44px;padding:8px 13px;border:1px solid rgba(246,184,75,.42);border-radius:999px;background:rgba(246,184,75,.1);color:#FFD78F;font:750 9px ui-monospace,monospace;cursor:pointer}.global-filter-chip:hover,.global-filter-chip:focus-visible{border-color:#F6B84B;outline:2px solid transparent}.dashboard-table-scroll td>button{min-height:44px;border:0;background:transparent;color:#BFF8FF;font:inherit;font-weight:750;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.dashboard-table-scroll tr.selected td{background:rgba(84,216,232,.075)}
      .movement-split-grid,.movement-ranking-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.07)}.movement-split-grid>article,.movement-ranking-grid>article{min-width:0;border-right:1px solid rgba(255,255,255,.07)}.movement-split-grid>article:last-child,.movement-ranking-grid>article:last-child{border-right:0}.movement-split-grid article>header,.movement-ranking-grid article>header{padding:16px 18px 5px}.movement-split-grid article>header span,.movement-ranking-grid article>header span{color:#7C8698;font:750 8px ui-monospace,monospace;text-transform:uppercase}.movement-split-grid h3,.movement-ranking-grid h3{margin:5px 0 0;color:#EDF2F8;font-size:18px}.movement-split-chart{height:310px;padding:0 8px 14px}.movement-ranking-grid ol{list-style:none;margin:0;padding:8px 14px 16px;counter-reset:rank}.movement-ranking-grid li{counter-increment:rank}.movement-ranking-grid button{width:100%;min-height:44px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:8px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.055);background:transparent;color:#AEB6C5;text-align:left;cursor:pointer}.movement-ranking-grid button:before{content:counter(rank);display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.06);color:#737D90;font:700 9px ui-monospace,monospace}.movement-ranking-grid button:hover,.movement-ranking-grid button:focus-visible{background:rgba(84,216,232,.06);outline:0}.movement-ranking-grid button strong{color:#F1F4F9;font-size:11px}
      @media(max-width:820px){.creator-dashboard-nav{top:68px;margin-left:-4px;margin-right:-4px;border-radius:13px}.creator-dashboard-nav button{min-width:132px}.movement-split-grid,.movement-ranking-grid{grid-template-columns:1fr}.movement-split-grid>article,.movement-ranking-grid>article{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.dashboard-table-card>header{display:grid}.dashboard-table-card>header small{text-align:left}}
      @media(max-width:560px){.creator-dashboard-nav{padding:6px}.creator-dashboard-nav button{min-width:122px;min-height:48px;padding:7px 10px}.creator-dashboard-nav small{display:none}.movement-split-chart{height:285px}.dashboard-table-card{border-radius:14px}.dashboard-table-card>header{padding:16px}.dashboard-table-scroll td,.dashboard-table-scroll th{padding-left:11px;padding-right:11px}}
    `}</style>

    <style jsx global>{`
      :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#070910!important;color:#F4F6FF!important}.economics-page{min-height:100vh;background:radial-gradient(circle at 78% 4%,rgba(155,140,255,.13),transparent 28%),radial-gradient(circle at 12% 48%,rgba(49,87,255,.08),transparent 26%),#070910;font-family:Inter,system-ui,sans-serif}.econ-topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1480px)/2));border-bottom:1px solid rgba(255,255,255,.08);background:rgba(7,9,16,.86);backdrop-filter:blur(18px);position:sticky;top:0;z-index:20}.econ-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-weight:800}.econ-brand b{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3157FF 0 48%,#EA1A4E 48%);font-size:13px}.econ-brand small{color:#697185;font-family:ui-monospace,monospace;font-weight:500}.econ-back{color:#8E95A8;text-decoration:none;font-size:13px}.econ-wrap{max-width:1480px;margin:auto;padding:42px 24px 72px}.econ-hero{min-height:300px;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.45fr);gap:44px;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.econ-kicker{font:700 11px ui-monospace,monospace;letter-spacing:.17em;text-transform:uppercase;color:#A7AFC1}.econ-kicker i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#47D7A0;box-shadow:0 0 14px #47D7A0;margin-right:8px}.econ-hero h1{font-size:clamp(54px,7vw,94px);line-height:.88;letter-spacing:-.065em;margin:22px 0 24px}.econ-hero h1 em{font-style:normal;color:transparent;-webkit-text-stroke:1px rgba(244,246,255,.52)}.econ-hero p{max-width:760px;color:#969DAF;font-size:16px;line-height:1.65}.hero-formula{border:1px solid rgba(71,215,160,.3);background:linear-gradient(145deg,rgba(71,215,160,.13),rgba(14,18,28,.86));padding:28px;border-radius:20px;box-shadow:0 25px 70px rgba(0,0,0,.25)}.hero-formula>span{font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.12em;color:#74E4B8}.hero-formula>strong{display:block;font-size:76px;line-height:1;margin:16px 0 6px;letter-spacing:-.07em}.hero-formula p{font-size:13px;margin:0 0 14px;color:#C8D0DC}.hero-formula small{color:#6F788B}.econ-controls{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:18px 0}.month-control{display:flex;align-items:end;gap:10px}.month-control label{display:grid;gap:5px;color:#727B8E;font:700 9px ui-monospace;text-transform:uppercase}.month-control input,.creator-tools select{border:1px solid rgba(255,255,255,.1);background:#0E121C;color:#E8EBF3;border-radius:9px;padding:9px 11px;font:600 12px Inter}.month-control>span{padding-bottom:10px;color:#50586A}.trust-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.trust-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 10px;font:700 9px ui-monospace;text-transform:uppercase;color:#8D96A8;background:rgba(255,255,255,.025)}.trust-pill i{width:6px;height:6px;border-radius:50%}.trust-pill.ok i{background:#47D7A0;box-shadow:0 0 8px #47D7A0}.trust-pill.warn i{background:#F6B84B}.metric-grid{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid rgba(255,255,255,.09);border-radius:18px;overflow:hidden;background:#0B0E16}.econ-metric{padding:22px 18px;min-width:0;border-right:1px solid rgba(255,255,255,.07);box-shadow:inset 0 3px 0 var(--tone)}.econ-metric:last-child{border:0}.econ-metric.violet{--tone:#9B8CFF}.econ-metric.blue{--tone:#5A8CFF}.econ-metric.cyan{--tone:#39CFE2}.econ-metric.green{--tone:#47D7A0}.econ-metric.amber{--tone:#F6B84B}.econ-metric.rose{--tone:#FF6D8D}.econ-metric span,.paid-callout span{display:block;color:#7D8598;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.1em}.econ-metric strong{display:block;margin:10px 0 7px;font-size:clamp(19px,1.7vw,27px);letter-spacing:-.045em;white-space:nowrap}.econ-metric small{color:#626B7D;font-size:10px;line-height:1.4}.paid-callout{margin:14px 0 18px;display:grid;grid-template-columns:1.6fr .7fr .8fr;border:1px solid rgba(246,184,75,.18);background:rgba(246,184,75,.045);border-radius:14px;overflow:hidden}.paid-callout>div{padding:17px 20px;border-right:1px solid rgba(255,255,255,.06)}.paid-callout>div:last-child{border:0}.paid-callout strong{display:block;margin:7px 0 4px;font-size:17px}.paid-callout p,.paid-callout small{margin:0;color:#727B8D;font-size:10px;line-height:1.5}.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.econ-panel{border:1px solid rgba(255,255,255,.09);background:#0B0E16;border-radius:18px;overflow:hidden}.econ-panel>header{display:flex;justify-content:space-between;align-items:end;gap:20px;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.07)}.econ-panel>header span{color:#8B94A8;font:700 9px ui-monospace;text-transform:uppercase;letter-spacing:.11em}.econ-panel h2{margin:7px 0 0;font-size:23px;letter-spacing:-.035em}.econ-panel>header small{max-width:310px;color:#687185;font-size:10px;text-align:right;line-height:1.45}.chart-box{height:330px;padding:12px 9px 18px}.chart-tip{min-width:170px;padding:12px;background:#10151F;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.4)}.chart-tip>strong{display:block;margin-bottom:7px}.chart-tip>div{display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:7px;color:#8F98AA;font-size:10px;padding:3px 0}.chart-tip i{width:7px;height:7px;border-radius:2px}.chart-tip b{color:#F3F5FA}.source-panel,.creator-panel{margin-top:16px}.source-table-wrap,.creator-table-wrap{overflow:auto}.source-table,.creator-table{width:100%;border-collapse:collapse;white-space:nowrap}.source-table th,.creator-table th{text-align:right;color:#626B7E;font:700 8px ui-monospace;text-transform:uppercase;letter-spacing:.08em;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.07)}.source-table th:first-child,.source-table td:first-child,.creator-table th:first-child,.creator-table td:first-child{text-align:left}.source-table td,.creator-table td{text-align:right;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.055);font-size:11px;color:#A8B0BF}.source-table tr:hover td,.creator-table tr.creator-row:hover td{background:rgba(255,255,255,.022)}.source-table button{border:0;background:transparent;color:#F0F2F7;font-weight:750;cursor:pointer}.creator-head{align-items:center!important}.creator-tools{display:flex;gap:8px}.search{display:flex;align-items:center;border:1px solid rgba(255,255,255,.1);background:#0E121C;border-radius:9px;padding:0 10px;color:#6C7588}.search input{width:210px;border:0;outline:0;background:transparent;color:#fff;padding:10px 7px}.source-pills{display:flex;gap:7px;padding:14px 16px;overflow:auto;border-bottom:1px solid rgba(255,255,255,.07)}.source-pills button{flex:0 0 auto;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02);color:#7F889B;border-radius:999px;padding:7px 10px;font:700 9px Inter;cursor:pointer}.source-pills button.active{border-color:rgba(155,140,255,.45);background:rgba(155,140,255,.12);color:#C9C1FF}.source-pills b{margin-left:7px;color:#555F73}.creator-name{display:flex;align-items:center;gap:9px}.creator-name i{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:rgba(155,140,255,.1);color:#AA9EFF;font-style:normal;font-weight:850}.creator-name strong{color:#F2F4F8}.origin-tag,.form-tag{display:inline-flex;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 8px;color:#9DA6B6;font-size:9px}.form-tag.yes{color:#74E4B8;border-color:rgba(71,215,160,.22);background:rgba(71,215,160,.06)}.return-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#F6B84B;margin-left:5px}.expand-button{width:28px;height:28px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#8C95A8;border-radius:8px;cursor:pointer}.creator-detail-cell{padding:0!important;text-align:left!important;background:#090C13}.creator-detail{padding:18px 20px 22px}.detail-evidence{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.detail-evidence>div{min-width:0;padding:13px;border:1px solid rgba(255,255,255,.07);background:#0D111A;border-radius:10px}.detail-evidence span{display:block;color:#697286;font:700 8px ui-monospace;text-transform:uppercase}.detail-evidence strong{display:block;margin:6px 0 4px;font-size:12px}.detail-evidence small{display:block;color:#7B8497;font-size:9px;line-height:1.5;overflow-wrap:anywhere;white-space:normal}.month-tape{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px;margin-top:10px}.month-tape>div{position:relative;overflow:hidden;padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:9px}.month-tape span,.month-tape small{display:block;color:#6E7789;font-size:8px}.month-tape strong{display:block;margin:5px 0;font-size:11px}.month-tape i{position:absolute;left:0;bottom:0;height:2px;background:#47D7A0}.pagination{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;color:#70798B;font-size:10px}.pagination>div{display:flex;align-items:center;gap:12px}.pagination button{border:1px solid rgba(255,255,255,.09);background:#0E121C;color:#AEB5C2;border-radius:8px;padding:8px 10px;cursor:pointer}.pagination button:disabled{opacity:.35;cursor:not-allowed}.econ-method{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden}.econ-method>div{background:#090C13;padding:17px}.econ-method span{color:#8B94A8;font:700 8px ui-monospace;text-transform:uppercase}.econ-method p{margin:7px 0 0;color:#697286;font-size:9px;line-height:1.55}.econ-loading,.econ-error{min-height:280px;display:grid;place-items:center;align-content:center;gap:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;color:#858EA1}.econ-loading i{width:24px;height:24px;border:2px solid rgba(255,255,255,.12);border-top-color:#9B8CFF;border-radius:50%;animation:spin .8s linear infinite}.econ-error strong{color:#FF809A}@keyframes spin{to{transform:rotate(360deg)}}
      .movement-section{margin:0 0 16px;border-color:rgba(255,100,124,.18);background:linear-gradient(150deg,rgba(255,100,124,.055),#0B0E16 30%)}.movement-head-side{display:grid;justify-items:end;gap:10px;max-width:430px}.view-switch{display:flex;gap:4px;padding:3px;border:1px solid rgba(255,255,255,.08);background:#0A0D14;border-radius:9px}.view-switch button{border:0;background:transparent;color:#697286;border-radius:6px;padding:6px 10px;font:700 9px ui-monospace,monospace;cursor:pointer}.view-switch button.active{background:rgba(255,100,124,.14);color:#FF9AAC}.movement-kpis{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.movement-kpis>div{padding:18px 17px;border-right:1px solid rgba(255,255,255,.065)}.movement-kpis>div:last-child{border:0}.movement-kpis span,.month-health span{display:block;color:#7D8598;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.movement-kpis strong{display:block;margin:8px 0 5px;font-size:22px;letter-spacing:-.04em;white-space:nowrap}.movement-kpis strong.positive{color:#47D7A0}.movement-kpis strong.negative{color:#FF647C}.movement-kpis small{display:block;color:#626B7D;font-size:9px;line-height:1.4}.movement-chart{height:390px;padding:10px 12px 17px}.movement-section>footer{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:13px 23px;border-top:1px solid rgba(255,255,255,.07);color:#6F788B;font-size:9px;line-height:1.5}.movement-section>footer b{font-weight:500;color:#9A7D84}.movement-section>footer em{grid-column:1/-1;color:#F6B84B;font-style:normal}.movement-kpis.movement-kpis-exits{grid-template-columns:repeat(2,minmax(0,1fr))}.movement-kpis-exits>div:nth-child(2){border-right:0}.movement-chart{cursor:crosshair}.exit-day-drilldown{border-top:1px solid rgba(255,255,255,.07);background:rgba(5,8,14,.5)}.exit-day-drilldown>header{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.07)}.exit-day-drilldown>header>div:first-child span{display:block;color:#FF9AAC;font:700 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em}.exit-day-drilldown>header h3{margin:5px 0 0;font-size:24px;letter-spacing:-.04em}.exit-day-drilldown>header>div:last-child{display:grid;grid-template-columns:auto auto;align-items:baseline;column-gap:8px;row-gap:2px;text-align:right}.exit-day-drilldown>header>div:last-child strong{color:#FF647C;font-size:20px}.exit-day-drilldown>header>div:last-child b{color:#F4F6FF;font-size:14px}.exit-day-drilldown>header>div:last-child span,.exit-day-drilldown>header>div:last-child small{color:#7D8598;font-size:9px}.exit-creators-table-wrap{max-height:520px;overflow:auto}.exit-creators-table{width:100%;border-collapse:collapse}.exit-creators-table th{position:sticky;top:0;z-index:1;background:#0D1018;color:#727B8D;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:11px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.exit-creators-table th:first-child,.exit-creators-table td:first-child{width:52px;text-align:center}.exit-creators-table th:last-child,.exit-creators-table td:last-child{text-align:right}.exit-creators-table td{padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.055);font-size:12px}.exit-creators-table tbody tr:hover{background:rgba(255,100,124,.045)}.exit-creators-table td:nth-child(1){color:#626B7D;font:700 10px ui-monospace,monospace}.exit-creators-table td:nth-child(2) strong{display:block;color:#F2F4FA}.exit-creators-table td:nth-child(2) small{display:block;margin-top:3px;color:#626B7D;font:500 8px ui-monospace,monospace}.exit-creators-table td:last-child{color:#FFB0BC;font-weight:750;font-variant-numeric:tabular-nums}.exit-creators-empty{padding:34px 24px;text-align:center;color:#747D90;font-size:12px}.portfolio-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(440px,.92fr);gap:16px;margin-bottom:20px}.portfolio-chart{height:410px;padding:12px 12px 20px}.monthly-ranking>header select{border:1px solid rgba(255,255,255,.11);background:#10141E;color:#F3F5FA;border-radius:9px;padding:9px 11px;font:700 11px Inter}.month-health{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.month-health>div{padding:15px 14px;border-right:1px solid rgba(255,255,255,.06)}.month-health>div:last-child{border:0}.month-health strong{display:block;margin-top:7px;font-size:18px;white-space:nowrap}.ranking-wrap{overflow:auto;max-height:342px}.monthly-ranking-table{width:100%;border-collapse:collapse;white-space:nowrap}.monthly-ranking-table th{text-align:right;color:#626B7E;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.07);position:sticky;top:0;background:#0B0E16;z-index:1}.monthly-ranking-table th:nth-child(2),.monthly-ranking-table td:nth-child(2){text-align:left}.monthly-ranking-table td{text-align:right;padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.05);font-size:10px;color:#98A1B1}.monthly-ranking-table td:first-child{color:#555E70}.monthly-ranking-table button{border:0;background:transparent;color:#E9ECF5;font-weight:750;cursor:pointer;padding:0}.monthly-ranking-table button:hover{color:#A99BFF}.monthly-ranking-table strong{color:#F3F5FA}
      .affiliation-daily{margin:26px 0 22px;border:1px solid rgba(169,155,255,.24);border-radius:18px;background:linear-gradient(145deg,rgba(169,155,255,.09),rgba(12,15,24,.92) 34%,rgba(8,11,18,.96));overflow:hidden;position:relative;box-shadow:0 22px 55px rgba(0,0,0,.22)}.affiliation-daily:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#A99BFF,#54D8E8)}.affiliation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:24px 26px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-kicker{display:block;color:#A99BFF;font:700 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:7px}.affiliation-head h2{margin:0;color:#F7F5FF;font-size:28px;letter-spacing:-.035em}.affiliation-head p{margin:8px 0 0;color:#858DA0;font-size:12px}.ledger-status{display:flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 11px;color:#AEB5C6;font:700 10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em}.ledger-status i{width:7px;height:7px;border-radius:50%}.ledger-status.ok i{background:#47D7A0;box-shadow:0 0 12px #47D7A0}.ledger-status.warn i{background:#FFB84B}.affiliation-layout{display:grid;grid-template-columns:240px 280px minmax(0,1fr);min-height:350px}.affiliation-latest{padding:27px 25px;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;justify-content:center}.affiliation-latest>span,.affiliation-stats span{color:#7F8799;font:700 10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.affiliation-latest>strong{font-size:64px;line-height:.96;letter-spacing:-.07em;margin:16px 0 13px;color:#F8F7FF}.affiliation-latest b{font-size:17px}.affiliation-latest b.up{color:#47D7A0}.affiliation-latest b.down{color:#FF647C}.affiliation-latest small{color:#7F8799}.affiliation-latest p{margin:28px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.07);color:#727B8E;font-size:11px;line-height:1.5}.affiliation-stats{display:grid;grid-template-columns:1fr 1fr;border-right:1px solid rgba(255,255,255,.07)}.affiliation-stats>div{padding:22px 18px;border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.affiliation-stats>div:nth-child(2n){border-right:0}.affiliation-stats>div:nth-last-child(-n+2){border-bottom:0}.affiliation-stats strong{display:block;font-size:26px;margin:10px 0 8px;letter-spacing:-.045em}.affiliation-stats small{color:#666F82;font-size:10px}.affiliation-chart{height:350px;padding:10px 12px 18px;min-width:0}.affiliation-daily>footer{display:flex;justify-content:space-between;gap:16px;padding:12px 25px;border-top:1px solid rgba(255,255,255,.07);color:#6C7486;font:500 9px ui-monospace,monospace}.affiliation-daily>footer b{color:#F6B84B;font-weight:600}
      .affiliation-gmv-copy{margin:-6px 0 22px;border:1px solid rgba(246,184,75,.22);border-radius:18px;background:linear-gradient(145deg,rgba(246,184,75,.055),rgba(12,15,24,.94) 30%,rgba(8,11,18,.97));overflow:hidden;position:relative}.affiliation-gmv-copy:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#A99BFF,#54D8E8 52%,#F6B84B)}.affiliation-gmv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:22px 26px 18px;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-gmv-head h2{margin:0;color:#F7F5FF;font-size:25px;letter-spacing:-.035em}.affiliation-gmv-head p{margin:8px 0 0;color:#858DA0;font-size:12px}.daily-gmv-latest{text-align:right;min-width:210px}.daily-gmv-latest span{display:block;color:#947A4D;font:700 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.daily-gmv-latest strong{display:block;color:#F6B84B;font-size:27px;letter-spacing:-.045em;margin:6px 0 3px}.daily-gmv-latest small{color:#737B8D;font-size:9px}.affiliation-gmv-chart{height:420px;padding:10px 14px 22px;min-width:0}.affiliation-gmv-copy>footer{display:flex;justify-content:space-between;gap:16px;padding:12px 25px;border-top:1px solid rgba(255,255,255,.07);color:#70788A;font:500 9px ui-monospace,monospace}.affiliation-gmv-copy>footer b{color:#BFC5D2}.affiliation-gmv-copy>footer em{font-style:normal;color:#C79B4A}
      .affiliation-movement-copy{margin:-6px 0 22px;border:1px solid rgba(71,215,160,.2);border-radius:18px;background:linear-gradient(145deg,rgba(71,215,160,.045),rgba(12,15,24,.94) 30%,rgba(8,11,18,.97));overflow:hidden;position:relative}.affiliation-movement-copy:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#A99BFF,#47D7A0 52%,#FF647C)}.affiliation-movement-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:22px 26px 18px;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-movement-head h2{margin:0;color:#F7F5FF;font-size:25px;letter-spacing:-.035em}.affiliation-movement-head p{margin:8px 0 0;color:#858DA0;font-size:12px}.daily-movement-latest{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:360px}.daily-movement-latest>div{padding:10px 12px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(7,10,16,.45)}.daily-movement-latest span{display:block;color:#788194;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}.daily-movement-latest strong{display:block;margin-top:6px;font-size:20px}.daily-movement-latest strong.positive{color:#47D7A0}.daily-movement-latest strong.negative{color:#FF647C}.affiliation-movement-chart{height:420px;padding:10px 14px 22px;min-width:0}.affiliation-movement-copy>footer{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:12px 25px;border-top:1px solid rgba(255,255,255,.07);color:#70788A;font:500 9px ui-monospace,monospace}.affiliation-movement-copy>footer b{color:#BFC5D2}.affiliation-movement-copy>footer em{grid-column:1/-1;font-style:normal;color:#9A7D84}
      .profitability-section{margin:26px 0 22px;border:1px solid rgba(71,215,160,.25);border-radius:20px;background:linear-gradient(150deg,rgba(71,215,160,.07),rgba(10,13,20,.98) 24%,rgba(7,10,16,.99));overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(0,0,0,.28)}.profitability-section:before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:linear-gradient(90deg,#47D7A0 0 34%,#A99BFF 34% 68%,#F6B84B 68%)}.profitability-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.profit-kicker{display:block;color:#47D7A0;font:750 10px ui-monospace,monospace;letter-spacing:.17em;text-transform:uppercase;margin-bottom:8px}.profitability-head h2{margin:0;color:#F7F8FC;font-size:30px;letter-spacing:-.04em;max-width:760px}.profitability-head p{margin:9px 0 0;color:#8790A1;font-size:12px}.profit-coverage{display:grid;grid-template-columns:10px 1fr;gap:4px 8px;min-width:210px;padding:12px 14px;border:1px solid rgba(246,184,75,.2);border-radius:12px;background:rgba(246,184,75,.045)}.profit-coverage i{grid-row:1/4;width:8px;height:8px;margin-top:3px;border-radius:50%;background:#F6B84B;box-shadow:0 0 14px rgba(246,184,75,.65)}.profit-coverage span{color:#F6B84B;font:750 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.profit-coverage b{color:#E9EDF5;font-size:12px}.profit-coverage small{color:#737C8E;font-size:9px}.profit-summary{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.profit-summary>div{padding:20px 20px 18px;border-right:1px solid rgba(255,255,255,.065)}.profit-summary>div:last-child{border-right:0}.profit-summary span{display:block;min-height:24px;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.profit-summary strong{display:block;margin:8px 0 6px;font-size:25px;letter-spacing:-.045em;white-space:nowrap;color:#F3F5FA}.profit-summary strong.cost{color:#F6B84B}.profit-summary strong.result-positive{color:#47D7A0}.profit-summary strong.result-negative{color:#FF647C}.profit-summary small{color:#687184;font-size:9px;line-height:1.4}.profit-warning{margin:16px 20px 0;padding:11px 14px;border:1px solid rgba(246,184,75,.18);border-radius:10px;background:rgba(246,184,75,.045);color:#9A8462;font:550 10px ui-monospace,monospace;line-height:1.5}.profit-warning b{color:#F6B84B}.profit-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 20px 20px}.profit-card{min-width:0;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(8,11,17,.76);overflow:hidden}.profit-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:17px 19px 14px;border-bottom:1px solid rgba(255,255,255,.065)}.profit-card>header span{display:block;color:#778195;font:750 8px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.profit-card h3{margin:5px 0 0;color:#EDF1F8;font-size:18px;letter-spacing:-.025em}.profit-card>header small{max-width:210px;color:#697285;font-size:9px;text-align:right;line-height:1.45}.profit-daily-chart,.profit-origin-card{grid-column:1/-1}.profit-chart{height:340px;padding:7px 12px 17px}.profit-chart-wide{height:390px}.profit-origin-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);min-height:420px}.profit-origin-chart{height:420px;padding:10px 8px 18px;border-right:1px solid rgba(255,255,255,.065)}.origin-profit-table{display:grid;align-content:start;max-height:420px;overflow:auto}.origin-profit-table>div{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:5px 12px;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.055)}.origin-profit-table span{color:#DDE2EB;font-size:10px;font-weight:700}.origin-profit-table strong{color:#A99BFF;font-size:11px;text-align:right}.origin-profit-table b,.origin-profit-table em{font-size:8px;font-style:normal}.origin-profit-table b{color:#F6B84B}.origin-profit-table b.pending{color:#7B8394}.origin-profit-table em{color:#697285;text-align:right}.cost-registry{margin:0 20px 20px;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden}.cost-registry>header{display:flex;justify-content:space-between;gap:16px;padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018)}.cost-registry>header span{color:#A9B1C0;font:750 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.cost-registry>header b{color:#7B8495;font-size:9px}.cost-registry>div{display:grid;grid-template-columns:repeat(4,1fr)}.cost-registry article{position:relative;padding:16px 15px;border-right:1px solid rgba(255,255,255,.06)}.cost-registry article:last-child{border-right:0}.cost-registry article i{position:absolute;right:12px;top:13px;width:7px;height:7px;border-radius:50%;background:#555E70}.cost-registry article.observed i{background:#47D7A0;box-shadow:0 0 12px rgba(71,215,160,.55)}.cost-registry article.unavailable i{background:#FF647C}.cost-registry article>span{display:block;color:#7F899A;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.07em}.cost-registry article strong{display:block;margin:8px 0 5px;color:#DDE2EB;font-size:14px}.cost-registry article.observed strong{color:#47D7A0}.cost-registry article small{color:#626B7D;font-size:8px}.profitability-section>footer{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:13px 24px;border-top:1px solid rgba(255,255,255,.07);color:#70798B;font:500 9px ui-monospace,monospace;line-height:1.5}.profitability-section>footer b{grid-column:1/-1;color:#A18A68;font-weight:500}.profitability-section>footer em{grid-column:1/-1;color:#F6B84B;font-style:normal}
      @media(max-width:1180px){.movement-kpis{grid-template-columns:repeat(3,1fr)}.movement-kpis>div:nth-child(3n){border-right:0}.movement-kpis>div:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.06)}.portfolio-grid{grid-template-columns:1fr}.affiliation-layout{grid-template-columns:260px 1fr}.affiliation-stats{border-right:0}.affiliation-chart{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.07)}.metric-grid{grid-template-columns:repeat(3,1fr)}.econ-metric:nth-child(3){border-right:0}.econ-metric:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.07)}.detail-evidence{grid-template-columns:1fr 1fr}.econ-method{grid-template-columns:1fr 1fr}}
      @media(max-width:820px){.movement-section>header{display:grid}.movement-head-side{justify-items:start}.movement-head-side small{text-align:left!important}.movement-kpis{grid-template-columns:1fr 1fr}.movement-kpis>div{border-right:1px solid rgba(255,255,255,.06)!important;border-bottom:1px solid rgba(255,255,255,.06)!important}.movement-kpis>div:nth-child(2n){border-right:0!important}.movement-kpis>div:nth-last-child(-n+2){border-bottom:0!important}.movement-section>footer{grid-template-columns:1fr}.movement-section>footer em{grid-column:auto}.portfolio-chart{height:340px}.affiliation-head,.affiliation-gmv-head,.affiliation-movement-head{display:grid}.daily-gmv-latest{text-align:left;min-width:0}.daily-movement-latest{min-width:0;width:100%}.affiliation-layout{grid-template-columns:1fr}.affiliation-latest{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-stats{border-bottom:1px solid rgba(255,255,255,.07)}.affiliation-chart{grid-column:auto}.affiliation-daily>footer,.affiliation-gmv-copy>footer,.affiliation-movement-copy>footer{display:grid;grid-template-columns:1fr}.affiliation-movement-copy>footer em{grid-column:auto}.econ-hero{grid-template-columns:1fr;padding-bottom:30px}.hero-formula{max-width:420px}.chart-grid{grid-template-columns:1fr}.paid-callout{grid-template-columns:1fr}.paid-callout>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.econ-controls,.creator-head{align-items:flex-start!important;display:grid!important}.trust-row{justify-content:flex-start}.creator-tools{width:100%}.search{flex:1}.search input{width:100%}.detail-evidence{grid-template-columns:1fr}.econ-method{grid-template-columns:1fr}.econ-brand small{display:none}}
      .creator-empty{min-height:150px;display:grid;place-items:center;align-content:center;gap:12px;color:#969DAF}.creator-empty button{border:1px solid rgba(155,140,255,.4);background:rgba(155,140,255,.12);color:#F4F6FF;border-radius:8px;padding:8px 12px;cursor:pointer}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"]{top:11px!important;bottom:auto!important;right:max(150px,calc((100vw - 1480px)/2 + 150px))!important;width:42px;height:42px;padding:0!important;justify-content:center;font-size:0!important;opacity:.86}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"] span{font-size:14px!important}
      @media(max-width:560px){.econ-topbar{background:#070910;backdrop-filter:none}.creator-dashboard-nav{position:relative;top:auto;margin-left:0;margin-right:0}.movement-kpis>div{padding:15px 11px}.movement-kpis strong{font-size:19px}.movement-chart{height:315px;padding-left:2px;padding-right:2px}.movement-section>footer{padding:12px 16px}.month-health{grid-template-columns:1fr 1fr}.month-health>div:nth-child(2){border-right:0}.month-health>div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.06)}.month-health strong{font-size:16px}.monthly-ranking>header{align-items:flex-start!important}.affiliation-head,.affiliation-gmv-head,.affiliation-movement-head{padding:20px 17px}.ledger-status{white-space:normal;width:max-content;max-width:100%}.affiliation-latest{padding:24px 19px}.affiliation-latest>strong{font-size:58px}.affiliation-stats>div{padding:18px 12px}.affiliation-chart{height:285px;padding-left:0}.affiliation-gmv-chart,.affiliation-movement-chart{height:340px;padding:8px 0 18px}.affiliation-daily>footer,.affiliation-gmv-copy>footer,.affiliation-movement-copy>footer{padding:11px 17px}.daily-movement-latest{grid-template-columns:1fr 1fr}.daily-movement-latest strong{font-size:17px}.econ-wrap{padding:28px 12px 50px}.econ-topbar{padding:0 14px}.econ-back{font-size:10px}.econ-hero h1{font-size:52px}.metric-grid{grid-template-columns:1fr 1fr}.econ-metric:nth-child(3){border-right:1px solid rgba(255,255,255,.07)}.econ-metric:nth-child(2n){border-right:0}.econ-metric:nth-child(-n+4){border-bottom:1px solid rgba(255,255,255,.07)}.month-control{width:100%}.month-control label{flex:1}.month-control input{width:100%}.creator-tools{display:grid}.chart-box{height:290px}.econ-panel>header{padding:19px 16px}.econ-panel h2{font-size:20px}body:has(.economics-page) a[aria-label="Abrir formulário de report de bugs"]{display:none!important}}
      .origin-profit-table small{display:block;color:#8E97AA;font-size:10px;line-height:1.35;margin-top:2px}
      @media(max-width:1180px){.profit-origin-layout{grid-template-columns:1fr}.profit-origin-chart{border-right:0;border-bottom:1px solid rgba(255,255,255,.065)}.origin-profit-table{grid-template-columns:1fr 1fr;max-height:none}.origin-profit-table>div:nth-child(odd){border-right:1px solid rgba(255,255,255,.055)}}
      @media(max-width:820px){.profitability-head{display:grid}.profit-coverage{min-width:0;width:max-content}.profit-summary{grid-template-columns:1fr 1fr}.profit-summary>div{border-bottom:1px solid rgba(255,255,255,.065)}.profit-summary>div:nth-child(2n){border-right:0}.profit-summary>div:nth-last-child(-n+2){border-bottom:0}.profit-chart-grid{grid-template-columns:1fr}.profit-daily-chart,.profit-origin-card{grid-column:auto}.profit-card>header{display:grid}.profit-card>header small{text-align:left}.profitability-section>footer{grid-template-columns:1fr}.profitability-section>footer b,.profitability-section>footer em{grid-column:auto}.cost-registry>div{grid-template-columns:1fr 1fr}.cost-registry article:nth-child(2){border-right:0}.cost-registry article:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.06)}}
      @media(max-width:560px){.profitability-head{padding:23px 17px 18px}.profitability-head h2{font-size:25px}.profit-summary>div{padding:16px 12px}.profit-summary strong{font-size:19px}.profit-summary span{min-height:30px}.profit-warning{margin:12px 12px 0}.profit-chart-grid{padding:12px;gap:12px}.profit-card>header{padding:15px 14px 12px}.profit-card h3{font-size:17px}.profit-chart,.profit-chart-wide{height:330px;padding-left:0;padding-right:0}.profit-origin-chart{height:390px;padding-left:0;padding-right:0}.profit-origin-layout{min-height:0}.origin-profit-table{grid-template-columns:1fr}.origin-profit-table>div:nth-child(odd){border-right:0}.cost-registry{margin:0 12px 14px}.cost-registry>header{display:grid}.cost-registry>div{grid-template-columns:1fr}.cost-registry article{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.cost-registry article:last-child{border-bottom:0}.profitability-section>footer{padding:12px 16px}}
    `}</style>
    <style jsx global>{`
      .efficiency-trend-copy{margin:-6px 0 22px;border:1px solid rgba(84,216,232,.23);border-radius:18px;background:linear-gradient(145deg,rgba(84,216,232,.055),rgba(12,15,24,.94) 30%,rgba(8,11,18,.97));overflow:hidden;position:relative}.efficiency-trend-copy:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#54D8E8,#F6B84B)}.efficiency-trend-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:22px 26px 18px;border-bottom:1px solid rgba(255,255,255,.07)}.efficiency-trend-head h2{margin:0;color:#F7F5FF;font-size:25px;letter-spacing:-.035em}.efficiency-trend-head p{margin:8px 0 0;color:#858DA0;font-size:12px}.efficiency-latest{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:430px}.efficiency-latest>div{padding:10px 12px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(7,10,16,.45)}.efficiency-latest span{display:block;color:#788194;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}.efficiency-latest strong{display:block;margin:6px 0 3px;font-size:21px}.efficiency-latest>div:first-child strong{color:#54D8E8}.efficiency-latest>div:last-child strong{color:#F6B84B}.efficiency-latest small{color:#737B8D;font-size:9px}.efficiency-trend-chart{height:420px;padding:10px 14px 22px;min-width:0}.efficiency-trend-copy>footer{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:12px 25px;border-top:1px solid rgba(255,255,255,.07);color:#70788A;font:500 9px ui-monospace,monospace}.efficiency-trend-copy>footer b{color:#BFC5D2}.efficiency-trend-copy>footer em{grid-column:1/-1;font-style:normal;color:#A88A55}
      .lag-forecast-section{margin:26px 0 22px;border:1px solid rgba(169,155,255,.24);border-radius:20px;background:linear-gradient(150deg,rgba(169,155,255,.075),rgba(10,13,20,.98) 24%,rgba(7,10,16,.99));overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(0,0,0,.27)}.lag-forecast-section:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#A99BFF,#54D8E8 48%,#F6B84B)}.lag-forecast-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.lag-kicker{display:block;color:#B9ADFF;font:750 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}.lag-forecast-head h2{margin:0;color:#F7F8FC;font-size:30px;letter-spacing:-.04em;max-width:820px}.lag-forecast-head p{margin:9px 0 0;color:#8790A1;font-size:12px}.lag-model-pill{min-width:205px;padding:12px 14px;border:1px solid rgba(169,155,255,.2);border-radius:12px;background:rgba(169,155,255,.055)}.lag-model-pill span{display:block;color:#9287D0;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.lag-model-pill strong{display:block;margin:5px 0 2px;color:#D8D1FF;font-size:20px}.lag-model-pill small{color:#737C8E;font-size:9px}.lag-answer-grid{display:grid;grid-template-columns:1.45fr repeat(3,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.lag-answer{padding:20px;border-right:1px solid rgba(255,255,255,.06);min-width:0}.lag-answer:last-child{border:0}.lag-answer.main{background:linear-gradient(135deg,rgba(169,155,255,.08),transparent)}.lag-answer span,.lag-forecast-summary span,.drawdown-stats span{display:block;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.lag-answer strong{display:block;margin:8px 0 7px;font-size:22px;letter-spacing:-.04em;color:#F4F5FA}.lag-answer:not(.main) strong{color:#54D8E8;font-size:26px}.lag-answer p{margin:0;color:#788195;font-size:10px;line-height:1.55}.lag-answer p b{color:#C9CED9}.lag-forecast-summary{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.lag-forecast-summary>div{padding:19px 20px;border-right:1px solid rgba(255,255,255,.06)}.lag-forecast-summary>div:last-child{border:0}.lag-forecast-summary strong{display:block;margin:8px 0 5px;color:#F2F4FA;font-size:25px;letter-spacing:-.045em;white-space:nowrap}.lag-forecast-summary>div:first-child strong{color:#C6B9FF}.lag-forecast-summary>div:nth-child(2) strong{color:#F6B84B}.lag-forecast-summary small{display:block;color:#6F788B;font-size:9px;line-height:1.45}.lag-chart-card{min-width:0;background:rgba(8,11,18,.58)}.forecast-card{border-bottom:1px solid rgba(255,255,255,.07)}.lag-chart-title{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:19px 21px 8px}.lag-chart-title span{display:block;color:#8E83CD;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.lag-chart-title h3{margin:5px 0 0;font-size:19px;letter-spacing:-.025em}.lag-chart-title>small{color:#717A8D;font-size:9px;text-align:right;line-height:1.45}.lag-forecast-chart{height:400px;padding:6px 14px 20px;min-width:0}.lag-chart-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.07)}.lag-chart-grid>.lag-chart-card:first-child{border-right:1px solid rgba(255,255,255,.07)}.lag-small-chart{height:330px;padding:3px 10px 18px;min-width:0}.lag-chart-card>footer{display:grid;gap:5px;padding:11px 20px;border-top:1px solid rgba(255,255,255,.06);color:#717A8D;font-size:9px;line-height:1.45}.lag-chart-card>footer b{color:#BEC4D0}.lag-chart-card>footer em{font-style:normal;color:#A88A55}.lag-pattern-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(380px,.8fr);border-bottom:1px solid rgba(255,255,255,.07)}.cohort-card{border-right:1px solid rgba(255,255,255,.07)}.cohort-chart{height:350px}.drawdown-card{padding:24px;background:linear-gradient(145deg,rgba(255,100,124,.055),transparent)}.drawdown-kicker{display:block;color:#FF8A9E;font:750 9px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.drawdown-card h3{margin:10px 0 19px;font-size:23px;line-height:1.12;letter-spacing:-.035em}.drawdown-stats{display:grid;grid-template-columns:1fr 1fr;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden}.drawdown-stats>div{padding:13px;border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.drawdown-stats>div:nth-child(2n){border-right:0}.drawdown-stats>div:nth-last-child(-n+2){border-bottom:0}.drawdown-stats strong{display:block;margin:7px 0 4px;color:#F1F3F8;font-size:17px;letter-spacing:-.035em}.drawdown-stats small{color:#6F788B;font-size:8px;line-height:1.35}.drawdown-card>p{margin:18px 0 0;color:#828B9D;font-size:11px;line-height:1.65}.drawdown-card>p b{color:#D3D7E0}.lag-method-note{margin:16px 20px 20px;padding:12px 14px;border:1px solid rgba(246,184,75,.16);border-radius:10px;background:rgba(246,184,75,.035);color:#817A69;font-size:10px;line-height:1.55}.lag-method-note b{color:#F6B84B}
      .tier-transition-section{margin:26px 0 22px;border:1px solid rgba(98,216,255,.22);border-radius:20px;background:linear-gradient(150deg,rgba(98,216,255,.06),rgba(10,13,20,.98) 22%,rgba(7,10,16,.99));overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(0,0,0,.26)}.tier-transition-section:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#7D8A9D,#AEB8C8,#F6B84B,#62D8FF,#6E78FF)}.tier-transition-head{display:flex;justify-content:space-between;align-items:flex-start;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.tier-kicker{display:block;color:#62D8FF;font:750 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}.tier-transition-head h2{margin:0;color:#F7F8FC;font-size:30px;letter-spacing:-.04em}.tier-transition-head p{margin:9px 0 0;color:#8790A1;font-size:12px}.tier-transition-head label{display:grid;gap:6px;min-width:220px}.tier-transition-head label span{color:#7E8799;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.tier-transition-head select{border:1px solid rgba(98,216,255,.24);background:#10151F;color:#F2F6FC;border-radius:10px;padding:10px 12px;font:700 11px Inter}.tier-rules{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.tier-rules>div{display:grid;grid-template-columns:8px 1fr;gap:3px 8px;padding:15px 17px;border-right:1px solid rgba(255,255,255,.06)}.tier-rules>div:last-child{border-right:0}.tier-rules i{grid-row:1/3;width:8px;height:8px;border-radius:50%;margin-top:3px;background:var(--tier-color);box-shadow:0 0 13px color-mix(in srgb,var(--tier-color) 65%,transparent)}.tier-rules span{font-size:12px;font-weight:800}.tier-rules strong{color:#788195;font:600 9px ui-monospace,monospace}.tier-monthly-chart{height:390px;padding:13px 16px 22px;border-bottom:1px solid rgba(255,255,255,.07)}.tier-transition-kpis{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.tier-transition-kpis>div{padding:18px;border-right:1px solid rgba(255,255,255,.06)}.tier-transition-kpis>div:last-child{border-right:0}.tier-transition-kpis span{display:block;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.tier-transition-kpis strong{display:block;margin:8px 0 4px;font-size:26px;letter-spacing:-.04em}.tier-transition-kpis small{color:#687184;font-size:9px}.tier-transition-kpis .up strong,.tier-transition-kpis .enter strong{color:#47D7A0}.tier-transition-kpis .down strong,.tier-transition-kpis .leave strong{color:#FF7A8E}.tier-transition-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.45fr);min-width:0}.tier-matrix-card{border-right:1px solid rgba(255,255,255,.065);min-width:0}.tier-flow-card{min-width:0}.tier-matrix-card>header,.tier-flow-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.06)}.tier-matrix-card header span,.tier-flow-card header span{color:#62D8FF;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.tier-matrix-card h3,.tier-flow-card h3{margin:5px 0 0;font-size:19px}.tier-matrix-card header small,.tier-flow-card header small{color:#697285;font-size:9px;text-align:right}.tier-matrix-scroll{overflow:auto;padding:14px}.tier-matrix-scroll table{width:100%;min-width:660px;border-collapse:separate;border-spacing:4px}.tier-matrix-scroll th{padding:9px;color:#8992A5;font:700 9px ui-monospace,monospace;text-transform:uppercase;text-align:center}.tier-matrix-scroll tbody th{text-align:left;color:#C4CAD6}.tier-matrix-scroll td{height:46px;border:1px solid rgba(255,255,255,.055);border-radius:7px;text-align:center;color:#DCE3ED}.tier-matrix-scroll td.same{outline:1px solid rgba(246,184,75,.35);color:#FFF0CC}.tier-matrix-scroll td strong{font-size:15px}.tier-matrix-scroll td.row-total{background:rgba(255,255,255,.035);color:#AAB2C1}.tier-flow-card>div{padding:8px 15px 15px}.tier-flow-card>div>div{display:grid;grid-template-columns:minmax(72px,1fr) 15px minmax(82px,1fr) 42px;gap:7px;align-items:center;padding:9px 3px;border-bottom:1px solid rgba(255,255,255,.055);font-size:10px}.tier-flow-card>div>div:last-child{border-bottom:0}.tier-flow-card>div span{color:#7C8597}.tier-flow-card>div i{font-style:normal;color:#4F5869}.tier-flow-card>div b{color:#BEC5D2}.tier-flow-card>div strong{text-align:right;font-size:14px}.tier-flow-card>div .up strong{color:#47D7A0}.tier-flow-card>div .down strong{color:#FF7A8E}.tier-flow-card>div .neutral strong{color:#F6B84B}.tier-transition-section>footer{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;padding:14px 22px;border-top:1px solid rgba(255,255,255,.07);color:#737C8D;font-size:9px;line-height:1.5}.tier-transition-section>footer em{font-style:normal;color:#9A835E}.tier-transition-section>footer b{grid-column:1/-1;color:#FFB84B}
      @media(max-width:900px){.efficiency-trend-head,.tier-transition-head,.lag-forecast-head{display:grid}.efficiency-latest{min-width:0;width:100%}.lag-model-pill{min-width:0;width:max-content}.lag-answer-grid,.lag-forecast-summary{grid-template-columns:1fr 1fr}.lag-answer:nth-child(2),.lag-forecast-summary>div:nth-child(2){border-right:0}.lag-answer:nth-child(-n+2),.lag-forecast-summary>div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.06)}.lag-chart-grid,.lag-pattern-grid{grid-template-columns:1fr}.lag-chart-grid>.lag-chart-card:first-child,.cohort-card{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.tier-rules{grid-template-columns:repeat(3,1fr)}.tier-rules>div:nth-child(3){border-right:0}.tier-rules>div:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.06)}.tier-transition-kpis{grid-template-columns:repeat(3,1fr)}.tier-transition-kpis>div:nth-child(3){border-right:0}.tier-transition-kpis>div:nth-child(-n+3){border-bottom:1px solid rgba(255,255,255,.06)}.tier-transition-layout{grid-template-columns:1fr}.tier-matrix-card{border-right:0;border-bottom:1px solid rgba(255,255,255,.065)}}
      @media(max-width:560px){.efficiency-trend-head{padding:20px 17px}.efficiency-latest{grid-template-columns:1fr}.efficiency-trend-chart{height:350px;padding:8px 0 18px}.efficiency-trend-copy>footer{grid-template-columns:1fr;padding:11px 17px}.efficiency-trend-copy>footer em{grid-column:auto}.lag-forecast-head{padding:23px 17px 18px}.lag-forecast-head h2{font-size:25px}.lag-answer-grid,.lag-forecast-summary{grid-template-columns:1fr}.lag-answer,.lag-forecast-summary>div{border-right:0!important;border-bottom:1px solid rgba(255,255,255,.06)!important;padding:17px}.lag-answer:last-child,.lag-forecast-summary>div:last-child{border-bottom:0!important}.lag-chart-title{display:grid;padding:17px 16px 7px}.lag-chart-title>small{text-align:left}.lag-forecast-chart{height:340px;padding-left:0;padding-right:0}.lag-small-chart,.cohort-chart{height:330px;padding-left:0;padding-right:0}.drawdown-card{padding:19px 16px}.drawdown-stats{grid-template-columns:1fr}.drawdown-stats>div{border-right:0!important;border-bottom:1px solid rgba(255,255,255,.06)!important}.drawdown-stats>div:last-child{border-bottom:0!important}.lag-method-note{margin:13px 12px 15px}.tier-transition-head{padding:23px 17px 18px}.tier-transition-head h2{font-size:25px}.tier-transition-head label{min-width:0;width:100%}.tier-rules{grid-template-columns:1fr 1fr}.tier-rules>div{border-bottom:1px solid rgba(255,255,255,.06)}.tier-rules>div:nth-child(odd){border-right:1px solid rgba(255,255,255,.06)}.tier-rules>div:nth-child(even){border-right:0}.tier-rules>div:last-child{grid-column:1/-1;border-bottom:0}.tier-monthly-chart{height:340px;padding-left:0;padding-right:0}.tier-transition-kpis{grid-template-columns:1fr 1fr}.tier-transition-kpis>div{border-bottom:1px solid rgba(255,255,255,.06)!important}.tier-transition-kpis>div:nth-child(odd){border-right:1px solid rgba(255,255,255,.06)!important}.tier-transition-kpis>div:nth-child(even){border-right:0!important}.tier-transition-kpis>div:last-child{grid-column:1/-1;border-bottom:0!important}.tier-matrix-card>header,.tier-flow-card>header{display:grid}.tier-matrix-card header small,.tier-flow-card header small{text-align:left}.tier-matrix-scroll{padding:9px}.tier-transition-section>footer{grid-template-columns:1fr;padding:12px 16px}.tier-transition-section>footer b{grid-column:auto}}
    `}</style>
    <style jsx global>{`
      .creator-base-health{margin:26px 0 22px;border:1px solid rgba(84,216,232,.24);border-radius:20px;background:linear-gradient(150deg,rgba(84,216,232,.07),rgba(10,13,20,.98) 23%,rgba(7,10,16,.99));overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(0,0,0,.27)}
      .creator-base-health:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#F6B84B,#FF9B68 32%,#54D8E8 66%,#A99BFF)}
      .base-health-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}
      .base-health-head h2{margin:0;color:#F7F8FC;font-size:30px;letter-spacing:-.04em}.base-health-head p{margin:9px 0 0;color:#8790A1;font-size:12px;max-width:690px;line-height:1.5}
      .base-health-latest{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:470px}.base-health-latest>div{padding:10px 12px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(7,10,16,.5);min-width:0}.base-health-latest span{display:block;color:#788194;font:700 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;line-height:1.35}.base-health-latest strong{display:block;margin:6px 0 3px;color:#F5F6FA;font-size:20px;letter-spacing:-.03em}.base-health-latest>div:nth-child(1) strong{color:#F6B84B}.base-health-latest>div:nth-child(2) strong{color:#FF9B68}.base-health-latest>div:nth-child(3) strong{color:#54D8E8}.base-health-latest>div:nth-child(4) strong{color:#A99BFF}.base-health-latest small{display:block;color:#737B8D;font-size:9px;line-height:1.35}
      .base-health-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px}.base-health-card{min-width:0;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(9,12,19,.72);overflow:hidden}.base-health-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 18px 7px}.base-health-card>header span{display:block;color:#7D8698;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.base-health-card h3{margin:6px 0 0;color:#EFF2F8;font-size:18px;line-height:1.15;letter-spacing:-.025em;max-width:410px}.base-health-card>header>strong{flex:0 0 auto;color:#F5F6FA;font-size:24px;letter-spacing:-.04em}.base-health-productivity>header>strong{color:#F6B84B}.base-health-active-concentration>header>strong{color:#FF9B68}.base-health-coverage>header>strong{color:#54D8E8}.base-health-monetized-concentration>header>strong{color:#A99BFF}.base-health-card>p{min-height:44px;margin:0;padding:0 18px;color:#778195;font-size:10px;line-height:1.45}.base-health-chart{height:310px;padding:4px 5px 14px;min-width:0}.base-health-card>footer{min-height:48px;padding:12px 17px;border-top:1px solid rgba(255,255,255,.06);color:#8B94A5;font-size:10px;line-height:1.45}.base-health-method{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px;padding:13px 25px;border-top:1px solid rgba(255,255,255,.07);color:#70788A;font:500 9px ui-monospace,monospace}.base-health-method b{color:#BFC5D2}.base-health-method em{grid-column:1/-1;color:#A88A55;font-style:normal}
      @media(max-width:900px){.base-health-head{display:grid}.base-health-latest{min-width:0;width:100%}.base-health-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.base-health-head{padding:23px 17px 18px}.base-health-head h2{font-size:25px}.base-health-latest{grid-template-columns:1fr}.base-health-grid{padding:12px;gap:12px}.base-health-card>header{display:grid;padding:17px 15px 7px}.base-health-card>header>strong{font-size:22px}.base-health-card h3{font-size:17px}.base-health-card>p{min-height:0;padding:0 15px 8px}.base-health-chart{height:320px;padding-left:0;padding-right:0}.base-health-method{grid-template-columns:1fr;padding:12px 16px}.base-health-method em{grid-column:auto}}
    `}</style>
    <style jsx global>{`
      .portfolio-projection-section{margin:26px 0 22px;border:1px solid rgba(71,215,160,.25);border-radius:20px;background:linear-gradient(150deg,rgba(71,215,160,.07),rgba(10,13,20,.98) 24%,rgba(7,10,16,.99));overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(0,0,0,.28)}
      .portfolio-projection-section:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#47D7A0,#54D8E8 45%,#A99BFF 72%,#F6B84B)}
      .portfolio-projection-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}
      .portfolio-projection-kicker{display:block;color:#47D7A0;font:750 10px ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
      .portfolio-projection-head h2{margin:0;color:#F7F8FC;font-size:30px;letter-spacing:-.04em;max-width:850px}.portfolio-projection-head p{margin:9px 0 0;color:#8790A1;font-size:12px}
      .portfolio-backtest-pill{min-width:230px;padding:12px 14px;border:1px solid rgba(71,215,160,.2);border-radius:12px;background:rgba(71,215,160,.05)}.portfolio-backtest-pill span{display:block;color:#79BDA5;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.portfolio-backtest-pill strong{display:block;margin:5px 0 2px;color:#7BE8BE;font-size:22px}.portfolio-backtest-pill small{display:block;color:#737C8E;font-size:9px;max-width:210px;line-height:1.35}
      .portfolio-projection-summary{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.portfolio-projection-summary>div{padding:19px 20px 17px;border-right:1px solid rgba(255,255,255,.06)}.portfolio-projection-summary>div:last-child{border-right:0}.portfolio-projection-summary span,.portfolio-growth-strip span,.portfolio-assumption-grid span{display:block;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.portfolio-projection-summary strong{display:block;margin:7px 0 5px;color:#F4F6FB;font-size:26px;letter-spacing:-.04em}.portfolio-projection-summary>div:nth-child(2) strong{color:#A99BFF}.portfolio-projection-summary>div:nth-child(3) strong{color:#F6B84B}.portfolio-projection-summary>div:nth-child(4) strong{color:#47D7A0}.portfolio-projection-summary small{color:#737C8E;font-size:9px}
      .portfolio-scenario-switch{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(4,7,12,.32)}.portfolio-scenario-switch button{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(255,255,255,.07);background:#0B0F17;color:#7D879A;border-radius:10px;padding:10px 12px;cursor:pointer;text-align:left}.portfolio-scenario-switch button span{font-size:9px;font-weight:750}.portfolio-scenario-switch button b{color:#ABB3C2;font-size:14px}.portfolio-scenario-switch button.active{border-color:rgba(169,155,255,.45);background:rgba(169,155,255,.12);color:#D7D0FF}.portfolio-scenario-switch button.active b{color:#F1EEFF}
      .portfolio-projection-grid{display:grid;grid-template-columns:1.5fr 1fr;background:rgba(3,6,11,.18)}.portfolio-projection-card{min-width:0;border-right:1px solid rgba(255,255,255,.065);border-bottom:1px solid rgba(255,255,255,.065)}.portfolio-projection-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:17px 20px 10px}.portfolio-projection-card>header span{color:#818A9C;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.portfolio-projection-card h3{margin:4px 0 0;color:#E9EDF5;font-size:19px;letter-spacing:-.025em}.portfolio-projection-card>header small{color:#6F788B;font:600 8px ui-monospace,monospace;text-align:right}.portfolio-stock-card{grid-column:1/-1;border-right:0}.portfolio-stock-chart{height:420px;padding:4px 14px 20px}.portfolio-flow-chart{height:350px;padding:4px 12px 20px}
      .portfolio-assumption-card{border-right:0;padding-bottom:16px}.portfolio-assumption-grid{display:grid;grid-template-columns:1fr 1fr;margin:4px 18px 0;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden}.portfolio-assumption-grid>div{padding:16px;border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.portfolio-assumption-grid>div:nth-child(2n){border-right:0}.portfolio-assumption-grid>div:nth-last-child(-n+2){border-bottom:0}.portfolio-assumption-grid strong{display:block;margin-top:7px;color:#E9EDF5;font-size:22px}.portfolio-assumption-card>p{margin:14px 19px 0;color:#858FA2;font-size:11px;line-height:1.55}
      .portfolio-growth-strip{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.portfolio-growth-strip>div{padding:18px 20px;border-right:1px solid rgba(255,255,255,.06)}.portfolio-growth-strip>div:last-child{border-right:0}.portfolio-growth-strip strong{display:block;margin:7px 0 5px;color:#E9EDF5;font-size:22px}.portfolio-growth-strip small{display:block;color:#737C8E;font-size:9px;line-height:1.4}.portfolio-projection-note{display:flex;gap:9px;align-items:flex-start;padding:13px 22px;color:#858FA2;font:550 9px/1.5 ui-monospace,monospace}.portfolio-projection-note b{color:#47D7A0;white-space:nowrap}.portfolio-projection-note em{font-style:normal;color:#9A7D84}
      @media(max-width:900px){.portfolio-projection-head{display:grid}.portfolio-backtest-pill{min-width:0;width:max-content}.portfolio-projection-summary{grid-template-columns:1fr 1fr}.portfolio-projection-summary>div:nth-child(2){border-right:0}.portfolio-projection-summary>div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.06)}.portfolio-scenario-switch{grid-template-columns:1fr 1fr}.portfolio-scenario-switch button:last-child{grid-column:1/-1}.portfolio-projection-grid{grid-template-columns:1fr}.portfolio-projection-card{border-right:0}.portfolio-stock-card{grid-column:auto}.portfolio-growth-strip{grid-template-columns:1fr 1fr}.portfolio-growth-strip>div:nth-child(2n){border-right:0}.portfolio-growth-strip>div:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.06)}}
      @media(max-width:560px){.portfolio-projection-head{padding:23px 17px 18px}.portfolio-projection-head h2{font-size:25px}.portfolio-projection-summary{grid-template-columns:1fr}.portfolio-projection-summary>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06);padding:16px 15px}.portfolio-projection-summary>div:last-child{border-bottom:0}.portfolio-scenario-switch{grid-template-columns:1fr;padding:11px}.portfolio-scenario-switch button:last-child{grid-column:auto}.portfolio-projection-card>header{display:grid;padding:16px 15px 8px}.portfolio-projection-card>header small{text-align:left}.portfolio-stock-chart{height:350px;padding-left:0;padding-right:0}.portfolio-flow-chart{height:330px;padding-left:0;padding-right:0}.portfolio-assumption-grid{margin-left:12px;margin-right:12px}.portfolio-assumption-grid strong{font-size:18px}.portfolio-growth-strip{grid-template-columns:1fr}.portfolio-growth-strip>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06);padding:15px}.portfolio-growth-strip>div:last-child{border-bottom:0}.portfolio-projection-note{display:grid;padding:12px 15px}}
    `}</style>
    <style jsx global>{`
      .lag-simple-head{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;padding:28px;border-bottom:1px solid rgba(255,255,255,.07)}
      .lag-simple-head h2{margin:0;color:#F7F8FC;font-size:32px;letter-spacing:-.045em}.lag-simple-head p{max-width:780px;margin:9px 0 0;color:#8790A1;font-size:12px;line-height:1.5}
      .lag-thesis{min-width:235px;padding:14px 16px;border:1px solid rgba(255,100,124,.25);border-radius:13px;background:rgba(255,100,124,.055)}.lag-thesis span,.weekly-forecast-total span,.tier-chart-focus-head span{display:block;color:#A8818A;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.lag-thesis strong{display:block;margin:6px 0 3px;color:#FF9AAC;font-size:24px;letter-spacing:-.04em}.lag-thesis small{color:#818A9C;font-size:9px}
      .lag-simple-grid,.lag-cohort-grid{display:grid;grid-template-columns:1.15fr .85fr;border-bottom:1px solid rgba(255,255,255,.07)}.lag-cohort-grid{grid-template-columns:1fr 1fr}.lag-simple-card{min-width:0;border-right:1px solid rgba(255,255,255,.065);background:rgba(5,8,13,.18)}.lag-simple-grid>.lag-simple-card:last-child,.lag-cohort-grid>.lag-simple-card:last-child{border-right:0}.lag-simple-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:19px 21px 8px}.lag-simple-card>header span{display:block;color:#7D8698;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.lag-simple-card h3{margin:5px 0 0;color:#EEF1F7;font-size:19px;letter-spacing:-.025em}.lag-simple-card>header small{color:#717A8C;font:600 8px ui-monospace,monospace;text-align:right}.lag-simple-card>footer{display:flex;gap:6px;flex-wrap:wrap;min-height:48px;padding:12px 20px;border-top:1px solid rgba(255,255,255,.06);color:#858EA0;font-size:10px;line-height:1.45}.lag-simple-card>footer b{color:#54D8E8}.lag-simple-card>footer em{color:#F6B84B;font-style:normal}
      .lag-simple-chart{height:330px;padding:4px 8px 14px}.lag-cohort-chart{height:320px;padding:4px 8px 14px}.weekly-forecast-card{border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.weekly-forecast-total{text-align:right;min-width:220px}.weekly-forecast-total strong{display:block;margin:5px 0 2px;color:#D8D1FF;font-size:23px}.weekly-forecast-total small{color:#747D8F;font-size:9px}.lag-weekly-chart{height:375px;padding:4px 12px 18px}
      .lag-evidence-card{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);gap:28px;align-items:center;padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(120deg,rgba(71,215,160,.05),transparent 46%)}.lag-evidence-card>div:first-child>span{color:#47D7A0;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em}.lag-evidence-card h3{margin:6px 0 7px;color:#EEF2F7;font-size:22px}.lag-evidence-card p{margin:0;color:#818A9D;font-size:10px;line-height:1.5}.lag-evidence-comparison{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden}.lag-evidence-comparison>div{padding:14px;border-right:1px solid rgba(255,255,255,.06)}.lag-evidence-comparison>div:last-child{border-right:0}.lag-evidence-comparison span{display:block;color:#7D8698;font:750 8px ui-monospace,monospace;text-transform:uppercase}.lag-evidence-comparison strong{display:block;margin:6px 0 3px;color:#E9EDF5;font-size:18px}.lag-evidence-comparison small{color:#747D8E;font-size:9px}.lag-evidence-comparison .down small{color:#FF7D91}.lag-evidence-comparison .up small{color:#47D7A0}
      .affiliation-returns-only{border-color:rgba(246,184,75,.24);background:linear-gradient(145deg,rgba(246,184,75,.06),rgba(12,15,24,.94) 30%,rgba(8,11,18,.97))}.affiliation-returns-only:before{background:linear-gradient(#F6B84B,#C6903C)}.daily-movement-latest strong.returning{color:#F6B84B}.affiliation-returns-only .affiliation-movement-chart{height:370px}
      .tier-chart-focus-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;padding:18px 22px 6px}.tier-chart-focus-head h3{margin:5px 0 0;color:#EDF1F7;font-size:20px;letter-spacing:-.025em}.tier-chart-focus-head p{margin:6px 0 0;color:#7F889A;font-size:10px}.tier-chart-focus-head>div:last-child{text-align:right;min-width:185px}.tier-chart-focus-head>div:last-child span{color:#62D8FF}.tier-chart-focus-head strong{display:block;margin:4px 0 2px;color:#DDF8FF;font-size:24px}.tier-chart-focus-head small{color:#747D8E;font-size:9px}.tier-monetized-only-chart{padding-top:0}
      @media(max-width:900px){.lag-simple-head{display:grid}.lag-thesis{min-width:0;width:max-content}.lag-simple-grid,.lag-cohort-grid{grid-template-columns:1fr}.lag-simple-card{border-right:0;border-bottom:1px solid rgba(255,255,255,.065)}.lag-simple-grid>.lag-simple-card:last-child,.lag-cohort-grid>.lag-simple-card:last-child{border-bottom:0}.lag-evidence-card{grid-template-columns:1fr}.tier-chart-focus-head{align-items:flex-start}}
      @media(max-width:560px){.lag-simple-head{padding:23px 17px 18px}.lag-simple-head h2{font-size:25px}.lag-thesis{width:100%}.lag-simple-card>header{display:grid;padding:17px 15px 7px}.lag-simple-card>header small{text-align:left}.lag-simple-chart,.lag-cohort-chart{height:320px;padding-left:0;padding-right:0}.lag-weekly-chart{height:340px;padding-left:0;padding-right:0}.weekly-forecast-total{text-align:left;min-width:0}.lag-evidence-card{padding:18px 15px}.lag-evidence-comparison{grid-template-columns:1fr}.lag-evidence-comparison>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.lag-evidence-comparison>div:last-child{border-bottom:0}.tier-chart-focus-head{display:grid;padding:16px 16px 3px}.tier-chart-focus-head>div:last-child{text-align:left}.affiliation-returns-only .affiliation-movement-chart{height:320px}}
    `}</style>
    <style jsx global>{`
      .retention-analytics-section,.creator-bu-section{margin:26px 0 22px;border:1px solid rgba(84,216,232,.23);border-radius:20px;background:#090D15;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.24)}
      .retention-analytics-head,.creator-bu-head{display:flex;justify-content:space-between;gap:28px;padding:27px 28px 22px;border-bottom:1px solid rgba(255,255,255,.07)}
      .retention-analytics-head h2,.creator-bu-head h2{margin:0;color:#F5F7FC;font-size:30px;letter-spacing:-.04em}.retention-analytics-head p,.creator-bu-head p{margin:9px 0 0;color:#8790A1;font-size:12px}
      .retention-censor,.creator-bu-status{min-width:235px;max-width:310px;padding:13px 15px;border:1px solid rgba(246,184,75,.22);border-radius:12px;background:rgba(246,184,75,.05)}.retention-censor span,.creator-bu-status span{display:block;color:#D5A853;font:750 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.retention-censor strong,.creator-bu-status strong{display:block;margin:6px 0 3px;font-size:20px}.retention-censor small,.creator-bu-status small{display:block;color:#788195;font-size:9px;line-height:1.4;overflow-wrap:anywhere}.creator-bu-status.observed{border-color:rgba(71,215,160,.24);background:rgba(71,215,160,.05)}.creator-bu-status.observed span{color:#47D7A0}
      .retention-summary-grid,.creator-bu-actual-summary{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.07)}.retention-summary-grid>div,.creator-bu-actual-summary>div{padding:19px 20px;border-right:1px solid rgba(255,255,255,.06)}.retention-summary-grid>div:last-child,.creator-bu-actual-summary>div:last-child{border:0}.retention-summary-grid span,.creator-bu-actual-summary span{display:block;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase}.retention-summary-grid strong,.creator-bu-actual-summary strong{display:block;margin:7px 0 3px;font-size:24px}.retention-summary-grid small,.creator-bu-actual-summary small{color:#687286;font-size:9px}
      .retention-chart-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.07)}.retention-chart-grid>article{min-width:0;border-right:1px solid rgba(255,255,255,.06)}.retention-chart-grid>article:last-child{border-right:0}.retention-chart-grid article>header{display:flex;justify-content:space-between;gap:18px;padding:17px 20px 4px}.retention-chart-grid article>header span{display:block;color:#AAB2C2;font:750 8px ui-monospace,monospace;text-transform:uppercase}.retention-chart-grid article>header h3{margin:5px 0 0;color:#EDF1F7;font-size:17px}.retention-chart-grid article>header small{max-width:210px;color:#697286;font-size:8px;text-align:right}.retention-chart{height:330px;padding:0 8px 14px}
      .retention-analytics-grid{display:grid;grid-template-columns:1fr 1fr}.retention-analytics-grid>article{min-width:0;border-right:1px solid rgba(255,255,255,.06)}.retention-analytics-grid>article:last-child{border:0}.retention-analytics-grid article>header{display:flex;justify-content:space-between;padding:16px 18px 10px;color:#AAB2C2;font-size:11px}.retention-analytics-grid article>header small{color:#697286;font-size:8px}.retention-tier-list,.retention-month-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:0 14px 16px;gap:7px}.retention-tier-list>div,.retention-month-list>div{padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:9px;background:#0C111B}.retention-tier-list span,.retention-month-list span{display:block;color:#838C9D;font-size:9px}.retention-tier-list strong,.retention-month-list strong{display:block;margin:5px 0;color:#DDE2EB;font-size:16px}.retention-tier-list small,.retention-month-list small{color:#697286;font-size:8px}.retention-analytics-section>footer,.creator-bu-section>footer{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:13px 22px;border-top:1px solid rgba(255,255,255,.07);color:#747D8F;font:500 9px/1.5 ui-monospace,monospace}.retention-analytics-section>footer b,.creator-bu-section>footer b{color:#D1A052;font-weight:600}
      .creator-bu-section{border-color:rgba(71,215,160,.26)}.creator-bu-inventory{border-bottom:1px solid rgba(255,255,255,.07);background:rgba(71,215,160,.025)}.creator-bu-inventory>header{display:flex;justify-content:space-between;gap:18px;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.06)}.creator-bu-inventory>header span{color:#47D7A0;font:750 8px ui-monospace,monospace;text-transform:uppercase}.creator-bu-inventory>header h3{margin:5px 0 0;font-size:19px}.creator-bu-inventory>header small{color:#7B8496;font-size:9px}.creator-bu-inventory-summary{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(255,255,255,.06)}.creator-bu-inventory-summary>div{padding:15px 18px;border-right:1px solid rgba(255,255,255,.06)}.creator-bu-inventory-summary>div:last-child{border:0}.creator-bu-inventory-summary span{display:block;color:#7E8799;font:750 8px ui-monospace,monospace;text-transform:uppercase}.creator-bu-inventory-summary strong{display:block;margin:5px 0 2px;font-size:21px}.creator-bu-inventory-summary small{color:#6D7688;font-size:8px}.creator-bu-inventory-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:14px}.creator-bu-inventory-grid details{min-width:0;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:#0A0F18;overflow:hidden}.creator-bu-inventory-grid summary{display:grid;grid-template-columns:1fr auto;gap:3px 12px;padding:13px 14px;cursor:pointer}.creator-bu-inventory-grid summary:focus-visible{outline:2px solid #54D8E8;outline-offset:-2px}.creator-bu-inventory-grid summary span{font-size:11px;font-weight:750}.creator-bu-inventory-grid summary strong{color:#F6B84B;font-size:13px}.creator-bu-inventory-grid summary small{grid-column:1/-1;color:#6F788B;font-size:8px}.creator-bu-inventory-grid details>div{max-height:360px;overflow:auto;border-top:1px solid rgba(255,255,255,.06)}.creator-bu-inventory-grid article{display:flex;justify-content:space-between;gap:15px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05)}.creator-bu-inventory-grid article:last-child{border:0}.creator-bu-inventory-grid article strong{display:block;color:#D6DBE5;font-size:10px}.creator-bu-inventory-grid article small{color:#6E7789;font-size:8px}.creator-bu-inventory-grid article b{white-space:nowrap;color:#E6EAF1;font-size:10px}.creator-bu-inventory-grid article.review-overlap{background:rgba(246,184,75,.06)}.creator-bu-inventory-grid article.review-overlap small{color:#D5A853}.creator-bu-inventory-grid p{margin:0;padding:13px;color:#6F788B;font-size:9px}.creator-bu-chart{height:350px;padding:16px 18px 10px;border-bottom:1px solid rgba(255,255,255,.07)}.creator-bu-month-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;padding:14px;border-bottom:1px solid rgba(255,255,255,.07)}.creator-bu-month-tabs button{display:grid;gap:4px;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#0B1019;color:#E7EAF0;padding:13px;cursor:pointer}.creator-bu-month-tabs button:hover,.creator-bu-month-tabs button:focus-visible{border-color:#54D8E8;outline:2px solid transparent}.creator-bu-month-tabs button.active{border-color:rgba(84,216,232,.55);background:rgba(84,216,232,.08)}.creator-bu-month-tabs span{color:#788195;font:700 9px ui-monospace,monospace;text-transform:uppercase}.creator-bu-month-tabs strong{font-size:18px}.creator-bu-month-tabs small{color:#7A8497;font-size:9px}.creator-bu-actual-summary .cost{color:#F6B84B}
      .creator-bu-drilldown{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px;border-bottom:1px solid rgba(255,255,255,.07)}.creator-bu-drilldown details{min-width:0;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:#0A0F18;overflow:hidden}.creator-bu-drilldown summary{display:grid;grid-template-columns:1fr auto;gap:3px 12px;padding:13px 14px;cursor:pointer;list-style-position:inside}.creator-bu-drilldown summary:focus-visible{outline:2px solid #54D8E8;outline-offset:-2px}.creator-bu-drilldown summary span{font-size:11px;font-weight:750}.creator-bu-drilldown summary strong{color:#F6B84B;font-size:13px}.creator-bu-drilldown summary small{grid-column:1/-1;color:#6F788B;font-size:8px}.creator-bu-drilldown details>div{max-height:320px;overflow:auto;border-top:1px solid rgba(255,255,255,.06)}.creator-bu-drilldown article{display:flex;justify-content:space-between;gap:15px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05)}.creator-bu-drilldown article:last-child{border:0}.creator-bu-drilldown article strong{display:block;color:#D6DBE5;font-size:10px}.creator-bu-drilldown article small{color:#6E7789;font-size:8px}.creator-bu-drilldown article b{white-space:nowrap;color:#E6EAF1;font-size:10px}.creator-bu-drilldown p{margin:0;padding:13px;color:#6F788B;font-size:9px}
      .creator-bu-plan{margin:14px;border:1px dashed rgba(169,155,255,.27);border-radius:13px;background:rgba(169,155,255,.035);overflow:hidden}.creator-bu-plan>header{display:flex;justify-content:space-between;gap:18px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.06)}.creator-bu-plan>header span{color:#A99BFF;font:750 8px ui-monospace,monospace;text-transform:uppercase}.creator-bu-plan h3{margin:5px 0 0;font-size:18px}.creator-bu-plan>header small{color:#747D8E;font-size:8px}.creator-bu-plan>div{display:grid;grid-template-columns:repeat(3,1fr)}.creator-bu-plan article{padding:15px;border-right:1px solid rgba(255,255,255,.06)}.creator-bu-plan article:last-child{border:0}.creator-bu-plan h4{margin:0 0 10px;color:#D8D1FF}.creator-bu-plan dl{margin:0}.creator-bu-plan dl>div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}.creator-bu-plan dt{color:#7D8698;font-size:9px}.creator-bu-plan dd{margin:0;color:#D5DAE4;font-size:9px;font-weight:700}.creator-bu-plan>footer{padding:11px 16px;border-top:1px solid rgba(255,255,255,.06);color:#A99BFF;font:600 9px ui-monospace,monospace}
      @media(max-width:820px){.retention-analytics-head,.creator-bu-head{display:grid}.retention-summary-grid,.creator-bu-actual-summary,.creator-bu-inventory-summary{grid-template-columns:1fr}.retention-summary-grid>div,.creator-bu-actual-summary>div,.creator-bu-inventory-summary>div{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.retention-chart-grid,.retention-analytics-grid{grid-template-columns:1fr}.retention-chart-grid>article,.retention-analytics-grid>article{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.creator-bu-drilldown,.creator-bu-inventory-grid{grid-template-columns:1fr}.creator-bu-plan>div{grid-template-columns:1fr}.creator-bu-plan article{border-right:0;border-bottom:1px solid rgba(255,255,255,.06)}.retention-analytics-section>footer,.creator-bu-section>footer{grid-template-columns:1fr}}
      @media(max-width:560px){.retention-analytics-head,.creator-bu-head{padding:22px 16px 17px}.retention-analytics-head h2,.creator-bu-head h2{font-size:25px}.retention-censor,.creator-bu-status{min-width:0;max-width:none}.retention-chart-grid article>header{display:grid;padding:15px 14px 2px}.retention-chart-grid article>header small{text-align:left}.retention-chart{height:300px;padding-left:0;padding-right:0}.retention-tier-list,.retention-month-list{grid-template-columns:1fr}.creator-bu-inventory>header{display:grid;padding:16px}.creator-bu-inventory-grid{padding:11px}.creator-bu-chart{height:285px;padding:12px 4px}.creator-bu-month-tabs{grid-template-columns:1fr}.creator-bu-plan>header{display:grid}.creator-bu-drilldown{padding:11px}.creator-bu-plan{margin:11px}}
    `}</style>
  </main>
}

function FragmentRow({ creator, expanded, onToggle }) {
  return <>
    <tr className="creator-row">
      <td><div className="creator-name"><i>@</i><strong>{creator.handle}</strong>{creator.returnedInRange && <span className="return-dot" title="Voltou no periodo" />}</div></td>
      <td><span className="origin-tag">{originLabel(creator.acquisition)}</span></td>
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
