import { readFile } from 'node:fs/promises'
import fallbackSnapshot from '@/data/growth-funnels-fallback.json'
import { buildAudienceTree, buildMetaHierarchy } from '@/lib/growth-funnel-tree.mjs'
import { buildNewBrandFunnel } from '@/lib/new-brand-funnel.mjs'
import { aggregateLpVariants, mergeLpVariantVisits } from '@/lib/lp-variant-metrics.mjs'
import { aggregateTrackingEvents, loadTrackingEvents } from '@/lib/new-brand-funnel-events.mjs'
import {
  buildLpSignalMetrics,
  buildWebinarCampaignMetrics,
  extractPixelEventTotals,
} from '@/lib/new-brand-funnel-live.mjs'
import { isNetlifyGrowthFunnelsRequest, proxyGrowthFunnels } from '@/lib/growth-funnels-upstream.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const LIVE_PATH = '/var/lib/amplify-hub/growth-funnels-live.json'
const NEW_BRAND_EVENTS_PATH = '/var/lib/amplify-hub/new-brand-funnel-events.jsonl'
const META_ENV_PATH = '/root/.openclaw/workspaces/analista-trafego/.env'
const META_API_VERSION = 'v19.0'
const DEFAULT_WEBINAR_CAMPAIGN_NAME = 'LEADS | MARCAS | WEBINAR TIKTOK SHOP | AGO26'
const WEBINAR_LAUNCH_AT = '2026-08-09T18:00:00.000Z'
const NOTION_API_VERSION = '2022-06-28'

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
    amplifyGain: null,
  }))

  const totalStages = stageValues(rows)
  const channels = config.channels.map((channel) => {
    const subset = rows.filter((row) => row.c === channel.key)
    const stages = stageValues(subset, channel.stages || config.stages, channel.rankField || 'r')
    const connected = audience === 'brands' || channel.key === 'sniper'
      ? subset.filter((row) => row.x === true).length
      : null
    const sellerLabels = [...new Set(subset.map((row) => typeof row.v === 'string' ? row.v.trim() : '').filter(Boolean))]
    const sellers = sellerLabels.map((label) => {
      const sellerRows = subset.filter((row) => typeof row.v === 'string' && row.v.trim() === label)
      return {
        key: label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
        label,
        leads: sellerRows.length,
        stages: stageValues(sellerRows, channel.stages || config.stages, channel.rankField || 'r'),
      }
    })
    return { ...channel, leads: subset.length, connected, stages, sellers }
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

function parseEnvFile(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
  }))
}

function metaResultValue(results) {
  if (!Array.isArray(results)) return null
  const values = results.flatMap((result) => Array.isArray(result.values) ? result.values : [])
  if (!values.length) return null
  return values.reduce((total, item) => total + (Number(item.value) || 0), 0)
}

