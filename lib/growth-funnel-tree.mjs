const EMPTY_METRICS = Object.freeze({
  investment: null,
  leads: null,
  mql: null,
  sql: null,
  meeting: null,
  converted: null,
  conversion: null,
  costPerLead: null,
  costPerSale: null,
  costLeadBasis: null,
})

function connectedNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sumMetric(items, key) {
  const values = items.map((item) => connectedNumber(item?.recent?.[key])).filter((value) => value != null)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

function nodeMetrics(overrides = {}) {
  return { ...EMPTY_METRICS, ...overrides }
}

function addUnitCosts(metrics) {
  const investment = connectedNumber(metrics.investment)
  const leads = connectedNumber(metrics.leads)
  const converted = connectedNumber(metrics.converted)
  metrics.costPerLead = investment != null && leads > 0 ? investment / leads : null
  metrics.costPerSale = investment != null && converted > 0 ? investment / converted : null
  metrics.costLeadBasis = metrics.costPerLead != null ? leads : null
  return metrics
}

function metaMetrics(ads) {
  return addUnitCosts(nodeMetrics({
    investment: sumMetric(ads, 'spend'),
    leads: sumMetric(ads, 'results'),
  }))
}

function matchesAudience(segment, audienceKey) {
  const value = String(segment || '').toLowerCase()
  return audienceKey === 'creators'
    ? value.includes('creator')
    : value.includes('marca') || value.includes('brand')
}

function adNode(ad, reference) {
  return {
    id: `ad:${ad.id || ad.name}`,
    type: 'ad',
    label: ad.name,
    source: 'Meta Ads / creative',
    reference,
    metrics: metaMetrics([ad]),
    children: [],
  }
}

export function buildMetaHierarchy(ads = [], audienceKey, { reference = null } = {}) {
  const eligible = ads.filter((ad) => matchesAudience(ad.segment, audienceKey) && ad.campaign)
  const campaigns = new Map()

  for (const ad of eligible) {
    if (!campaigns.has(ad.campaign)) campaigns.set(ad.campaign, [])
    campaigns.get(ad.campaign).push(ad)
  }

  return [...campaigns.entries()].map(([campaign, campaignAds]) => {
    const adsets = new Map()
    const directAds = []
    for (const ad of campaignAds) {
      if (!ad.adset) directAds.push(ad)
      else {
        if (!adsets.has(ad.adset)) adsets.set(ad.adset, [])
        adsets.get(ad.adset).push(ad)
      }
    }

    const children = [...adsets.entries()].map(([adset, adsetAds]) => ({
      id: `adset:${campaign}:${adset}`,
      type: 'adset',
      label: adset,
      source: 'Meta Ads / creative',
      reference,
      metrics: metaMetrics(adsetAds),
      children: adsetAds.filter((ad) => ad.name).map((ad) => adNode(ad, reference)),
    }))
    children.push(...directAds.filter((ad) => ad.name).map((ad) => adNode(ad, reference)))

    return {
      id: `campaign:${campaign}`,
      type: 'campaign',
      label: campaign,
      source: 'Meta Ads / creative',
      reference,
      metrics: metaMetrics(campaignAds),
      children,
    }
  }).sort((a, b) => (b.metrics.investment ?? -1) - (a.metrics.investment ?? -1))
}

function stageValue(stages, keys) {
  const stage = (stages || []).find((item) => keys.includes(item.key))
  return stage?.value ?? null
}

function funnelMetrics(node, audienceKey) {
  const stages = node.stages || []
  const isCreator = audienceKey === 'creators'
  const leads = node.leads ?? node.totals?.leads ?? stageValue(stages, ['leads'])
  const converted = node.totals?.converted ?? stageValue(stages, isCreator ? ['converted'] : ['closed'])
  return addUnitCosts(nodeMetrics({
    leads,
    mql: stageValue(stages, isCreator ? ['qualified', 'sdr-qualified'] : ['mapped']),
    sql: stageValue(stages, isCreator ? ['invite', 'accepted'] : ['qualified']),
    meeting: stageValue(stages, isCreator ? ['closer', 'meeting'] : ['meeting']),
    converted,
    conversion: leads > 0 && converted != null ? (converted / leads) * 100 : null,
  }))
}

export function buildAudienceTree(audience, { paidChildren = [], reference = null } = {}) {
  const children = (audience.channels || []).map((channel) => {
    const paidNested = channel.key === 'paid-meta' ? paidChildren : []
    const sellerNested = (channel.sellers || []).map((seller) => ({
      id: `seller:${audience.key}:${channel.key}:${seller.key}`,
      key: seller.key,
      type: 'seller',
      label: seller.label,
      source: 'Snapshot do funil',
      reference,
      metrics: funnelMetrics(seller, audience.key),
      stages: seller.stages || [],
      children: [],
    }))
    const nested = paidNested.length ? paidNested : sellerNested
    const metrics = funnelMetrics(channel, audience.key)
    if (channel.key === 'paid-meta' && paidNested.length) {
      const investments = paidNested.map((node) => node.metrics.investment).filter((value) => value != null)
      const metaLeads = paidNested.map((node) => node.metrics.leads).filter((value) => value != null)
      metrics.investment = investments.length ? investments.reduce((total, value) => total + value, 0) : null
      const metaLeadTotal = metaLeads.length ? metaLeads.reduce((total, value) => total + value, 0) : null
      metrics.costPerLead = metrics.investment != null && metaLeadTotal > 0 ? metrics.investment / metaLeadTotal : null
      metrics.costPerSale = null
      metrics.costLeadBasis = metrics.costPerLead != null ? metaLeadTotal : null
    } else {
      addUnitCosts(metrics)
    }
    return {
      id: `channel:${audience.key}:${channel.key}`,
      key: channel.key,
      type: 'channel',
      label: channel.label,
      tone: channel.tone || null,
      note: channel.note || null,
      source: channel.key === 'paid-meta' && nested.length ? 'Snapshot do funil + Meta Ads / creative' : 'Snapshot do funil',
      reference,
      metrics,
      stages: channel.stages || [],
      children: nested,
    }
  })

  return {
    id: `audience:${audience.key}`,
    key: audience.key,
    type: 'audience',
    label: audience.label,
    source: 'Snapshot do funil',
    reference,
    metrics: funnelMetrics(audience, audience.key),
    stages: audience.stages || [],
    children,
  }
}
