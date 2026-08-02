import { readFile } from 'node:fs/promises'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/creator-economics-live.json'
const DAILY_LEDGER_MONTHLY = '/root/.openclaw/workspaces/retencao-gabriel/work/tiktok-shop-reports/creator-daily-ledger/monthly'
const PORTFOLIO_ANALYTICS_PATH = '/root/.openclaw/workspaces/retencao-gabriel/work/tiktok-shop-reports/creator-daily-ledger/meta/creator-portfolio-analytics.json'
const LAG_FORECAST_ANALYTICS_PATH = '/root/.openclaw/workspaces/retencao-gabriel/work/tiktok-shop-reports/creator-daily-ledger/meta/creator-lag-forecast-analytics.json'
const META_ENV_PATH = '/root/.openclaw/workspaces/analista-trafego/.env'
const META_API_VERSION = 'v19.0'
const metaCache = new Map()
const ASSUMED_META_KEYS = new Set(['paid-meta', 'unknown'])
const CREATOR_TIERS = [
  { key: 'start', label: 'Start', minExclusive: 0, maxInclusive: 5000, color: '#7D8A9D' },
  { key: 'silver', label: 'Silver', minExclusive: 5000, maxInclusive: 30000, color: '#AEB8C8' },
  { key: 'gold', label: 'Gold', minExclusive: 30000, maxInclusive: 100000, color: '#F6B84B' },
  { key: 'diamond', label: 'Diamond', minExclusive: 100000, maxInclusive: 500000, color: '#62D8FF' },
  { key: 'safira', label: 'Safira', minExclusive: 500000, maxInclusive: 1000000, color: '#6E78FF' },
]
const TIER_AUXILIARY = {
  'no-gmv': { key: 'no-gmv', label: 'Sem GMV' },
  'outside-base': { key: 'outside-base', label: 'Fora da base' },
  'above-safira': { key: 'above-safira', label: 'Acima de R$ 1 mi' },
}

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
function normalizeHandle(value) { return String(value || '').trim().toLowerCase().replace(/^@/, '') }
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
async function readCanonicalCreatorMonths(monthKeys) {
  const byCreator = new Map()
  const payloads = await Promise.all(monthKeys.map(async (month) => {
    const file = `${DAILY_LEDGER_MONTHLY}/${month}/creator_month_sum_from_days__${month}.json`
    const payload = JSON.parse(await readFile(file, 'utf8'))
    if (payload.schema_version !== 2 || payload.month !== month || payload.aggregation !== 'sum_of_one_day_creator_reports' || !Array.isArray(payload.items)) {
      throw new Error(`ledger mensal canonico invalido em ${month}`)
    }
    if (payload.coverage?.missing_through_last_day?.length || payload.coverage?.incomplete_days?.length) {
      throw new Error(`ledger mensal canonico incompleto em ${month}`)
    }
    return payload
  }))
  for (const payload of payloads) {
    for (const row of payload.items) {
      const authorId = String(row.author_id || '')
      if (!/^\d+$/.test(authorId) || !Number.isFinite(row.sum_cl_pay_amt) || !Number.isFinite(row.pre_estimated_commission) || !Number.isInteger(row.active_day_count)) {
        throw new Error(`creator mensal invalido em ${payload.month}: ${authorId || 'sem id'}`)
      }
      if (!byCreator.has(authorId)) byCreator.set(authorId, new Map())
      if (byCreator.get(authorId).has(payload.month)) throw new Error(`creator duplicado em ${payload.month}: ${authorId}`)
      byCreator.get(authorId).set(payload.month, {
        month: payload.month,
        snapshotDate: payload.coverage.last_day,
        gmv: round(row.sum_cl_pay_amt),
        estimatedCreatorCommission: round(row.pre_estimated_commission),
        estimatedAmplifyRevenue: round(row.pre_estimated_commission * 0.10),
        activeDays: row.active_day_count,
        matchMethod: 'author_id',
        matchedHandles: String(row.aliases || row.author_alias || '').split('|').map(normalizeHandle).filter(Boolean),
      })
    }
  }
  return byCreator
}
function classifyCreatorTier(gmv) {
  if (!Number.isFinite(gmv)) throw new Error('GMV mensal invalido para classificacao')
  if (gmv <= 0) return 'no-gmv'
  return CREATOR_TIERS.find((tier) => gmv > tier.minExclusive && gmv <= tier.maxInclusive)?.key || 'above-safira'
}
function buildCreatorTierAnalytics(byCreator, monthKeys) {
  const tierKeys = CREATOR_TIERS.map((tier) => tier.key)
  const tierIndex = new Map(tierKeys.map((key, index) => [key, index]))
  const labels = new Map([...CREATOR_TIERS, ...Object.values(TIER_AUXILIARY)].map((item) => [item.key, item.label]))
  const byMonth = new Map(monthKeys.map((month) => [month, new Map()]))
  for (const [authorId, months] of byCreator) {
    for (const month of monthKeys) {
      const item = months.get(month)
      if (item) byMonth.get(month).set(authorId, { tier: classifyCreatorTier(item.gmv), gmv: item.gmv })
    }
  }
  const monthly = monthKeys.map((month) => {
    const counts = Object.fromEntries([...tierKeys, 'no-gmv', 'above-safira'].map((key) => [key, 0]))
    let totalGmv = 0
    for (const item of byMonth.get(month).values()) {
      counts[item.tier] += 1
      totalGmv += item.gmv
    }
    const categorizedCreators = tierKeys.reduce((total, key) => total + counts[key], 0)
    return {
      month,
      observedCreators: byMonth.get(month).size,
      categorizedCreators,
      noGmvCreators: counts['no-gmv'],
      aboveSafiraCreators: counts['above-safira'],
      totalGmv: round(totalGmv),
      ...Object.fromEntries(tierKeys.map((key) => [key, counts[key]])),
    }
  })
  const transitions = monthKeys.slice(1).map((month, index) => {
    const fromMonth = monthKeys[index]
    const previous = byMonth.get(fromMonth)
    const current = byMonth.get(month)
    const ids = new Set([...previous.keys(), ...current.keys()])
    const matrixCounts = Object.fromEntries(tierKeys.map((fromKey) => [fromKey, Object.fromEntries(tierKeys.map((toKey) => [toKey, 0]))]))
    const flowCounts = new Map()
    let promoted = 0
    let demoted = 0
    let retained = 0
    let enteredTier = 0
    let leftTier = 0
    let enteredBase = 0
    let exitedBase = 0
    let aboveSafira = 0
    for (const authorId of ids) {
      const fromKey = previous.get(authorId)?.tier || 'outside-base'
      const toKey = current.get(authorId)?.tier || 'outside-base'
      const flowKey = `${fromKey}::${toKey}`
      flowCounts.set(flowKey, (flowCounts.get(flowKey) || 0) + 1)
      const fromInternal = tierIndex.has(fromKey)
      const toInternal = tierIndex.has(toKey)
      if (fromInternal && toInternal) {
        matrixCounts[fromKey][toKey] += 1
        if (tierIndex.get(toKey) > tierIndex.get(fromKey)) promoted += 1
        else if (tierIndex.get(toKey) < tierIndex.get(fromKey)) demoted += 1
        else retained += 1
      } else if (!fromInternal && toInternal) enteredTier += 1
      else if (fromInternal && !toInternal) leftTier += 1
      if (fromKey === 'outside-base' && toKey !== 'outside-base') enteredBase += 1
      if (fromKey !== 'outside-base' && toKey === 'outside-base') exitedBase += 1
      if (fromKey === 'above-safira' || toKey === 'above-safira') aboveSafira += 1
    }
    const matrix = tierKeys.map((fromKey) => ({
      from: fromKey,
      label: labels.get(fromKey),
      total: tierKeys.reduce((total, toKey) => total + matrixCounts[fromKey][toKey], 0),
      cells: tierKeys.map((toKey) => ({ to: toKey, label: labels.get(toKey), count: matrixCounts[fromKey][toKey] })),
    }))
    const flows = [...flowCounts.entries()].map(([key, count]) => {
      const [from, to] = key.split('::')
      return { from, fromLabel: labels.get(from), to, toLabel: labels.get(to), count }
    }).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    return {
      fromMonth,
      toMonth: month,
      fromObservedCreators: previous.size,
      toObservedCreators: current.size,
      evaluatedBetweenTiers: promoted + demoted + retained,
      promoted,
      demoted,
      retained,
      enteredTier,
      leftTier,
      enteredBase,
      exitedBase,
      aboveSafira,
      matrix,
      flows,
    }
  })
  return {
    source: 'ledger diario canonico Criador agregado por author_id e mes',
    definition: 'Classificacao pelo GMV mensal observado: Start > R$ 0 ate R$ 5 mil; Silver > R$ 5 mil ate R$ 30 mil; Gold > R$ 30 mil ate R$ 100 mil; Diamond > R$ 100 mil ate R$ 500 mil; Safira > R$ 500 mil ate R$ 1 milhao.',
    auxiliaryStates: 'Sem GMV e Fora da base sao estados auxiliares para explicar entradas e saidas; nao sao categorias internas. Valores acima de R$ 1 milhao ficam explicitamente fora da taxonomia Safira.',
    tiers: CREATOR_TIERS,
    monthly,
    transitions,
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
async function readLagForecastAnalytics() {
  let payload
  try {
    payload = JSON.parse(await readFile(LAG_FORECAST_ANALYTICS_PATH, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.maturity?.points) || !Array.isArray(payload.maturity?.monthlyCohorts) || !Array.isArray(payload.lagEffect?.points) || !Array.isArray(payload.forecast?.series)) {
    throw new Error('analytics de efeito e previsao invalidos')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.range?.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(payload.range?.to || '') || payload.range.days < 90) {
    throw new Error('cobertura invalida nos analytics de efeito e previsao')
  }
  if (!Number.isFinite(payload.forecast.forecastGmv) || !Number.isFinite(payload.forecast.lowGmv) || !Number.isFinite(payload.forecast.highGmv) || payload.forecast.lowGmv > payload.forecast.forecastGmv || payload.forecast.forecastGmv > payload.forecast.highGmv) {
    throw new Error('previsao de GMV invalida')
  }
  return payload
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
    const assumedMeta = ASSUMED_META_KEYS.has(row.acquisition.key)
    const key = assumedMeta ? 'paid-meta' : row.acquisition.key
    const label = assumedMeta ? 'Meta Ads + tracking perdido' : row.acquisition.label
    if (!bySource.has(key)) bySource.set(key, { key, label, creators: 0, explicitCreators: 0, assumedTrackingLossCreators: 0, entered: 0, acquired: 0, matchedForms: 0, returned: 0, activeDays: 0, gmv: 0, estimatedCreatorCommission: 0, lifetimeRevenue: 0 })
    const item = bySource.get(key)
    item.creators += 1
    item.explicitCreators += row.acquisition.key === 'paid-meta' ? 1 : 0
    item.assumedTrackingLossCreators += row.acquisition.key === 'unknown' ? 1 : 0
    item.entered += row.enteredInRange ? 1 : 0
    item.acquired += (row.acquisition.key === 'unknown' ? row.enteredInRange : row.acquiredInRange) ? 1 : 0
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
    const sourceFilterRaw = url.searchParams.get('source') || 'all'
    const sourceFilter = sourceFilterRaw === 'unknown' ? 'paid-meta' : sourceFilterRaw
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase().replace(/^@/, '')
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(250, Math.max(25, Number(url.searchParams.get('limit')) || 100))
    const sort = url.searchParams.get('sort') || 'revenue'
    const monthKeys = monthsBetween(from, to)
    const [affiliationDaily, portfolioAnalytics, canonicalCreatorMonths, creatorLagAnalytics] = await Promise.all([
      readDailyAffiliation(from, to),
      readPortfolioAnalytics(from, to),
      readCanonicalCreatorMonths(monthKeys),
      readLagForecastAnalytics(),
    ])
    const creatorTierAnalytics = buildCreatorTierAnalytics(canonicalCreatorMonths, monthKeys)

    const activeRows = snapshot.creators.map((creator) => {
      const creatorMonths = canonicalCreatorMonths.get(String(creator.id))
      const monthly = monthKeys.map((month) => creatorMonths?.get(month)).filter(Boolean)
      if (!monthly.length) return null
      const knownHandles = new Set(monthly.flatMap((month) => month.matchedHandles))
      const crmHandles = [creator.handle, ...(creator.aliases || [])].map(normalizeHandle).filter(Boolean)
      if (!crmHandles.some((handle) => knownHandles.has(handle))) {
        throw new Error(`@ do CRM nao confere com ledger diario: ${creator.handle || creator.id}`)
      }
      const periodCommission = round(monthly.reduce((sum, month) => sum + month.estimatedCreatorCommission, 0))
      const period = {
        activeDays: monthly.reduce((sum, month) => sum + month.activeDays, 0),
        gmv: round(monthly.reduce((sum, month) => sum + month.gmv, 0)),
        estimatedCreatorCommission: periodCommission,
        estimatedAmplifyRevenue: round(periodCommission * 0.10),
        source: 'ledger_diario_canonico',
        matchMethod: 'author_id_and_exact_handle',
      }
      const observedLtv = period.estimatedAmplifyRevenue
      return {
        ...creator,
        monthly,
        period,
        observedLtv,
        ledgerMatch: { authorId: String(creator.id), handle: creator.handle, exact: true },
        enteredInRange: inDateRange(creator.firstLinked, from, to),
        acquiredInRange: inDateRange(creator.acquisition.entryAt, from, to),
        returnedInRange: creator.returnDates.some((date) => inDateRange(date, from, to)),
      }
    }).filter(Boolean)

    const sourceOptions = sourceAggregate(activeRows).map(({ key, label, creators }) => ({ key, label, creators }))
    const filtered = sourceFilter === 'all' ? activeRows : activeRows.filter((row) => sourceFilter === 'paid-meta' ? ASSUMED_META_KEYS.has(row.acquisition.key) : row.acquisition.key === sourceFilter)
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

    const commonFrom = affiliationDaily.range.from
    const commonClosedThrough = affiliationDaily.range.to
    const meta = await readMetaRange(commonFrom, commonClosedThrough)
    const paidRows = activeRows.filter((row) => ASSUMED_META_KEYS.has(row.acquisition.key))
    const paidCohort = paidRows.filter((row) => row.acquisition.key === 'unknown' ? row.enteredInRange : row.acquiredInRange)
    const paidCac = meta.spend !== null && paidCohort.length ? round(meta.spend / paidCohort.length) : null
    const paidGmv = round(paidRows.reduce((sum, row) => sum + row.period.gmv, 0))
    const paidEstimatedCreatorCommission = round(paidRows.reduce((sum, row) => sum + row.period.estimatedCreatorCommission, 0))
    const paidLifetimeRevenue = round(paidEstimatedCreatorCommission * 0.10)
    const paidAvgObservedLtv = paidRows.length ? round(paidLifetimeRevenue / paidRows.length) : null
    const paidLtvCac = paidCac ? round(paidAvgObservedLtv / paidCac) : null
    const paidGmvPerReal = meta.spend ? round(paidGmv / meta.spend) : null
    const paidRevenuePerReal = meta.spend ? round(paidLifetimeRevenue / meta.spend) : null

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
        creators: item.creators,
        explicitCreators: item.explicitCreators,
        assumedTrackingLossCreators: item.assumedTrackingLossCreators,
        gmv: item.gmv,
        estimatedCreatorCommission: item.estimatedCreatorCommission,
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
        gmv: 'GMV por origem = soma de sum_cl_pay_amt no ledger diario, unida ao CRM pelo author_id e conferida pelo @ exato.',
        revenue: 'Receita Amplify estimada = 10% da comissao estimada do creator no Partner Center.',
        knownCost: 'Soma apenas categorias com valor e data comprovados. Hoje: trafego pago Meta.',
        result: 'Receita Amplify estimada menos custos conhecidos. Nao e lucro liquido enquanto houver custos pendentes.',
        origin: 'Meta Ads inclui origem explicita e Origem nao identificada assumida como Meta por perda de tracking. Custos ausentes permanecem pendentes, nunca zero.',
      },
    }
    const entered = filtered.filter((row) => row.enteredInRange).length
    const matchedForms = filtered.filter((row) => row.form.matched).length
    const returned = filtered.filter((row) => row.returnedInRange).length
    const lifetimeRevenue = round(filtered.reduce((sum, row) => sum + row.observedLtv, 0))
    const rowsForTable = filtered.filter((row) => !query || row.handle.includes(query) || row.aliases.some((alias) => alias.includes(query)))
      .map((row) => ({
        ...row,
        allocatedCac: ASSUMED_META_KEYS.has(row.acquisition.key) && (row.acquisition.key === 'unknown' ? row.enteredInRange : row.acquiredInRange) ? paidCac : null,
        ltvCac: ASSUMED_META_KEYS.has(row.acquisition.key) && (row.acquisition.key === 'unknown' ? row.enteredInRange : row.acquiredInRange) && paidCac ? round(row.observedLtv / paidCac) : null,
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
      creatorTierAnalytics,
      creatorLagAnalytics,
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
        attributedCreators: paidRows.length,
        explicitMetaCreators: paidRows.filter((row) => row.acquisition.key === 'paid-meta').length,
        assumedTrackingLossCreators: paidRows.filter((row) => row.acquisition.key === 'unknown').length,
        spend: meta.spend,
        leads: meta.results,
        leadCpl: meta.spend !== null && meta.results ? round(meta.spend / meta.results) : null,
        acquiredCac: paidCac,
        avgObservedLtv: paidAvgObservedLtv,
        ltvCac: paidLtvCac,
        lifetimeRevenue: paidLifetimeRevenue,
        gmv: paidGmv,
        estimatedCreatorCommission: paidEstimatedCreatorCommission,
        estimatedAmplifyRevenue: paidLifetimeRevenue,
        gmvPerRealInvested: paidGmvPerReal,
        amplifyRevenuePerRealInvested: paidRevenuePerReal,
        resultAfterKnownCosts: meta.spend == null ? null : round(paidLifetimeRevenue - meta.spend),
        allocation: 'Meta inclui Ads Meta explicito + Origem nao identificada assumida como Meta por perda de tracking. Cada @ do CRM e unido ao ledger diario por author_id e conferido por correspondencia exata do @. O gasto continua agregado; nao e CAC individual atribuido.',
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
        explicitPaidCreators: snapshot.creators.filter((row) => row.acquisition.key === 'paid-meta').length,
        assumedPaidCreators: snapshot.creators.filter((row) => row.acquisition.key === 'unknown').length,
        exactLedgerMatches: activeRows.filter((row) => row.ledgerMatch.exact).length,
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
        'Periodo observado inclui todo creator presente em pelo menos um relatorio Criador diario fechado da janela; primeira aparicao mede o primeiro dia observado no Partner Center dentro dela.',
        'Retornante = author_id com nova sequencia de dias apos pelo menos um dia ausente; dias sao datas distintas, nao o intervalo entre primeira e ultima aparicao.',
        'Super Afiliado usa membership exata no registro versionado de UTM; o restante do intake comprovado de referral fica em Indique e Ganhe.',
        'GMV por creator e origem soma sum_cl_pay_amt dos dias fechados e cruza o author_id com o CRM, exigindo tambem correspondencia exata do @ ou alias. O GMV declarado no CRM nao e usado.',
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