async function readMetaRange(from, to) {
  try {
    const env = parseEnvFile(await readFile(META_ENV_PATH, 'utf8'))
    if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) throw new Error('credenciais Meta não configuradas')
    const params = new URLSearchParams({
      access_token: env.META_ACCESS_TOKEN,
      fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions,results',
      time_range: JSON.stringify({ since: from, until: to }),
      level: 'ad',
      limit: '500',
    })
    let next = `https://graph.facebook.com/${META_API_VERSION}/${env.META_AD_ACCOUNT_ID}/insights?${params}`
    const rows = []
    for (let page = 0; next && page < 5; page += 1) {
      const response = await fetch(next, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Meta Graph respondeu ${response.status}`)
      const payload = await response.json()
      rows.push(...(Array.isArray(payload.data) ? payload.data : []))
      next = payload.paging?.next || null
    }
    const ads = rows.map((row) => ({
      id: row.ad_id,
      name: row.ad_name,
      campaign: row.campaign_name,
      campaign_id: row.campaign_id,
      adset: row.adset_name,
      adset_id: row.adset_id,
      segment: /marcas?/i.test(row.campaign_name || '') ? 'brand' : 'creator',
      recent: {
        spend: Number(row.spend) || 0,
        results: metaResultValue(row.results),
      },
    })).filter((ad) => ad.recent.spend > 0 || (ad.recent.results || 0) > 0)
    return {
      ads,
      rows,
      source: 'Meta Ads ao vivo',
      reference: `${from} a ${to}`,
      generatedAt: new Date().toISOString(),
      stale: false,
      error: null,
    }
  } catch (error) {
    return { ads: [], rows: [], source: 'Meta Ads ao vivo', reference: `${from} a ${to}`, generatedAt: null, stale: true, error: error.message }
  }
}

async function readPixelEventTotals(from, to) {
  const pixelId = process.env.NEW_BRAND_FUNNEL_PIXEL_ID || ''
  if (!pixelId) return { totals: {}, configured: false, stale: true, error: 'Pixel do webinar nao configurado no Hub' }
  try {
    const env = parseEnvFile(await readFile(META_ENV_PATH, 'utf8'))
    if (!env.META_ACCESS_TOKEN) throw new Error('token Meta nao configurado')
    const periodStart = Date.parse(`${from}T00:00:00.000-03:00`)
    const launchStart = Date.parse(process.env.NEW_BRAND_FUNNEL_LAUNCH_AT || WEBINAR_LAUNCH_AT)
    const startTime = Math.floor(Math.max(periodStart, launchStart) / 1000)
    const endTime = Math.floor(Date.parse(`${to}T23:59:59.999-03:00`) / 1000)
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
      return { totals: {}, configured: true, stale: false, error: null, reference: `${from} a ${to}` }
    }
    const params = new URLSearchParams({
      access_token: env.META_ACCESS_TOKEN,
      aggregation: 'event_total_counts',
      start_time: String(startTime),
      end_time: String(endTime),
      limit: '100',
    })
    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${pixelId}/stats?${params}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Meta Pixel respondeu ${response.status}`)
    const payload = await response.json()
    return {
      totals: extractPixelEventTotals(payload),
      configured: true,
      stale: false,
      error: null,
      reference: `${new Date(startTime * 1000).toISOString()} ate ${to}`,
    }
  } catch (error) {
    return { totals: {}, configured: true, stale: true, error: error.message, reference: `${from} a ${to}` }
  }
}

async function readNotionPurchaseIntentCount(from, to) {
  const token = process.env.NOTION_FUNIL_MENTORIA_SECRET || ''
  const databaseId = process.env.NOTION_FUNIL_MENTORIA_DATABASE_ID || ''
  const reference = `${from} a ${to}`
  if (!token || !databaseId) {
    return { value: null, available: false, stale: true, error: 'Notion do Funil Mentoria nao configurado', reference }
  }
  try {
    const nextDay = new Date(`${to}T12:00:00.000Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const before = nextDay.toISOString().slice(0, 10)
    let total = 0
    let cursor = null
    for (let page = 0; page < 20; page += 1) {
      const body = {
        page_size: 100,
        filter: {
          and: [
            { property: 'Etapa do funil', select: { equals: 'Clicou em comprar' } },
            { property: 'Criado em', created_time: { on_or_after: `${from}T00:00:00-03:00` } },
            { property: 'Criado em', created_time: { before: `${before}T00:00:00-03:00` } },
          ],
        },
      }
      if (cursor) body.start_cursor = cursor
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`Notion respondeu ${response.status}`)
      const payload = await response.json()
      total += Array.isArray(payload.results) ? payload.results.length : 0
      if (!payload.has_more) break
      cursor = payload.next_cursor
      if (!cursor) break
    }
    return { value: total, available: true, stale: false, error: null, reference, stage: 'Clicou em comprar' }
  } catch (error) {
    return { value: null, available: false, stale: true, error: error.message, reference }
  }
}

async function readNotionVariantMetrics(from, to) {
  const token = process.env.NOTION_FUNIL_MENTORIA_SECRET || ''
  const databaseId = process.env.NOTION_FUNIL_MENTORIA_DATABASE_ID || ''
  const reference = `${from} a ${to}`
  if (!token || !databaseId) {
    return { rows: [], totalLeads: null, totalPurchaseIntents: null, unidentified: null, available: false, stale: true, error: 'Notion do Funil Mentoria nao configurado', reference }
  }
  try {
    const nextDay = new Date(`${to}T12:00:00.000Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const before = nextDay.toISOString().slice(0, 10)
    const pages = []
    let cursor = null
    for (let page = 0; page < 20; page += 1) {
      const body = {
        page_size: 100,
        filter: {
          and: [
            { property: 'Criado em', created_time: { on_or_after: `${from}T00:00:00-03:00` } },
            { property: 'Criado em', created_time: { before: `${before}T00:00:00-03:00` } },
          ],
        },
      }
      if (cursor) body.start_cursor = cursor
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`Notion respondeu ${response.status}`)
      const payload = await response.json()
      pages.push(...(Array.isArray(payload.results) ? payload.results : []))
      if (!payload.has_more) break
      cursor = payload.next_cursor
      if (!cursor) break
    }
    return { ...aggregateLpVariants(pages), available: true, stale: false, error: null, reference }
  } catch (error) {
    return { rows: [], totalLeads: null, totalPurchaseIntents: null, unidentified: null, available: false, stale: true, error: error.message, reference }
  }
}

