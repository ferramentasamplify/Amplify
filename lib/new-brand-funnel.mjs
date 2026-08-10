export const NEW_BRAND_FUNNEL_STAGES = Object.freeze([
  { key: 'creative-view', eventName: 'creative_view_aula', label: 'Criativo de baixa consciência', signal: 'Visualização do criativo dedicado', sourceLabel: 'Meta Ads → n8n' },
  { key: 'landing-view', eventName: 'page_view_aula', label: 'Visita na landing page da aula', signal: 'Sessão única na LP dedicada', sourceLabel: 'LP → n8n' },
  { key: 'diagnostic-form', eventName: 'form_submit_aula', label: 'Formulário de diagnóstico', signal: 'Formulário enviado antes do preço', sourceLabel: 'Formulário → n8n' },
  { key: 'purchase-intent', eventName: 'WebinarPurchaseIntent', label: 'Intenção de compra', signal: 'Clique no CTA de compra depois do cadastro', sourceLabel: 'Pixel da LP' },
  { key: 'sdr-form', eventName: 'bitrix_lead_created_aula', label: 'SDR recebe o formulário', signal: 'Lead criado com a origem do novo funil', sourceLabel: 'n8n → Bitrix' },
  { key: 'lesson-purchase', eventName: 'purchase_aula', label: 'Compra da aula', signal: 'Pagamento aprovado da aula de entrada', sourceLabel: 'Checkout → n8n' },
  { key: 'sdr-purchase', eventName: 'bitrix_purchase_signal_aula', label: 'SDR recebe o sinal de compra', signal: 'Comprador identificado no CRM', sourceLabel: 'n8n → Bitrix' },
  { key: 'lesson-consumption', eventName: 'lesson_complete', label: 'Consumo da aula', signal: 'Aula concluída', sourceLabel: 'Plataforma da aula → n8n' },
  { key: 'mentoring-invite', eventName: 'mentoria_cta_click', label: 'Convite para a mentoria', signal: 'Aplicação ou intenção enviada', sourceLabel: 'Aula/LP → n8n' },
  { key: 'sdr-intent', eventName: 'bitrix_mentoria_signal', label: 'SDR recebe conclusão ou intenção', signal: 'Lead quente priorizado no CRM', sourceLabel: 'n8n → Bitrix' },
  { key: 'mentoring-sale', eventName: 'mentoria_sale', label: 'Venda da mentoria', signal: 'Pagamento de R$ 15 mil aprovado', sourceLabel: 'Bitrix/checkout → n8n' },
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
