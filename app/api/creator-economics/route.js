import { readFile } from 'node:fs/promises'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/creator-economics-live.json'
const DAILY_LEDGER_MONTHLY = '/root/.openclaw/workspaces/retencao-gabriel/work/tiktok-shop-reports/creator-daily-ledger/monthly'
const PORTFOLIO_ANALYTICS_PATH = '/root/.openclaw/workspaces/retencao-gabriel/work/tiktok-shop-reports/creator-daily-ledger/meta/creator-portfolio-analytics.json'
const META_ENV_PATH = '/root/.openclaw/workspaces/analista-trafego/.env'
const META_API_VERSION = 'v19.0'
const metaCache = new Map()

function round(value) { return Math.round((Number(value) || 0) * 100) / 100 }
function percent(total, value) { return total ? round((value / total) * 100) : 0 }
function parseEnvFile(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
  }))
}
function validMonth(value, fallback) { return /^\d{4}-\d{2}$/.test(value || '') ? value : fallback }
function lastDay(month) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10)
}
function monthsBetween(from, to) {
  const result = []
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  let cursor = new Date(Date.UTC(fromYear, fromMonth - 1, 1))
  const end = new Date(Date.UTC(toYear, toMonth - 1, 1))
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return result
}
function inDateRange(date, from, to) { return Boolean(date && date >= `${from}-01` && date <= lastDay(to)) }
function nextDay(value) {
  const cursor = new Date(`${value}T00:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + 1)
  return cursor.toISOString().slice(0, 10)
}
async function readDailyAffiliation(from, to) {
  const rows = (await Promise.all(monthsBetween(from, to).map(async (month) => {
    const file = `${DAILY_LEDGER_MONTHLY}/${month}/creator_daily_counts__${month}.json`
    const payload = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(payload)) throw new Error(`serie diaria invalida em ${month}`)
    return payload
  }))).flat().filter((row) => row.day >= `${from}-01` && row.day <= lastDay(to)).sort((a, b) => a.day.localeCompare(b.day))
  if (!rows.length) throw new Error(`ledger diario sem dados entre ${from} e ${to}`)
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day || '') || !Number.isInteger(row.active_creators) || row.active_creators <= 0 || row.downloaded_count !== row.active_creators || !Number.isFinite(row.gmv_total) || !Number.isFinite(row.estimated_creator_commission)) {
      throw new Error(`linha diaria invalida no ledger: ${row.day || 'sem data'}`)
    }
  }
  const missingDays = []
  for (let day = rows[0].day; day <= rows.at(-1).day; day = nextDay(day)) {
    if (!rows.some((row) => row.day === day)) missingDays.push(day)
  }
  const series = rows.map((row) => ({
    date: row.day,
    affiliatedCreators: row.active_creators,
    gmvCreators: Number(row.positive_gmv_creators) || 0,
    dailyGmv: row.gmv_total,
    dailyEstimatedCreatorCommission: row.estimated_creator_commission,
    dailyAmplifyRevenue: round(row.estimated_creator_commission * 0.10),
    complete: row.downloaded_count === row.active_creators,
  }))
  const latest = series.at(-1)
  const previous = series.at(-2) || null
  const minimum = series.reduce((best, row) => row.affiliatedCreators < best.affiliatedCreators ? row : best, series[0])
  const maximum = series.reduce((best, row) => row.affiliatedCreators > best.affiliatedCreators ? row : best, series[0])
  const delta = previous ? latest.affiliatedCreators - previous.affiliatedCreators : null
  const first = series[0]
  return {
    source: 'TikTok Shop Partner Center · relatorio Criador · um dia por consulta',
    timezone: 'America/Sao_Paulo',
    grain: 'one_calendar_day',
    range: { from: first.date, to: latest.date, days: series.length },
    latest: { ...latest, delta, deltaPercent: previous?.affiliatedCreators ? round(delta / previous.affiliatedCreators * 100) : null },
    minimum,
    maximum,
    average: round(series.reduce((sum, row) => sum + row.affiliatedCreators, 0) / series.length),
    growthSinceStart: latest.affiliatedCreators - first.affiliatedCreators,
    missingDays,
    complete: missingDays.length === 0 && series.every((row) => row.complete),
    series,
  }
}
async function readPortfolioAnalytics(from, to) {
  const payload = JSON.parse(await readFile(PORTFOLIO_ANALYTICS_PATH, 'utf8'))
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.dailyTransitions) || !Array.isArray(payload.monthlyPortfolio)) {
    throw new Error('analytics de carteira invalidos')
  }
  const fromDay = `${from}-01`
  const toDay = lastDay(to)
  const daily = payload.dailyTransitions.filter((row) => row.date >= fromDay && row.date <= toDay)
  const monthly = payload.monthlyPortfolio.filter((row) => row.month >= from && row.month <= to)
  if (!daily.length || !monthly.length) throw new Error(`analytics de carteira sem dados entre ${from} e ${to}`)
  for (const row of daily) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || !Number.isInteger(row.activeCreators) || row.activeCreators <= 0) {
      throw new Error(`transicao diaria invalida: ${row.date || 'sem data'}`)
    }
  }
  for (const row of monthly) {
    if (!/^\d{4}-\d{2}$/.test(row.month || '') || !Number.isFinite(row.totalGmv) || !Array.isArray(row.topCreators)) {
      throw new Error(`carteira mensal invalida: ${row.month || 'sem mes'}`)
    }
  }
  const transitionDays = daily.filter((row) => Number.isInteger(row.exits))
  const gmvCompleteDays = transitionDays.filter((row) => row.gmvWindowComplete)
  const exitedIds = new Set(transitionDays.flatMap((row) => Array.isArray(row.exitedCreatorIds) ? row.exitedCreatorIds : []))
  const sum = (key, rows = transitionDays) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
  const totalExits = sum('exits')
  const priorCreatorDays = transitionDays.reduce((total, row) => total + Math.max(0, row.activeCreators - (Number(row.net) || 0)), 0)
  const selectedMonth = monthly.at(-1)
  return {
    source: payload.source,
    timezone: payload.timezone,
    definitions: payload.definitions,
    range: { from: daily[0].date, to: daily.at(-1).date, days: daily.length },
    summary: {
      firstAppearances: sum('firstAppearances'),
      returns: sum('returns'),
      additions: sum('additions'),
      exitEvents: totalExits,
      uniqueExitedCreators: exitedIds.size,
      net: sum('net'),
      exitRatePerCreatorDay: percent(priorCreatorDays, totalExits),
      exitedGmvPrior30d: round(sum('exitedGmvPrior30d', gmvCompleteDays)),
      gmvCompleteDays: gmvCompleteDays.length,
      transitionDays: transitionDays.length,
      latestMonth: selectedMonth.month,
      latestMonthGmv: selectedMonth.totalGmv,
      latestMonthSellers: selectedMonth.creatorsWithGmv,
      latestMonthMedianGmv: selectedMonth.medianGmvPerSeller,
      latestMonthTop5Share: selectedMonth.top5Share,
    },
    daily: daily.map(({ exitedCreatorIds, topExits, ...row }) => row),
    monthly,
  }
}
function metaResultValue(row) {
  const results = Array.isArray(row.results) ? row.results : []
  const resultValues = results.flatMap((result) => Array.isArray(result.values) ? result.values : [])
  if (resultValues.length) return resultValues.reduce((total, item) => total + (Number(item.value) || 0), 0)
  const actions = Array.isArray(row.actions) ? row.actions : []
  const preferred = actions.filter((item) => /messaging_conversation_started|lead/i.test(item.action_type || ''))
  return preferred.reduce((total, item) => total + (Number(item.value) || 0), 0)
}
async function readMetaRange(fromDate, toDate) {
  const cacheKey = `${fromDate}:${toDate}`
  const cached = metaCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < 300_000) return cached.value
  try {
    const env = parseEnvFile(await readFile(META_ENV_PATH, 'utf8'))
    if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) throw new Error('credenciais Meta nao configuradas')
    const fromMonth = fromDate.slice(0, 7)
    const toMonth = toDate.slice(0, 7)
    const from = fromDate
    const to = toDate
    const rows = []
    const dailyRows = []
    const fetchMetaPages = async (params, month) => {
      const output = []
      let next = `https://graph.facebook.com/${META_API_VERSION}/${env.META_AD_ACCOUNT_ID}/insights?${params}`
      for (let page = 0; next && page < 8; page += 1) {
        const response = await fetch(next, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw new Error(`Meta Graph respondeu ${response.status} em ${month}`)
        const payload = await response.json()
        output.push(...(Array.isArray(payload.data) ? payload.data : []))
        next = payload.paging?.next || null
      }
      return output
    }
    for (const month of monthsBetween(fromMonth, toMonth)) {
      const monthFrom = month === fromMonth ? from : `${month}-01`
      const monthTo = month === toMonth ? to : lastDay(month)
      const aggregateParams = new URLSearchParams({
        access_token: env.META_ACCESS_TOKEN,
        fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,results,actions',
        time_range: JSON.stringify({ since: monthFrom, until: monthTo }),
        level: 'ad',
        limit: '500',
      })
      const dailyParams = new URLSearchParams({
        access_token: env.META_ACCESS_TOKEN,
        fields: 'campaign_id,campaign_name,spend,date_start,date_stop',
        time_range: JSON.stringify({ since: monthFrom, until: monthTo }),
        time_increment: '1',
        level: 'campaign',
        limit: '500',
      })
      const [aggregateMonthRows, dailyMonthRows] = await Promise.all([
        fetchMetaPages(aggregateParams, month),
        fetchMetaPages(dailyParams, month),
      ])
      rows.push(...aggregateMonthRows)
      dailyRows.push(...dailyMonthRows)
    }
    const creatorRows = rows.filter((row) => !/marcas?/i.test(row.campaign_name || ''))
    const creatorDailyRows = dailyRows.filter((row) => !/marcas?/i.test(row.campaign_name || ''))
    const dailySpend = new Map()
    for (const row of creatorDailyRows) dailySpend.set(row.date_start, round((dailySpend.get(row.date_start) || 0) + (Number(row.spend) || 0)))
    const daily = []
    for (let day = from; day <= to; day = nextDay(day)) daily.push({ date: day, trafficPaidCost: round(dailySpend.get(day) || 0) })
    const value = {
      source: 'Meta Ads ao vivo', stale: false, error: null, from, to,
      spend: round(creatorRows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0)),
      results: round(creatorRows.reduce((sum, row) => sum + metaResultValue(row), 0)),
      ads: creatorRows.length,
      campaigns: new Set(creatorDailyRows.map((row) => row.campaign_id)).size,
      daily,
      generatedAt: new Date().toISOString(),
    }
    metaCache.set(cacheKey, { cachedAt: Date.now(), value })
    return value
  } catch (error) {
    const value = { source: 'Meta Ads ao vivo', stale: true, error: error.message, spend: null, results: null, ads: 0, campaigns: 0, daily: [], generatedAt: null }
    metaCache.set(cacheKey, { cachedAt: Date.now(), value })
    return value
  }
}
function sumMetrics(rows, monthlyOnly = true) {
  const totals = rows.reduce((acc, row) => {
    const source = monthlyOnly ? row.period : row.totals
    acc.gmv += source.gmv || 0
    acc.estimatedCreatorCommission += source.estimatedCreatorCommission || 0
    return acc
  }, { gmv: 0, estimatedCreatorCommission: 0 })
  return { ...totals, estimatedAmplifyRevenue: round(totals.estimatedCreatorCommission * 0.10) }
}
function sourceAggregate(rows) {
  const bySource = new Map()
  for (const row of rows) {
    const key = row.acquisition.key
    if (!bySource.has(key)) bySource.set(key, { key, label: row.acquisition.label, creators: 0, entered: 0, acquired: 0, matchedForms: 0, returned: 0, activeDays: 0, gmv: 0, estimatedCreatorCommission: 0, lifetimeRevenue: 0 })
    const item = bySource.get(key)
    item.creators += 1
    item.entered += row.enteredInRange ? 1 : 0
    item.acquired += row.acquiredInRange ? 1 : 0
    item.matchedForms += row.form.matched ? 1 : 0
    item.returned += row.returnedInRange ? 1 : 0
    item.activeDays += row.period.activeDays
    item.gmv += row.period.gmv
    item.estimatedCreatorCommission += row.period.estimatedCreatorCommission
    item.lifetimeRevenue += row.observedLtv
  }
  return [...bySource.values()].map((item) => ({
    ...item,
    formMatchRate: percent(item.creators, item.matchedForms),
    avgObservedLtv: round(item.lifetimeRevenue / Math.max(item.creators, 1)),
    gmv: round(item.gmv), estimatedCreatorCommission: round(item.estimatedCreatorCommission), estimatedAmplifyRevenue: round(item.estimatedCreatorCommission * 0.10), lifetimeRevenue: round(item.lifetimeRevenue),
  })).sort((a, b) => b.estimatedAmplifyRevenue - a.estimatedAmplifyRevenue)
}
function systemAggregate(rows) {
  const bySystem = new Map()
  for (const row of rows) {
    const key = row.acquisition.systemKey || 'unknown'
    if (!bySystem.has(key)) bySystem.set(key, { key, label: row.acquisition.systemLabel || 'Sistema nao identificado', creators: 0, acquired: 0, matchedForms: 0, gmv: 0, estimatedCreatorCommission: 0, lifetimeRevenue: 0 })
    const item = bySystem.get(key)
    item.creators += 1
    item.acquired += row.acquiredInRange ? 1 : 0
    item.matchedForms += row.form.matched ? 1 : 0
    item.gmv += row.period.gmv
    item.estimatedCreatorCommission += row.period.estimatedCreatorCommission
    item.lifetimeRevenue += row.observedLtv
  }
  return [...bySystem.values()].map((item) => ({
    ...item,
    formMatchRate: percent(item.creators, item.matchedForms),
    avgObservedLtv: round(item.lifetimeRevenue / Math.max(item.creators, 1)),
    gmv: round(item.gmv), estimatedCreatorCommission: round(item.estimatedCreatorCommission), estimatedAmplifyRevenue: round(item.estimatedCreatorCommission * 0.10), lifetimeRevenue: round(item.lifetimeRevenue),
  })).sort((a, b) => b.estimatedAmplifyRevenue - a.estimatedAmplifyRevenue)
}