async function readLpVariantVisits(from, to) {
  const reference = `${from} a ${to}`
  const endpoint = process.env.NEW_BRAND_FUNNEL_LP_VIEWS_ENDPOINT
    || 'https://n8n.amplifyugc.co/webhook/metodoChinesTracking20260813/webhook%2520-%2520visitas%2520por%2520lp/webinar-tiktok-shop-lp-views'
  try {
    const url = new URL(endpoint)
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`n8n respondeu ${response.status}`)
    const payload = await response.json()
    return { ...payload, available: payload?.available === true, stale: false, error: null, reference }
  } catch (error) {
    return { rows: [], metric: null, available: false, stale: true, error: error.message, reference }
  }
}

export async function GET(request) {
  try {
    if (process.env.NETLIFY === 'true' || isNetlifyGrowthFunnelsRequest(request)) return await proxyGrowthFunnels(request)

    const { snapshot, source, liveError } = await readSnapshot()
    const url = new URL(request.url)
    const coverageFrom = snapshot.coverage?.from || '2026-07-01'
    const coverageTo = snapshot.coverage?.to || new Date().toISOString().slice(0, 10)
    let from = safeDate(url.searchParams.get('from'), coverageFrom)
    let to = safeDate(url.searchParams.get('to'), coverageTo)
    if (from < coverageFrom) from = coverageFrom
    if (to > coverageTo) to = coverageTo
    if (from > to) [from, to] = [to, from]

    const [meta, pixelEvents, notionPurchaseIntent, notionVariants, lpVariantVisits] = await Promise.all([
      readMetaRange(from, to),
      readPixelEventTotals(from, to),
      readNotionPurchaseIntentCount(from, to),
      readNotionVariantMetrics(from, to),
      readLpVariantVisits(from, to),
    ])
    const variantsWithVisits = notionVariants.available
      ? { ...mergeLpVariantVisits(notionVariants, lpVariantVisits), visitMetrics: lpVariantVisits }
      : notionVariants
    const creators = aggregate(snapshot, 'creators', from, to)
    const brands = aggregate(snapshot, 'brands', from, to)
    const metaReference = meta.generatedAt
      ? `${meta.reference} · ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(meta.generatedAt))}`
      : meta.reference
    const hierarchy = {
      creators: buildAudienceTree(creators, {
        paidChildren: buildMetaHierarchy(meta.ads, 'creators', { reference: metaReference }),
        reference: `${from} a ${to}`,
      }),
      brands: buildAudienceTree(brands, {
        paidChildren: buildMetaHierarchy(meta.ads, 'brands', { reference: metaReference }),
        reference: `${from} a ${to}`,
      }),
    }
    const newBrandPath = process.env.NEW_BRAND_FUNNEL_EVENTS_PATH || NEW_BRAND_EVENTS_PATH
    const connectedEventNames = (process.env.NEW_BRAND_FUNNEL_CONNECTED_EVENTS || '')
      .split(',').map((item) => item.trim()).filter(Boolean)
    let trackingRead = { events: [], invalidLines: 0 }
    let trackingReadError = null
    try {
      trackingRead = await loadTrackingEvents(newBrandPath)
    } catch (error) {
      trackingReadError = error instanceof Error ? error.message : 'falha ao ler eventos'
    }
    const trackingAggregate = aggregateTrackingEvents(trackingRead.events, { from, to, connectedEventNames })
    const webinarCampaign = buildWebinarCampaignMetrics(meta.rows, {
      campaignName: process.env.NEW_BRAND_FUNNEL_META_CAMPAIGN_NAME || DEFAULT_WEBINAR_CAMPAIGN_NAME,
      leadCustomConversionId: process.env.NEW_BRAND_FUNNEL_LEAD_CUSTOM_CONVERSION_ID || '',
      reference: metaReference,
    })
    const lpSignals = {
      ...buildLpSignalMetrics(pixelEvents.totals, {
        fallbackLeadCount: webinarCampaign.values.leads,
        reference: pixelEvents.reference,
        webinarLeadTrackingSince: process.env.NEW_BRAND_FUNNEL_WEBINAR_LEAD_SINCE || null,
      }),
      available: pixelEvents.configured && !pixelEvents.stale,
      stale: pixelEvents.stale,
      error: pixelEvents.error,
    }
    const connectedValues = { ...trackingAggregate.values }
    if (webinarCampaign.found && !meta.stale) {
      connectedValues['creative-view'] = webinarCampaign.values.videoViews
      connectedValues['landing-view'] = webinarCampaign.values.landingPageViews
      connectedValues['diagnostic-form'] = webinarCampaign.values.leads
    }
    if (notionPurchaseIntent.available) {
      connectedValues['purchase-intent'] = notionPurchaseIntent.value
    }
    const builtNewBrandFunnel = buildNewBrandFunnel(connectedValues, { reference: `${from} a ${to}` })
    const liveSourceLabels = {
      'creative-view': 'Meta Ads · video_view',
      'landing-view': 'Meta Ads · landing_page_view',
      'diagnostic-form': 'Meta Ads · conversao especifica do webinar',
      'purchase-intent': 'Notion · Funil Mentoria · Clicou em comprar',
    }
    const newBrandFunnel = {
      ...builtNewBrandFunnel,
      stages: builtNewBrandFunnel.stages.map((stage) => stage.value == null || !liveSourceLabels[stage.key]
        ? stage
        : { ...stage, sourceLabel: liveSourceLabels[stage.key] }),
      live: {
        campaign: { ...webinarCampaign, available: webinarCampaign.found && !meta.stale, stale: meta.stale, error: meta.error },
        lp: lpSignals,
        notionPurchaseIntent,
        variants: variantsWithVisits,
      },
      tracking: {
        endpoint: '/api/new-brand-funnel/events',
        receiverConfigured: Boolean(process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN),
        connectedEventNames: trackingAggregate.connectedEventNames,
        acceptedEvents: trackingAggregate.acceptedEvents,
        duplicateEvents: trackingAggregate.duplicateEvents,
        invalidEvents: trackingAggregate.invalidEvents + trackingRead.invalidLines,
        readError: trackingReadError,
        metaConnectedStages: builtNewBrandFunnel.stages.filter((stage) => stage.value != null).map((stage) => stage.key),
      },
    }
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
      metaSource: {
        source: meta.source,
        generatedAt: meta.generatedAt,
        reference: metaReference,
        stale: meta.stale,
        error: meta.error,
      },
      summary: {
        creators: creators.totals,
        brands: brands.totals,
      },
      audiences: { creators, brands },
      hierarchy,
      newBrandFunnel,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return Response.json({ error: `Nao foi possivel carregar os funis: ${error.message}` }, { status: 500 })
  }
}
