export const NEW_BRAND_FUNNEL_STAGES = Object.freeze([
  { key: 'creative-view', label: 'Criativo de baixa consciência', signal: 'Visualização do criativo dedicado' },
  { key: 'landing-view', label: 'Visita na landing page da aula', signal: 'Sessão única na LP dedicada' },
  { key: 'diagnostic-form', label: 'Formulário de diagnóstico', signal: 'Formulário enviado antes do preço' },
  { key: 'sdr-form', label: 'SDR recebe o formulário', signal: 'Lead criado com a origem do novo funil' },
  { key: 'lesson-purchase', label: 'Compra da aula', signal: 'Pagamento aprovado da aula de entrada' },
  { key: 'sdr-purchase', label: 'SDR recebe o sinal de compra', signal: 'Comprador identificado no CRM' },
  { key: 'lesson-consumption', label: 'Consumo da aula', signal: 'Aula iniciada ou concluída' },
  { key: 'mentoring-invite', label: 'Convite para a mentoria', signal: 'Aplicação ou intenção enviada' },
  { key: 'sdr-intent', label: 'SDR recebe conclusão ou intenção', signal: 'Lead quente priorizado no CRM' },
  { key: 'mentoring-sale', label: 'Venda da mentoria', signal: 'Pagamento de R$ 15 mil aprovado' },
])

function count(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function conversion(from, to) {
  if (from == null || to == null || from <= 0) return null
  return (to / from) * 100
}

export function buildNewBrandFunnel(values = {}, { reference = null } = {}) {
  const stages = NEW_BRAND_FUNNEL_STAGES.map((stage) => ({
    ...stage,
    value: count(values[stage.key]),
  })).map((stage, index, all) => ({
    ...stage,
    conversion: index === 0 ? null : conversion(all[index - 1].value, stage.value),
  }))

  const connectedStages = stages.filter((stage) => stage.value != null).length
  return {
    key: 'new-brand-lesson-to-mentoring',
    label: 'Novo funil de Marcas',
    title: 'Aula de entrada ate Mentoria TikTok Shop',
    offer: { lesson: 97, mentoring: 15000 },
    reference,
    source: 'Tracking dedicado do novo funil',
    state: connectedStages === stages.length ? 'connected' : connectedStages > 0 ? 'partial' : 'blueprint',
    connectedStages,
    stages,
    totals: {
      entries: stages[0]?.value ?? null,
      lessonPurchases: stages.find((stage) => stage.key === 'lesson-purchase')?.value ?? null,
      mentoringSales: stages.at(-1)?.value ?? null,
      totalConversion: conversion(stages[0]?.value, stages.at(-1)?.value),
    },
  }
}