function reconcileEstimatedRevenue(items, target) {
  if (!items.length) return items
  const current = round(items.reduce((sum, item) => sum + item.estimatedAmplifyRevenue, 0))
  const residual = round(target - current)
  if (residual) items[0].estimatedAmplifyRevenue = round(items[0].estimatedAmplifyRevenue + residual)
  return items
}

export async function GET(request) {
  try {
    const snapshot = JSON.parse(await readFile(LIVE_PATH, 'utf8'))
    const url = new URL(request.url)
    const coverageFrom = snapshot.coverage.from.slice(0, 7)
    const coverageTo = snapshot.coverage.to.slice(0, 7)
    const defaultFrom = coverageFrom < '2026-03' ? '2026-03' : coverageFrom
    let from = validMonth(url.searchParams.get('from'), defaultFrom)
    let to = validMonth(url.searchParams.get('to'), coverageTo)
    if (from > to) [from, to] = [to, from]
    from = from < coverageFrom ? coverageFrom : from > coverageTo ? coverageTo : from
    to = to < coverageFrom ? coverageFrom : to > coverageTo ? coverageTo : to
    const sourceFilter = url.searchParams.get('source') || 'all'
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase().replace(/^@/, '')
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(250, Math.max(25, Number(url.searchParams.get('limit')) || 100))
    const sort = url.searchParams.get('sort') || 'revenue'
    const monthKeys = monthsBetween(from, to)
    const monthSet = new Set(monthKeys)
    const affiliationDaily = await readDailyAffiliation(from, to)
    const portfolioAnalytics = await readPortfolioAnalytics(from, to)

    const activeRows = snapshot.creators.map((creator) => {
      const monthly = creator.monthly.filter((month) => monthSet.has(month.month))
      if (!monthly.length) return null
      const periodCommission = round(monthly.reduce((sum, month) => sum + month.estimatedCreatorCommission, 0))
      const period = {
        activeDays: monthly.reduce((sum, month) => sum + month.activeDays, 0),
        gmv: round(monthly.reduce((sum, month) => sum + month.gmv, 0)),
        estimatedCreatorCommission: periodCommission,
        estimatedAmplifyRevenue: round(periodCommission * 0.10),
      }
      const acquisitionMonth = creator.acquisition.entryAt?.slice(0, 7) || ''
      const postAcquisitionMonths = acquisitionMonth ? creator.monthly.filter((month) => month.month >= acquisitionMonth) : creator.monthly
      const observedLtv = round(postAcquisitionMonths.reduce((sum, month) => sum + month.estimatedAmplifyRevenue, 0))
      return {
        ...creator,
        monthly,
        period,
        observedLtv,
        enteredInRange: inDateRange(creator.firstLinked, from, to),
        acquiredInRange: inDateRange(creator.acquisition.entryAt, from, to),
        returnedInRange: creator.returnDates.some((date) => inDateRange(date, from, to)),
      }
    }).filter(Boolean)

    const sourceOptions = sourceAggregate(activeRows).map(({ key, label, creators }) => ({ key, label, creators }))
    const filtered = sourceFilter === 'all' ? activeRows : activeRows.filter((row) => row.acquisition.key === sourceFilter)
    const monthly = monthKeys.map((month) => {
      const rows = filtered.filter((row) => row.monthly.some((item) => item.month === month))
      const monthValues = rows.map((row) => row.monthly.find((item) => item.month === month))
      const monthCommission = round(monthValues.reduce((sum, item) => sum + item.estimatedCreatorCommission, 0))
      return {
        month,
        activeCreators: rows.length,
        enteredCreators: filtered.filter((row) => row.firstLinked.startsWith(month)).length,
        matchedForms: rows.filter((row) => row.form.matched).length,
        returnedCreators: filtered.filter((row) => row.returnDates.some((date) => date.startsWith(month))).length,
        gmv: round(monthValues.reduce((sum, item) => sum + item.gmv, 0)),
        estimatedCreatorCommission: monthCommission,
        estimatedAmplifyRevenue: round(monthCommission * 0.10),
      }
    })

    const commonClosedThrough = snapshot.coverage.to < lastDay(to) ? snapshot.coverage.to : lastDay(to)
    const commonFrom = `${from}-01`
    const meta = await readMetaRange(commonFrom, commonClosedThrough)
    const paidCohort = activeRows.filter((row) => row.acquisition.key === 'paid-meta' && row.acquiredInRange)
    const paidCac = meta.spend !== null && paidCohort.length ? round(meta.spend / paidCohort.length) : null
    const paidLifetimeRevenue = round(paidCohort.reduce((sum, row) => sum + row.observedLtv, 0))
    const paidAvgObservedLtv = paidCohort.length ? round(paidLifetimeRevenue / paidCohort.length) : null
    const paidLtvCac = paidCac ? round(paidAvgObservedLtv / paidCac) : null

    const totals = sumMetrics(filtered)
    const monthlyRevenue = round(monthly.reduce((sum, item) => sum + item.estimatedAmplifyRevenue, 0))
    const monthlyResidual = round(totals.estimatedAmplifyRevenue - monthlyRevenue)
    if (monthly.length && monthlyResidual) monthly[monthly.length - 1].estimatedAmplifyRevenue = round(monthly[monthly.length - 1].estimatedAmplifyRevenue + monthlyResidual)
    const allTotals = sumMetrics(activeRows)
    const sourceBreakdown = reconcileEstimatedRevenue(sourceAggregate(activeRows), allTotals.estimatedAmplifyRevenue)
    const systemBreakdown = reconcileEstimatedRevenue(systemAggregate(activeRows), allTotals.estimatedAmplifyRevenue)

    const metaDailyByDate = new Map((meta.daily || []).map((row) => [row.date, row.trafficPaidCost]))
    let cumulativeRevenue = 0
    let cumulativeKnownCost = 0
    const profitabilityDaily = affiliationDaily.series.map((row) => {
      const amplifyRevenue = round(row.dailyAmplifyRevenue)
      const trafficPaidCost = meta.stale ? null : round(metaDailyByDate.get(row.date) || 0)
      const knownCost = trafficPaidCost
      const resultAfterKnownCosts = knownCost == null ? null : round(amplifyRevenue - knownCost)
      cumulativeRevenue = round(cumulativeRevenue + amplifyRevenue)
      if (knownCost != null) cumulativeKnownCost = round(cumulativeKnownCost + knownCost)
      return {
        date: row.date,
        estimatedCreatorCommission: row.dailyEstimatedCreatorCommission,
        amplifyRevenue,
        trafficPaidCost,
        knownCost,
        resultAfterKnownCosts,
        knownMargin: amplifyRevenue && resultAfterKnownCosts != null ? round(resultAfterKnownCosts / amplifyRevenue * 100) : null,
        cumulativeRevenue,
        cumulativeKnownCost: knownCost == null ? null : cumulativeKnownCost,
        cumulativeResultAfterKnownCosts: knownCost == null ? null : round(cumulativeRevenue - cumulativeKnownCost),
      }
    })
    const profitabilityMonthly = portfolioAnalytics.monthly.map((month) => {
      const dailyRows = profitabilityDaily.filter((row) => row.date.startsWith(month.month))
      const amplifyRevenue = round(dailyRows.reduce((sum, row) => sum + row.amplifyRevenue, 0))
      const knownCost = meta.stale ? null : round(dailyRows.reduce((sum, row) => sum + (row.knownCost || 0), 0))
      const resultAfterKnownCosts = knownCost == null ? null : round(amplifyRevenue - knownCost)
      return {
        month: month.month,
        estimatedCreatorCommission: round(dailyRows.reduce((sum, row) => sum + row.estimatedCreatorCommission, 0)),
        amplifyRevenue,
        trafficPaidCost: knownCost,
        knownCost,
        resultAfterKnownCosts,
        knownMargin: amplifyRevenue && resultAfterKnownCosts != null ? round(resultAfterKnownCosts / amplifyRevenue * 100) : null,
      }
    })
    const profitabilityByOrigin = sourceBreakdown.map((item) => {
      const knownCost = item.key === 'paid-meta' && meta.spend != null ? round(meta.spend) : null
      const resultAfterKnownCosts = knownCost == null ? null : round(item.estimatedAmplifyRevenue - knownCost)
      return {
        key: item.key,
        label: item.label,
        amplifyRevenue: item.estimatedAmplifyRevenue,
        knownCost,
        resultAfterKnownCosts,
        knownMargin: item.estimatedAmplifyRevenue && resultAfterKnownCosts != null ? round(resultAfterKnownCosts / item.estimatedAmplifyRevenue * 100) : null,
        costStatus: knownCost == null ? 'pending' : 'observed',
        costBasis: item.key === 'paid-meta' ? 'Meta Ads ao vivo no periodo comum' : 'Custo da origem ainda nao cadastrado',
      }
    })
    const profitabilityRevenue = round(profitabilityDaily.reduce((sum, row) => sum + row.amplifyRevenue, 0))
    const profitabilityKnownCost = meta.stale ? null : round(profitabilityDaily.reduce((sum, row) => sum + (row.knownCost || 0), 0))
    const profitabilityResult = profitabilityKnownCost == null ? null : round(profitabilityRevenue - profitabilityKnownCost)
    const profitability = {
      scope: 'global',
      status: 'partial',
      period: { from: affiliationDaily.range.from, to: affiliationDaily.range.to, days: affiliationDaily.range.days, timezone: affiliationDaily.timezone },
      originPeriod: { from: commonFrom, to: commonClosedThrough, timezone: affiliationDaily.timezone },
      summary: {
        amplifyRevenue: profitabilityRevenue,
        knownCost: profitabilityKnownCost,
        resultAfterKnownCosts: profitabilityResult,
        knownMargin: profitabilityRevenue && profitabilityResult != null ? round(profitabilityResult / profitabilityRevenue * 100) : null,
        registeredCostCategories: 1,
        pendingCostCategories: 3,
      },
      daily: profitabilityDaily,
      monthly: profitabilityMonthly,
      byOrigin: profitabilityByOrigin,
      costRegistry: [
        { key: 'traffic-paid', label: 'Trafego pago', status: meta.stale ? 'unavailable' : 'observed', amount: profitabilityKnownCost, source: meta.source, grain: 'daily' },
        { key: 'ai', label: 'IA e automacoes', status: 'pending', amount: null, source: null, grain: null },
        { key: 'referral', label: 'Indique e Ganhe', status: 'pending', amount: null, source: null, grain: null },
        { key: 'other', label: 'Outros custos', status: 'pending', amount: null, source: null, grain: null },
      ],
      definitions: {
        revenue: 'Receita Amplify estimada = 10% da comissao estimada do creator no Partner Center.',
        knownCost: 'Soma apenas categorias com valor e data comprovados. Hoje: trafego pago Meta.',
        result: 'Receita Amplify estimada menos custos conhecidos. Nao e lucro liquido enquanto houver custos pendentes.',
        origin: 'Custos por origem so sao exibidos quando existe atribuicao comprovada. Valores ausentes permanecem pendentes, nunca zero.',
      },
    }
    const entered = filtered.filter((row) => row.enteredInRange).length
    const matchedForms = filtered.filter((row) => row.form.matched).length
    const returned = filtered.filter((row) => row.returnedInRange).length
    const lifetimeRevenue = round(filtered.reduce((sum, row) => sum + row.observedLtv, 0))
    const rowsForTable = filtered.filter((row) => !query || row.handle.includes(query) || row.aliases.some((alias) => alias.includes(query)))
      .map((row) => ({
        ...row,
        allocatedCac: row.acquisition.key === 'paid-meta' && row.acquiredInRange ? paidCac : null,
        ltvCac: row.acquisition.key === 'paid-meta' && row.acquiredInRange && paidCac ? round(row.observedLtv / paidCac) : null,
      }))
    const sorters = {
      revenue: (a, b) => b.period.estimatedAmplifyRevenue - a.period.estimatedAmplifyRevenue,
      lifetime: (a, b) => b.observedLtv - a.observedLtv,
      gmv: (a, b) => b.period.gmv - a.period.gmv,
      days: (a, b) => b.period.activeDays - a.period.activeDays,
      handle: (a, b) => a.handle.localeCompare(b.handle),
      ltvCac: (a, b) => (b.ltvCac ?? -1) - (a.ltvCac ?? -1),
    }
    rowsForTable.sort(sorters[sort] || sorters.revenue)
    const start = (page - 1) * limit

    return Response.json({
      generatedAt: snapshot.generatedAt,
      coverage: snapshot.coverage,
      range: { from, to },
      period: { from: commonFrom, to: commonClosedThrough, timezone: 'America/Sao_Paulo', endInclusive: true, commonClosedThrough },
      filters: { source: sourceFilter, query, sort },
      methodology: snapshot.methodology,
      sources: snapshot.sources,
      affiliationDaily,
      portfolioAnalytics,
      profitability,
      summary: {
        activeCreators: filtered.length,
        observedCreators: filtered.length,
        currentLinkedCreators: null,
        enteredCreators: entered,
        matchedForms,
        formMatchRate: percent(filtered.length, matchedForms),
        returnedCreators: returned,
        activeDays: filtered.reduce((sum, row) => sum + row.period.activeDays, 0),
        gmv: round(totals.gmv),
        estimatedCreatorCommission: round(totals.estimatedCreatorCommission),
        estimatedAmplifyRevenue: round(totals.estimatedAmplifyRevenue),
        avgObservedLtv: filtered.length ? round(lifetimeRevenue / filtered.length) : 0,
      },
      paidEconomics: {
        cohortCreators: paidCohort.length,
        spend: meta.spend,
        leads: meta.results,
        leadCpl: meta.spend !== null && meta.results ? round(meta.spend / meta.results) : null,
        acquiredCac: paidCac,
        avgObservedLtv: paidAvgObservedLtv,
        ltvCac: paidLtvCac,
        lifetimeRevenue: paidLifetimeRevenue,
        allocation: 'Media agregada alocada: gasto Meta / creators com Ads Meta explicito ou Origem Desconhecida assumida como Meta por perda de tracking, first-touch na janela comum e @ vinculado ao Partner Center. Nao e CAC individual atribuido.',
        contracts: {
          metaPlatformCpl: { value: meta.spend !== null && meta.results ? round(meta.spend / meta.results) : null, status: meta.spend === null ? 'unavailable' : 'observed', basis: 'resultados da plataforma Meta; nao sao leads CRM validados' },
          paidCohortCac: { value: paidCac, status: paidCac == null ? 'unavailable' : 'estimated', attribution: 'allocated_average', scope: 'agregado da coorte Ads Meta explicita + Origem Desconhecida assumida como Meta, vinculada a retencao' },
          attributedCac: { value: null, status: 'unavailable', reason: 'CRM nao persiste campaign_id/adset_id/ad_id/click_id ate author_id' },
          individualCac: { value: null, status: 'unavailable', reason: 'sem chave deterministica entre custo Meta e creator' },
        },
        meta,
      },
      quality: {
        unknownOriginCreators: snapshot.creators.filter((row) => row.acquisition.key === 'unknown').length,
        explicitPaidCreators: snapshot.creators.filter((row) => row.acquisition.key === 'paid-meta' && row.acquisition.attributionBasis !== 'assumed_tracking_loss').length,
        assumedPaidCreators: snapshot.creators.filter((row) => row.acquisition.key === 'paid-meta' && row.acquisition.attributionBasis === 'assumed_tracking_loss').length,
        missingAdIdentity: true,
        partnershipStatusAvailable: false,
        commonClosedThrough,
      },
      monthly,
      sourceOptions,
      sourceBreakdown,
      systemBreakdown,
      creators: rowsForTable.slice(start, start + limit),
      pagination: { page, limit, total: rowsForTable.length, pages: Math.max(1, Math.ceil(rowsForTable.length / limit)) },
      caveats: [
        'Receita Amplify estimada = 10% da Est. commission do Partner Center.',
        'Est. commission inclui pedidos que podem ser reembolsados; nao representa lucro liquido contabil.',
        'CAC exibido e media agregada alocada da coorte Ads Meta explicita + Origem Desconhecida assumida como Meta por perda de tracking. A suposicao e regra operacional, nao atribuicao individual comprovada; o CRM nao persiste IDs Meta.',
        'AmplifyOS considera somente origens nativas Ads Meta, WhatsApp direto e Programa Indique; imports legados sao excluidos da Nova IA.',
        'Formulario preenchido exige correspondencia exata do @ ou de um alias historico; nomes parecidos nao sao unidos.',
        'Periodo observado inclui todo creator presente no relatorio acumulado da janela; primeira aparicao mede o primeiro dia observado no Partner Center dentro dela.',
        'Retornante = author_id com nova sequencia de dias apos pelo menos um dia ausente; dias sao datas distintas, nao o intervalo entre primeira e ultima aparicao.',
        'Super Afiliado usa membership exata no registro versionado de UTM; o restante do intake comprovado de referral fica em Indique e Ganhe.',
        'Creators observados sao author_ids presentes no relatorio creator_gmv acumulado da janela. O export nao possui status de parceria e nao mede Vinculados agora no Partner Center.',
        'Agenciados por dia vem do relatorio Criador consultado com inicio e fim iguais para cada data. Creators com GMV no dia e uma serie separada e nao substitui a contagem de agenciados.',
        'Saida observada = author_id presente no dia anterior e ausente no dia atual. Nao e evento oficial de desvinculacao; uma volta posterior aparece como retorno.',
        'GMV previo 30d associado as saidas soma o GMV dos 30 dias fechados anteriores a cada evento. Mede potencial que saiu da base observada, nao perda contabil nem projecao contrafactual.',
        'Resultado apos custos conhecidos subtrai apenas categorias comprovadas no periodo. Hoje inclui trafego pago Meta; IA, Indique e Ganhe e outros custos permanecem pendentes e nao sao tratados como zero.',
      ],
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return Response.json({ error: `Nao foi possivel carregar CAC x LTV: ${error.message}` }, { status: 500 })
  }
}
