import { readFile } from 'node:fs/promises'
import fallbackSnapshot from '@/data/growth-funnels-fallback.json'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/growth-funnels-live.json'

const AUDIENCE_CONFIG = {
  creators: {
    label: 'Creators',
    stages: [
      { key: 'leads', label: 'Leads que entraram', rank: 0 },
      { key: 'machine', label: 'Na máquina', rank: 1 },
      { key: 'qualified', label: 'Qualificados', rank: 2 },
      { key: 'invite', label: 'Convite enviado', rank: 3 },
      { key: 'converted', label: 'Agenciados', rank: 4 },
    ],
    channels: [
      { key: 'paid-meta', label: 'Pago / sem UTM', short: 'Pago', tone: 'violet', note: 'Ads Meta + origem desconhecida' },
      { key: 'instagram-organic', label: 'Instagram orgânico', short: 'Instagram', tone: 'pink' },
      { key: 'tiktok-organic', label: 'TikTok orgânico', short: 'TikTok', tone: 'cyan' },
      { key: 'referral', label: 'Indique e Ganhe', short: 'Indicação', tone: 'amber' },
      { key: 'sniper', label: 'Sniper outbound', short: 'Sniper', tone: 'blue' },
      { key: 'other', label: 'Outros canais', short: 'Outros', tone: 'slate' },
    ],
  },
  brands: {
    label: 'Marcas',
    stages: [
      { key: 'leads', label: 'Leads que entraram', rank: 0 },
      { key: 'contacted', label: 'Contato feito', rank: 1 },
      { key: 'qualified', label: 'Qualificados', rank: 2 },
      { key: 'meeting', label: 'Reunião', rank: 3 },
      { key: 'proposal', label: 'Proposta', rank: 4 },
      { key: 'closed', label: 'Fechados', rank: 5 },
    ],
    channels: [
      { key: 'paid-meta', label: 'Meta Ads', short: 'Pago', tone: 'coral' },
      { key: 'instagram-organic', label: 'Instagram orgânico', short: 'Instagram', tone: 'pink' },
      { key: 'tiktok-organic', label: 'TikTok orgânico', short: 'TikTok', tone: 'cyan' },
      { key: 'events', label: 'Eventos / Mansão', short: 'Eventos', tone: 'amber' },
      { key: 'referral', label: 'Indicação', short: 'Indicação', tone: 'green' },
      { key: 'site', label: 'Site / página', short: 'Site', tone: 'blue' },
      { key: 'other', label: 'Outros canais', short: 'Outros', tone: 'slate' },
    ],
  },
}

function safeDate(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : fallback
}

function percent(from, to) {
  if (from == null || to == null || from <= 0) return null
  return (to / from) * 100
}

function money(rows) {
  return rows.reduce((total, row) => total + (Number(row.g) || 0), 0)
}

function aggregate(snapshot, audience, from, to) {
  const config = AUDIENCE_CONFIG[audience]
  const source = snapshot[audience] || {}
  const rows = (Array.isArray(source.rows) ? source.rows : []).filter((row) => row.d >= from && row.d <= to)
  const stagesAvailable = source.coverage?.stages !== false
  const gmvAvailable = source.coverage?.gmv === true

  const stageValues = (subset) => config.stages.map((stage, index) => {
    if (index > 0 && !stagesAvailable) return { ...stage, value: null, conversion: null, gmv: null, gmvCount: null, gmvCoverage: null, amplifyGain: null }
    const stageRows = index === 0 ? subset : subset.filter((row) => Number(row.r) >= stage.rank)
    const value = stageRows.length
    const gmvCount = gmvAvailable ? stageRows.filter((row) => Number(row.g) > 0).length : null
    const gmv = gmvAvailable ? money(stageRows) : null
    return { ...stage, value, gmv, gmvCount, gmvCoverage: gmvAvailable ? percent(value, gmvCount) : null }
  }).map((stage, index, all) => ({
    ...stage,
    conversion: index === 0 ? null : percent(all[index - 1].value, stage.value),
    amplifyGain: index === all.length - 1 && stage.gmv != null ? stage.gmv * 0.01 : null,
  }))

  const totalStages = stageValues(rows)
  const channels = config.channels.map((channel) => {
    const subset = rows.filter((row) => row.c === channel.key)
    return { ...channel, leads: subset.length, stages: stageValues(subset) }
  }).filter((channel) => channel.leads > 0 || channel.key === 'other')

  const byDay = new Map()
  for (const row of rows) {
    const item = byDay.get(row.d) || { date: row.d, leads: 0, converted: stagesAvailable ? 0 : null }
    item.leads += 1
    if (stagesAvailable && Number(row.r) >= config.stages.at(-1).rank) item.converted += 1
    byDay.set(row.d, item)
  }

  return {
    key: audience,
    label: config.label,
    rows: rows.length,
    stagesAvailable,
    totals: {
      leads: totalStages[0]?.value || 0,
      converted: totalStages.at(-1)?.value ?? null,
      conversion: percent(totalStages[0]?.value, totalStages.at(-1)?.value),
      gmv: totalStages.at(-1)?.gmv ?? null,
      gmvCount: totalStages.at(-1)?.gmvCount ?? null,
      gmvCoverage: totalStages.at(-1)?.gmvCoverage ?? null,
      amplifyGain: totalStages.at(-1)?.amplifyGain ?? null,
    },
    stages: totalStages,
    channels,
    daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    coverage: source.coverage || {},
    quality: source.quality || null,
  }
}

async function readSnapshot() {
  try {
    return { snapshot: JSON.parse(await readFile(LIVE_PATH, 'utf8')), source: 'live' }
  } catch (liveError) {
    return { snapshot: fallbackSnapshot, source: 'fallback', liveError: liveError.message }
  }
}

export async function GET(request) {
  try {
    const { snapshot, source, liveError } = await readSnapshot()
    const url = new URL(request.url)
    const coverageFrom = snapshot.coverage?.from || '2026-07-01'
    const coverageTo = snapshot.coverage?.to || new Date().toISOString().slice(0, 10)
    let from = safeDate(url.searchParams.get('from'), coverageFrom)
    let to = safeDate(url.searchParams.get('to'), coverageTo)
    if (from < coverageFrom) from = coverageFrom
    if (to > coverageTo) to = coverageTo
    if (from > to) [from, to] = [to, from]

    const creators = aggregate(snapshot, 'creators', from, to)
    const brands = aggregate(snapshot, 'brands', from, to)
    return Response.json({
      generatedAt: snapshot.generatedAt,
      timezone: snapshot.timezone,
      source,
      stale: source !== 'live',
      liveError: source === 'fallback' ? liveError : undefined,
      coverage: snapshot.coverage,
      range: { from, to },
      methodology: snapshot.methodology,
      summary: {
        creators: creators.totals,
        brands: brands.totals,
      },
      audiences: { creators, brands },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return Response.json({ error: `Nao foi possivel carregar os funis: ${error.message}` }, { status: 500 })
  }
}
