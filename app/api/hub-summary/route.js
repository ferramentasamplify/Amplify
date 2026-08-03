import { HUB_FALLBACK } from '@/lib/hub-fallback-summary'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CLUB_URL = 'https://amplify-club-retencao.netlify.app/dashboard-data.json'
const SUPER_UTMS = ['giselecorreia', 'jota_', 'andreeleia_']

function safeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

async function fetchJson(url, timeoutMs = 18000) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 160)}`)
  return JSON.parse(text)
}

async function metaSummary(origin) {
  const until = todayISO()
  const since = daysAgoISO(30)
  const data = await fetchJson(`${origin}/api/meta?since=${since}&until=${until}&level=campaign`, 12000)
  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
  const totals = rows.reduce((acc, r) => {
    acc.spend += safeNumber(r.spend ?? r.gasto)
    acc.impressions += safeNumber(r.impressions)
    acc.reach += safeNumber(r.reach)
    acc.clicks += safeNumber(r.clicks)
    acc.leads += safeNumber(r.leads ?? r.results ?? r.resultados)
    return acc
  }, { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 })
  totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0
  totals.cpl = totals.leads ? totals.spend / totals.leads : null
  return { source: 'api/meta', range: { since, until }, totals }
}

async function acquisitionSummary(origin) {
  const to = todayISO()
  const from = daysAgoISO(30)
  const payload = await fetchJson(`${origin}/api/notion?from=${from}&to=${to}&level=summary`, 6000)
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const total = rows.length
  const agenciados = rows.filter(r => ['agenciado', 'convite aceito'].includes(String(r.fase || '').toLowerCase())).length
  const byOrigem = new Map()
  for (const r of rows) {
    const key = r.origem || 'Origem Desconhecida'
    byOrigem.set(key, (byOrigem.get(key) || 0) + 1)
  }
  const top = [...byOrigem.entries()].sort((a,b) => b[1]-a[1])[0]
  return {
    total_leads: total,
    agenciados,
    conversion: total ? (agenciados / total) * 100 : 0,
    topOrigem: top?.[0],
    topOrigemLeads: top?.[1],
    referenceLabel: `${from} → ${to}`,
  }
}

async function clubSummary() {
  const data = await fetchJson(CLUB_URL, 15000)
  const totals = data.totals || {}
  const byCategoria = Object.fromEntries(
    Object.entries(data.categories || {}).map(([name, value]) => [name, value.creators?.length ?? 0])
  )
  return {
    total: totals.creators,
    activeCreators: totals.creators,
    totalGmv: totals.gmv,
    amplifyRevenue: totals.amplify_commission,
    byCategoria,
    referenceLabel: data.reference?.label,
    updatedAt: data.reference?.generated_at,
  }
}

async function superAfiliadoSummary(origin) {
  const results = await Promise.allSettled(
    SUPER_UTMS.map(utm => fetchJson(`${origin}/api/superafiliado-data?utm=${encodeURIComponent(utm)}&_hub=${Date.now()}`, 22000))
  )
  const fulfilled = results.filter(r => r.status === 'fulfilled').map(r => r.value?.summary || {})
  if (!fulfilled.length) throw new Error('sem dados dos afiliados')
  return fulfilled.reduce((acc, s) => {
    acc.total += safeNumber(s.total)
    acc.agenciados += safeNumber(s.agenciados)
    acc.totalGmv += safeNumber(s.totalGmv)
    acc.totalCom += safeNumber(s.totalCom)
    acc.giseleEarn += safeNumber(s.giseleEarn)
    acc.amplifyTotalGmv = Math.max(acc.amplifyTotalGmv, safeNumber(s.amplifyTotalGmv))
    acc.amplifyTotalRevenue = Math.max(acc.amplifyTotalRevenue, safeNumber(s.amplifyTotalRevenue))
    acc.updatedAt = s.updatedAt || acc.updatedAt
    return acc
  }, { total: 0, agenciados: 0, totalGmv: 0, totalCom: 0, giseleEarn: 0, amplifyTotalGmv: 0, amplifyTotalRevenue: 0, updatedAt: null })
}

async function indiqueSummary(origin) {
  // O endpoint completo pode ser pesado; limite curto para nao quebrar o Hub.
  const payload = await fetchJson(`${origin}/api/indiqueeganhe`, 5000)
  const summary = payload?.summary || payload?.data?.summary || payload || {}
  return {
    total: summary.total,
    agenciados: summary.totalAgenciados ?? summary.agenciados,
    conversion: summary.conversionRate ?? summary.conversion,
    totalGeneratedCommission: summary.totalGeneratedCommission,
    totalGmv: summary.totalGmv,
    totalCom: summary.totalCom,
    indiqueEarn: summary.indiqueEarn,
    updatedAt: summary.updatedAt,
  }
}

async function missionControlOverview() {
  try {
    return await fetchJson('http://127.0.0.1:3016/api/executive-overview', 8000)
  } catch {
    return null
  }
}

export async function GET(request) {
  const missionControl = await missionControlOverview()
  return Response.json({
    updatedAt: missionControl?.updatedAt || new Date().toISOString(),
    missionControl,
    meta: { ...HUB_FALLBACK.meta, fallback: true },
    indique: { ...HUB_FALLBACK.indique, fallback: true },
    club: { ...HUB_FALLBACK.club, fallback: true },
    acquisition: { ...HUB_FALLBACK.acquisition, fallback: true },
    superAfiliado: { ...HUB_FALLBACK.superAfiliado, fallback: true },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
