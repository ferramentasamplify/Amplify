import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const componentPath = new URL("../components/CreatorEconomicsView.js", import.meta.url)
const source = await readFile(componentPath, "utf8")

test("creator BU renders the official dashboard shell and section navigator", () => {
  assert.match(source, /<h1>Business Unit Creators<\/h1>/)
  assert.match(source, /creator-dashboard-nav/)
  assert.match(source, /CREATOR_DASHBOARD_SECTIONS\.map/)
  assert.match(source, /URLSearchParams/)
  assert.match(source, /history\.replaceState/)
})

test("creator BU exposes every official analytical section", () => {
  for (const section of [
    "overview",
    "base",
    "activation",
    "movement",
    "retention",
    "finance",
    "portfolio",
    "acquisition",
  ]) {
    assert.match(source, new RegExp(`data-dashboard-section=["'{]+${section}`))
  }
})

test("every section provides a responsive analytical table surface", () => {
  for (const section of [
    "overview",
    "base",
    "activation",
    "movement",
    "retention",
    "finance",
    "portfolio",
    "acquisition",
  ]) {
    assert.match(source, new RegExp(`data-dashboard-table=["'{]+${section}`))
  }
  assert.match(source, /dashboard-table-scroll/)
  assert.match(source, /Nenhum resultado para os filtros ativos/)
})

test("movement analysis offers three distinguishable interactive views", () => {
  assert.match(source, /Combinado/)
  assert.match(source, /Separado/)
  assert.match(source, /Ranking/)
  assert.match(source, /exitChartView === "combined"/)
  assert.match(source, /exitChartView === "split"/)
  assert.match(source, /exitChartView === "ranking"/)
})

test("portfolio creator action opens and reveals the acquisition explorer", () => {
  assert.match(source, /openCreatorExplorer/)
  assert.match(source, /selectDashboardSection\("acquisition"\)/)
  assert.match(source, /setQueryDraft\(alias/)
  assert.match(source, /creator-panel["']\)\?\.scrollIntoView/)
})

test("active acquisition filters stay visible and clearable globally", () => {
  assert.match(source, /global-filter-chip/)
  assert.match(source, /Origem ativa:/)
  assert.match(source, /setSource\("all"\)/)
})

test("finance section contains a real responsive analytical table", () => {
  assert.match(source, /data-dashboard-table="finance"[\s\S]{0,1200}<table/)
  assert.match(source, /financeTableRows/)
})

test("section and movement controls expose navigation and pressed state", () => {
  assert.match(source, /history\.pushState/)
  assert.match(source, /aria-pressed=\{exitChartView === "combined"\}/)
  assert.match(source, /aria-pressed=\{movementWindow === "30"\}/)
})

test("tested row filtering is connected to rendered dashboard tables", () => {
  assert.match(source, /filterDashboardRows/)
  assert.match(source, /overviewTableRows/)
  assert.match(source, /baseTableRows/)
})
