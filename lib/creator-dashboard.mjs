export const CREATOR_DASHBOARD_SECTIONS = Object.freeze([
  { id: "overview", label: "Resumo", tableLabel: "Resumo mensal" },
  { id: "base", label: "Base e Meta", tableLabel: "Historico diario da base" },
  { id: "activation", label: "Ativacao", tableLabel: "Safras de ativacao" },
  { id: "movement", label: "Movimentacao", tableLabel: "Creators movimentados" },
  { id: "retention", label: "Retencao", tableLabel: "Retencao mensal" },
  { id: "finance", label: "Financeiro", tableLabel: "Inventario financeiro" },
  { id: "portfolio", label: "GMV e Carteira", tableLabel: "Ranking da carteira" },
  { id: "acquisition", label: "Aquisicao e Creators", tableLabel: "Creators e origens" },
])

const SECTION_IDS = new Set(CREATOR_DASHBOARD_SECTIONS.map((section) => section.id))

export function normalizeCreatorDashboardSection(value) {
  return SECTION_IDS.has(value) ? value : "overview"
}

export function filterDashboardRows(rows, selection = {}) {
  if (!Array.isArray(rows)) return []

  const predicates = []
  if (selection.date && rows.some((row) => Object.hasOwn(row || {}, "date"))) {
    predicates.push((row) => row?.date === selection.date)
  }
  if (selection.month && rows.some((row) => Object.hasOwn(row || {}, "month"))) {
    predicates.push((row) => row?.month === selection.month)
  }
  if (selection.key && selection.value != null && rows.some((row) => Object.hasOwn(row || {}, selection.key))) {
    predicates.push((row) => row?.[selection.key] === selection.value)
  }

  return predicates.length ? rows.filter((row) => predicates.every((predicate) => predicate(row))) : rows
}
