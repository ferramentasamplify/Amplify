const CAMPAIGN_STAGES = Object.freeze([
  { key: 'impressions', label: 'Impressoes' },
  { key: 'videoViews', label: 'Visualizacoes de video' },
  { key: 'linkClicks', label: 'Cliques no link' },
  { key: 'landingPageViews', label: 'Acessos na LP' },
  { key: 'leads', label: 'Leads confirmados' },
])

const LP_STAGES = Object.freeze([
  { key: 'pageViews', eventName: 'WebinarPageView', label: 'Acessos na LP' },
  { key: 'formStarts', eventName: 'WebinarFormStart', label: 'Inicios do formulario' },
  { key: 'leads', eventName: 'WebinarLead', label: 'Leads do webinar' },
  { key: 'purchaseIntents', eventName: 'WebinarPurchaseIntent', label: 'Intencoes de compra' },
])

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function conversion(from, to) {
  if (from == null || to == null || from <= 0 || to > from) return null
  return (to / from) * 100
}

export function actionTotal(rows, actionTypes) {
  const accepted = new Set(Array.isArray(actionTypes) ? actionTypes : [actionTypes])
  return (Array.isArray(rows) ? rows : []).reduce((total, row) => {
    const actions = Array.isArray(row.actions) ? row.actions : []
    return total + actions.reduce((subtotal, action) => accepted.has(action.action_type)
      ? subtotal + number(action.value)
      : subtotal, 0)
  }, 0)
}

export function buildWebinarCampaignMetrics(rows, {
  campaignName,
  leadCustomConversionId,
  reference = null,
} = {}) {
  const campaignRows = (Array.isArray(rows) ? rows : []).filter((row) => row.campaign_name === campaignName)
  const customLeadType = leadCustomConversionId
    ? `offsite_conversion.custom.${leadCustomConversionId}`
    : null
  const customLeads = customLeadType ? actionTotal(campaignRows, customLeadType) : 0
  const values = {
    impressions: campaignRows.reduce((total, row) => total + number(row.impressions), 0),
    videoViews: actionTotal(campaignRows, 'video_view'),
    linkClicks: actionTotal(campaignRows, 'link_click'),
    landingPageViews: actionTotal(campaignRows, 'landing_page_view'),
    leads: customLeads || actionTotal(campaignRows, 'lead'),
  }
  const stages = CAMPAIGN_STAGES.map((stage) => ({ ...stage, value: values[stage.key] }))
    .map((stage, index, all) => ({
      ...stage,
      conversion: index === 0 ? null : conversion(all[index - 1].value, stage.value),
    }))
  const spend = campaignRows.reduce((total, row) => total + number(row.spend), 0)
  return {
    campaignName,
    reference,
    spend,
    cpl: values.leads > 0 ? spend / values.leads : null,
    stages,
    values,
    found: campaignRows.length > 0,
  }
}

export function extractPixelEventTotals(payload) {
  const totals = {}
  for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
    for (const item of Array.isArray(bucket?.data) ? bucket.data : []) {
      if (typeof item?.value !== 'string') continue
      totals[item.value] = (totals[item.value] || 0) + number(item.count)
    }
  }
  return totals
}

export function buildLpSignalMetrics(eventTotals, {
  fallbackLeadCount = 0,
  reference = null,
  webinarLeadTrackingSince = null,
} = {}) {
  const dedicatedLeadCount = number(eventTotals?.WebinarLead)
  const usesFallbackLead = dedicatedLeadCount === 0 && number(fallbackLeadCount) > 0
  const values = {
    pageViews: number(eventTotals?.WebinarPageView),
    formStarts: number(eventTotals?.WebinarFormStart),
    leads: usesFallbackLead ? number(fallbackLeadCount) : dedicatedLeadCount,
    purchaseIntents: number(eventTotals?.WebinarPurchaseIntent),
  }
  const stages = LP_STAGES.map((stage) => ({
    ...stage,
    value: values[stage.key],
    source: stage.key === 'leads' && usesFallbackLead
      ? 'Conversao especifica da campanha ate WebinarLead acumular dados'
      : `Pixel · ${stage.eventName}`,
  })).map((stage, index, all) => ({
    ...stage,
    conversion: index === 0 ? null : conversion(all[index - 1].value, stage.value),
    nonMonotonic: index > 0 && all[index - 1].value >= 0 && stage.value > all[index - 1].value,
  }))
  return {
    reference,
    webinarLeadTrackingSince,
    usesFallbackLead,
    stages,
    values,
  }
}
