import { readFile } from 'node:fs/promises'

export const dynamic = 'force-dynamic'

const REPORT_DIR = '/root/.openclaw/workspaces/analista-trafego/reports'

function safeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pctFromRatio(value) {
  const n = safeNumber(value)
  return n > 0 && n < 1 ? n * 100 : n
}

function segmentSummary(key, segment) {
  const mtd = segment?.mtd || {}
  return {
    key,
    label: segment?.label || key,
    spend: safeNumber(mtd.spend),
    impressions: safeNumber(mtd.impressions),
    reach: safeNumber(mtd.reach),
    clicks: safeNumber(mtd.clicks),
    leads: safeNumber(mtd.results),
    ctr: pctFromRatio(mtd.ctr),
    cpc: mtd.cpc == null ? null : safeNumber(mtd.cpc),
    cpm: mtd.cpm == null ? null : safeNumber(mtd.cpm),
    cpl: mtd.cpr == null ? null : safeNumber(mtd.cpr),
    targetMonth: segment?.target_month || null,
    targetQ3: segment?.target_q3 || null,
    remaining: segment?.remaining || null,
  }
}

export async function GET() {
  try {
    const [paceRaw, adsRaw] = await Promise.all([
      readFile(`${REPORT_DIR}/meta-q3-pace-2026-07-10.json`, 'utf8'),
      readFile(`${REPORT_DIR}/meta-ads-por-anuncio-2026-07-10.json`, 'utf8').catch(() => '{"items":[]}'),
    ])
    const pace = JSON.parse(paceRaw)
    const ads = JSON.parse(adsRaw)
    const segments = Object.entries(pace.segments || {}).map(([key, segment]) => segmentSummary(key, segment))
    const totals = segments.reduce((acc, s) => {
      acc.spend += s.spend
      acc.impressions += s.impressions
      acc.reach += s.reach
      acc.clicks += s.clicks
      acc.leads += s.leads
      return acc
    }, { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 })
    totals.ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0
    totals.cpc = totals.clicks ? totals.spend / totals.clicks : 0
    totals.cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0
    totals.cpl = totals.leads ? totals.spend / totals.leads : null
    totals.frequency = totals.reach ? totals.impressions / totals.reach : 0

    const topAds = (ads.items || [])
      .map((item) => ({
        id: item.id,
        name: item.name,
        campaign: item.campaign,
        adset: item.adset,
        segment: item.segment,
        spend: safeNumber(item.recent?.spend),
        leads: safeNumber(item.recent?.results),
        cpl: item.recent?.cpr == null ? null : safeNumber(item.recent.cpr),
        ctr: pctFromRatio(item.recent?.ctr),
      }))
      .filter((item) => item.spend > 0 || item.leads > 0)
      .sort((a, b) => (b.leads - a.leads) || ((a.cpl ?? 9999) - (b.cpl ?? 9999)))
      .slice(0, 12)

    return Response.json({
      source: 'OpenClaw / analista-trafego',
      generatedAt: pace.generated_at,
      range: pace.range,
      days: pace.days,
      totals,
      segments,
      topAds,
    })
  } catch (error) {
    return Response.json({ error: error?.message || 'Erro ao ler reports do analista de trafego' }, { status: 500 })
  }
}
