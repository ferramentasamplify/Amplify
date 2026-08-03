const CATEGORY_DEFINITIONS = [
  { key: 'salaries-acquisition', label: 'Salarios de aquisicao' },
  { key: 'salaries-retention', label: 'Salarios de retencao' },
  { key: 'paid-acquisition', label: 'Aquisicao paga / trafego' },
  { key: 'crm', label: 'CRM' },
  { key: 'ai-apis', label: 'IA / APIs' },
  { key: 'other', label: 'Outros' },
]

const TIER_DEFINITIONS = [
  { key: 'no-gmv', label: 'Sem GMV', test: (gmv) => gmv <= 0 },
  { key: 'start', label: 'Start', test: (gmv) => gmv > 0 && gmv <= 5000 },
  { key: 'silver', label: 'Silver', test: (gmv) => gmv > 5000 && gmv <= 30000 },
  { key: 'gold', label: 'Gold', test: (gmv) => gmv > 30000 && gmv <= 100000 },
  { key: 'diamond', label: 'Diamond', test: (gmv) => gmv > 100000 && gmv <= 500000 },
  { key: 'safira', label: 'Safira', test: (gmv) => gmv > 500000 && gmv <= 1000000 },
  { key: 'above-safira', label: 'Acima de Safira', test: (gmv) => gmv > 1000000 },
]

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function round(value) { return Math.round((Number(value) || 0) * 100) / 100 }
function nextDay(value) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
function laterThan(a, b) { return Boolean(a && b && a > b) }

export function classifyCreatorCost({ tipo, name, provedor } = {}) {
  const text = normalize([tipo, name, provedor].filter(Boolean).join(' '))
  const salary = /(salari|folha|pessoal|remuner|pro.?labore)/.test(text)
  if (salary && /(retenc|retention|customer success|\bcs\b|gabriel)/.test(text)) return 'salaries-retention'
  if (salary && /(aquisic|acquisition|hunter|sdr|captac|andrei|bruno|nicole|vitor)/.test(text)) return 'salaries-acquisition'
  if (/(trafego|traffic|paid acquisition|meta ads|facebook ads|google ads|tiktok ads|midia paga)/.test(text)) return 'paid-acquisition'
  if (/(crm|hubspot|pipedrive|chatwoot|bitrix|kommo|salesforce)/.test(text)) return 'crm'
  if (/(openai|anthropic|claude|gemini|api\b|inteligencia artificial|\bia\b|automacao|n8n|make\.com)/.test(text)) return 'ai-apis'
  return 'other'
}

export function isCreatorRelevantCost(row = {}) {
  const text = normalize([row.tipo, row.name, row.provedor].filter(Boolean).join(' '))
  if (/(projeto|project|vendas|sales|marcas?)/.test(text) && !/(creator|criador|aquisic|retenc)/.test(text)) return false
  if (/(creator|criador|aquisic|retenc|indique|indicacao|afiliad)/.test(text)) return true
  return ['salaries-acquisition', 'salaries-retention', 'paid-acquisition', 'crm', 'ai-apis'].includes(classifyCreatorCost(row))
}

export function extractNotionText(property) {
  if (!property) return ''
  if (typeof property === 'string' || typeof property === 'number') return property
  if (property.type && property[property.type] != null) return extractNotionText(property[property.type])
  if (Array.isArray(property)) return property.map((part) => part?.plain_text ?? part?.name ?? part?.title ?? '').join('')
  if (property.start) return property.start
  if (property.name != null) return property.name
  return ''
}

export function normalizeGastosRows(pages = []) {
  return pages.map((page) => {
    const properties = page.properties || {}
    const name = extractNotionText(properties.Name || properties.Nome || properties.Titulo || properties['Titulo']) || 'Sem nome'
    const tipo = extractNotionText(properties.Tipo)
    const provedor = extractNotionText(properties.Provedor)
    const competence = extractNotionText(properties['Competência'] || properties.Competencia)
    const value = Number(extractNotionText(properties['Valor (R$)'] || properties.Valor)) || 0
    return { id: page.id, month: String(competence).slice(0, 7), value: round(value), name: String(name), tipo: String(tipo), provedor: String(provedor), url: page.url || null }
  }).filter((row) => /^\d{4}-\d{2}$/.test(row.month) && row.value > 0 && isCreatorRelevantCost(row))
}

