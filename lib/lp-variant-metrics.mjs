const VARIANTS = Object.freeze([
  { key: 'old', label: 'LP antiga' },
  { key: 'a', label: 'Headline A' },
  { key: 'b', label: 'Headline B' },
])

function plainText(property) {
  return (property?.rich_text || []).map((item) => item?.plain_text || '').join('').trim()
}

function selectName(property) {
  return property?.select?.name || ''
}

function conversion(from, to) {
  if (!from || to > from) return null
  return (to / from) * 100
}

export function mergeLpVariantVisits(variants, visitMetrics) {
  const visitsByKey = new Map((visitMetrics?.rows || []).map((row) => [row.key, Math.max(0, Number(row.visits) || 0)]))
  return {
    ...variants,
    visitMetric: visitMetrics?.metric || null,
    visitTrackingAvailable: visitMetrics?.available === true,
    rows: (variants.rows || []).map((row) => {
      const trackedVisits = visitsByKey.get(row.key) || 0
      const leadFloor = Math.max(0, Number(row.leads) || 0)
      return {
        ...row,
        visits: Math.max(trackedVisits, leadFloor),
        visitSource: trackedVisits >= leadFloor && trackedVisits > 0 ? 'lp_view' : 'lead_floor',
      }
    }),
  }
}

export function aggregateLpVariants(pages) {
  const rows = Object.fromEntries(VARIANTS.map((variant) => [variant.label, {
    ...variant,
    leads: 0,
    purchaseIntents: 0,
    paidMetaLeads: 0,
  }]))
  let unidentified = 0
  let totalPurchaseIntents = 0

  for (const page of Array.isArray(pages) ? pages : []) {
    const properties = page?.properties || {}
    const variant = selectName(properties['Variante LP'])
    const stage = selectName(properties['Etapa do funil'])
    const origin = plainText(properties.Origem).toLowerCase()
    if (stage === 'Clicou em comprar') totalPurchaseIntents += 1
    if (!rows[variant]) {
      unidentified += 1
      continue
    }
    rows[variant].leads += 1
    if (stage === 'Clicou em comprar') rows[variant].purchaseIntents += 1
    if (origin === 'meta / paid_social') rows[variant].paidMetaLeads += 1
  }

  return {
    rows: VARIANTS.map(({ label }) => ({
      ...rows[label],
      leadToIntent: conversion(rows[label].leads, rows[label].purchaseIntents),
    })),
    totalLeads: (Array.isArray(pages) ? pages : []).length,
    totalPurchaseIntents,
    unidentified,
  }
}
