function conversion(from, to) {
  if (from == null || to == null || from === 0 || to > from) return from === 0 && to === 0 ? null : null
  return (to / from) * 100
}

export function filterNewBrandStagesByVariant(stages, variant) {
  if (!variant) return stages
  const label = variant.label || 'Variante selecionada'
  return stages.map((stage) => {
    if (stage.key === 'diagnostic-form') {
      return {
        ...stage,
        value: Number(variant.leads) || 0,
        conversion: null,
        sourceLabel: `Notion · Variante LP · ${label}`,
        eventName: 'lead_atribuido_a_variante',
        metricScope: 'variant',
      }
    }
    if (stage.key === 'purchase-intent') {
      const leads = Number(variant.leads) || 0
      const intents = Number(variant.purchaseIntents) || 0
      return {
        ...stage,
        value: intents,
        conversion: conversion(leads, intents),
        sourceLabel: `Notion · Variante LP · ${label}`,
        eventName: 'intencao_atribuida_a_variante',
        metricScope: 'variant',
      }
    }
    if (stage.key === 'creative-view' || stage.key === 'landing-view') {
      return {
        ...stage,
        sourceLabel: 'Tracking geral · todas as variantes',
        metricScope: 'shared',
      }
    }
    return { ...stage, value: null, conversion: null, metricScope: 'unavailable' }
  })
}