export function buildMonthlyCreatorBusinessUnit({ months = [], revenues = new Map(), costs = [] }) {
  return months.map((month) => {
    const monthCosts = costs.filter((row) => row.month === month)
    const hasObservedRetentionSalary = monthCosts.some((row) => classifyCreatorCost(row) === 'salaries-retention')
    const retentionAssumption = hasObservedRetentionSalary ? null : retentionSalaryAssumptionForMonth(month)
    const consideredCosts = retentionAssumption ? [...monthCosts, retentionAssumption] : monthCosts
    const categories = CATEGORY_DEFINITIONS.map((definition) => {
      const lineItems = consideredCosts.filter((row) => (row.category || classifyCreatorCost(row)) === definition.key)
      return { ...definition, amount: round(lineItems.reduce((sum, row) => sum + row.value, 0)), lineItems }
    })
    const actualCost = monthCosts.length ? round(monthCosts.reduce((sum, row) => sum + row.value, 0)) : null
    const assumptionCost = retentionAssumption?.value || 0
    const consideredCost = round((actualCost || 0) + assumptionCost)
    const revenue = round(revenues.get(month) || 0)
    return {
      month,
      revenue,
      actualCost,
      actualResult: actualCost == null ? null : round(revenue - actualCost),
      assumptionCost,
      consideredCost,
      consideredResult: round(revenue - consideredCost),
      categories,
      lineItemCount: monthCosts.length,
      assumptionLineItemCount: retentionAssumption ? 1 : 0,
    }
  })
}

export function retentionSalaryAssumptionForMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month) || month < '2026-01') return null
  const people = month <= '2026-05' ? 1 : 2
  return {
    id: `retention-salary-assumption-${month}`,
    month,
    value: people * 5000,
    name: `Premissa retencao: ${people} pessoa${people > 1 ? 's' : ''} x R$ 5.000`,
    tipo: 'Premissa informada',
    provedor: 'Andrei',
    category: 'salaries-retention',
    sourceKind: 'assumption',
  }
}

function tierForGmv(gmv) {
  return TIER_DEFINITIONS.find((tier) => tier.test(Number(gmv) || 0)) || TIER_DEFINITIONS[0]
}

export function buildRetentionAnalytics(daily = [], creators = [], creatorMonths = new Map(), months = [], { coverageFrom = null } = {}) {
  const events = []
  const selectedFrom = daily.at(0)?.date || `${months.at(0)}-01`
  const selectedTo = daily.at(-1)?.date || `${months.at(-1)}-31`
  const coverageTo = daily.at(-1)?.coverageTo || selectedTo
  for (const creator of creators) {
    const creatorId = String(creator.id)
    for (const run of Array.isArray(creator.runs) ? creator.runs : []) {
      if (!Number.isFinite(Number(run.days)) || run.to >= coverageTo) continue
      if (coverageFrom && run.from <= coverageFrom) continue
      const exitDate = nextDay(run.to)
      if (exitDate < selectedFrom || exitDate > selectedTo) continue
      const monthData = creatorMonths.get(creatorId)?.get(run.to.slice(0, 7))
      const tier = tierForGmv(monthData?.gmv || 0)
      const returnedLater = Boolean(creator.runs.some((item) => laterThan(item.from, exitDate)))
      events.push({ creatorId, date: exitDate, days: Number(run.days), tier: tier.key, returnedLater })
    }
  }
  const uniqueExited = new Map()
  for (const event of events) {
    const current = uniqueExited.get(event.creatorId) || false
    uniqueExited.set(event.creatorId, current || event.returnedLater)
  }
  const returningUnique = [...uniqueExited.values()].filter(Boolean).length
  const mean = (values) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  const median = (values) => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2)
  }
  const byTier = TIER_DEFINITIONS.map((tier) => {
    const selected = events.filter((event) => event.tier === tier.key)
    return { key: tier.key, label: tier.label, exitEvents: selected.length, meanDaysToExit: mean(selected.map((event) => event.days)), medianDaysToExit: median(selected.map((event) => event.days)) }
  }).filter((item) => item.exitEvents > 0)
  const monthly = months.map((month) => {
    const rows = daily.filter((row) => row.date?.startsWith(month))
    const completeRows = rows.filter((row) => row.gmvWindowComplete)
    return {
      month,
      exitedGmvPrior30d: round(rows.reduce((sum, row) => sum + (Number(row.exitedGmvPrior30d) || 0), 0)),
      observedTransitionDays: rows.length,
      completeTransitionDays: completeRows.length,
      completeWindow: rows.length > 0 && completeRows.length === rows.length,
    }
  })
  return {
    summary: {
      exitEventsWithDuration: events.length,
      meanDaysToExit: mean(events.map((event) => event.days)),
      medianDaysToExit: median(events.map((event) => event.days)),
      uniqueExitedCreators: uniqueExited.size,
      uniqueExitedCreatorsWithLaterReturn: returningUnique,
      laterReturnPercent: uniqueExited.size ? round(returningUnique / uniqueExited.size * 100) : null,
    },
    byTier,
    monthly,
    methodology: 'Tempo ate a saida = dias do ciclo observado que termina no dia anterior ao evento. Categoria = tier pelo GMV do mes em que o ciclo terminou. Retorno posterior = mesmo author_id reaparece em um ciclo futuro.',
    caveat: 'Creators ainda presentes no ultimo dia e ciclos iniciados no primeiro dia do historico estao censurados e nao entram na media. Saida observada nao e status formal de desvinculacao.',
  }
}

export const creatorCostCategories = CATEGORY_DEFINITIONS
