import { readFile } from 'node:fs/promises'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/creator-economics-live.json'
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
    for (const month of monthsBetween(fromMonth, toMonth)) {
      const monthFrom = month === fromMonth ? from : `${month}-01`
      const monthTo = month === toMonth ? to : lastDay(month)
      const params = new URLSearchParams({
        access_token: env.META_ACCESS_TOKEN,
        fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,results,actions',
        time_range: JSON.stringify({ since: monthFrom, until: monthTo }),
        level: 'ad',
        limit: '500',
      })
      let next = `https://graph.facebook.com/${META_API_VERSION}/${env.META_AD_ACCOUNT_ID}/insights?${params}`
      for (let page = 0; next && page < 8; page += 1) {
        const response = await fetch(next, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw new Error(`Meta Graph respondeu ${response.status} em ${month}`)
        const payload = await response.json()
        rows.push(...(Array.isArray(payload.data) ? payload.data : []))
        next = payload.paging?.next || null
      }
    }
    const creatorRows = rows.filter((row) => !/marcas?/i.test(row.campaign_name || ''))
    const value = {
      source: 'Meta Ads ao vivo', stale: false, error: null, from, to,
      spend: round(creatorRows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0)),
      results: round(creatorRows.reduce((sum, row) => sum + metaResultValue(row), 0)),
      ads: creatorRows.length,
      generatedAt: new Date().toISOString(),
    }
    metaCache.set(cacheKey, { cachedAt: Date.now(), value })
    return value
  } catch (error) {
    const value = { source: 'Meta Ads ao vivo', stale: true, error: error.message, spend: null, results: null, ads: 0, generatedAt: null }
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
      ],
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return Response.json({ error: `Nao foi possivel carregar CAC x LTV: ${error.message}` }, { status: 500 })
  }
}
