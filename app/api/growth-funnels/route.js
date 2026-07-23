import { readFile } from 'node:fs/promises'
import fallbackSnapshot from '@/data/growth-funnels-fallback.json'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/growth-funnels-live.json'

const SNIPER_STAGES = [
  { key: 'leads', label: 'Leads Sniper', rank: 0 },
  { key: 'crm', label: 'Sincronizados no SDR', rank: 1 },
  { key: 'sdr-qualified', label: 'Qualificados no SDR', rank: 2 },
  { key: 'closer', label: 'Reunião / Closer', rank: 3 },
  { key: 'invite', label: 'Convite enviado', rank: 4 },
  { key: 'accepted', label: 'Convite aceito', rank: 5 },
  { key: 'converted', label: 'Agenciados', rank: 6 },
]

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
      { key: 'sniper', label: 'Sniper outbound', short: 'Sniper', tone: 'blue', stages: SNIPER_STAGES, rankField: 'b', note: 'Etapas ao vivo: SDR + Closer de Aquisição no Bitrix' },
      { key: 'other', label: 'Outros canais', short: 'Outros', tone: 'slate' },
    ],
  },
  brands: {
    label: 'Marcas',
    stages: [
      { key: 'leads', label: 'Leads únicos', rank: 0 },
      { key: 'contacted', label: 'Abordados', rank: 1 },
      { key: 'mapped', label: 'Mapeados', rank: 2 },
      { key: 'qualified', label: 'Qualificados', rank: 3 },
      { key: 'meeting', label: 'Reunião / Closer', rank: 4 },
      { key: 'proposal', label: 'Proposta', rank: 5 },
      { key: 'closed', label: 'Ganhos', rank: 6 },
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

  const stageValues = (subset, stageDefinitions = config.stages, rankField = 'r') => stageDefinitions.map((stage, index) => {
    if (index > 0 && !stagesAvailable) return { ...stage, value: null, conversion: null, gmv: null, gmvCount: null, gmvCoverage: null, amplifyGain: null }
    const stageRows = index === 0 ? subset : subset.filter((row) => row[rankField] != null && Number(row[rankField]) >= stage.rank)
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
    const stages = stageValues(subset, channel.stages || config.stages, channel.rankField || 'r')
    const connected = audience === 'brands' || channel.key === 'sniper'
      ? subset.filter((row) => row.x === true).length
      : null
    return { ...channel, leads: subset.length, connected, stages }
  }).filter((channel) => channel.leads > 0 || channel.key === 'other')

  const financialGroups = audience === 'creators' && gmvAvailable
    ? [
        { key: 'machine', label: 'Máquina', rows: rows.filter((row) => row.c !== 'sniper'), stages: config.stages, rankField: 'r' },
        { key: 'sniper', label: 'Sniper', rows: rows.filter((row) => row.c === 'sniper'), stages: SNIPER_STAGES, rankField: 'b' },
      ].map((group) => {
        const stages = stageValues(group.rows, group.stages, group.rankField)
        const finalStage = stages.at(-1)
        return {
          key: group.key,
          label: group.label,
          stages,
          gmv: finalStage?.gmv ?? null,
          gmvCount: finalStage?.gmvCount ?? null,
          amplifyGain: finalStage?.amplifyGain ?? null,
        }
      })
    : null

  const byDay = new Map()
  for (const row of rows) {
    const item = byDay.get(row.d) || { date: row.d, leads: 0, converted: stagesAvailable ? 0 : null }
    item.leads += 1
    if (stagesAvailable && Number(row.r) >= config.stages.at(-1).rank) item.converted += 1
    byDay.set(row.d, item)
  }

  const filteredQuality = source.quality ? {
    ...source.quality,
    uniqueLeads: rows.length,
    bitrixMatchedLeads: rows.filter((row) => row.x === true).length,
    bitrixUnmatchedLeads: rows.filter((row) => row.x !== true).length,
  } : null
  const sniperRows = rows.filter((row) => row.c === 'sniper')
  const filteredBitrixQuality = source.bitrixQuality ? {
    ...source.bitrixQuality,
    sniperLeads: sniperRows.length,
    matchedLeads: sniperRows.filter((row) => row.x === true).length,
    unmatchedLeads: sniperRows.filter((row) => row.x !== true).length,
  } : null

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
    financialGroups,
    daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    coverage: source.coverage || {},
    quality: filteredQuality,
    bitrixQuality: filteredBitrixQuality,
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
      sources: snapshot.sources || {},
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
