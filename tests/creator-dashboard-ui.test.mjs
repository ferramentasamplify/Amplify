import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const componentPath = new URL("../components/CreatorEconomicsView.js", import.meta.url)
const source = await readFile(componentPath, "utf8")
const apiSource = await readFile(new URL("../app/api/creator-economics/route.js", import.meta.url), "utf8")

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
  assert.match(source, /activationTableRows/)
  assert.match(source, /retentionTableRows/)
  assert.match(source, /financeTableRows/)
})

test("rolling 30-day GMV copy requires the creator to remain affiliated on the analyzed day", () => {
  assert.match(source, /vinculados no dia que tiveram algum GMV na data ou nos 29 dias anteriores/)
  assert.match(source, /continua vinculado na data analisada/)
})

test("mobile header does not let sticky navigation cover dashboard content", () => {
  assert.match(source, /@media\(max-width:560px\)\{\.econ-topbar\{background:#070910;backdrop-filter:none\}\.creator-dashboard-nav\{position:relative;top:auto;margin-left:0;margin-right:0/)
})

test("exit chart uses blue points for exits and a red line for prior 30-day GMV", () => {
  assert.match(source, /<Scatter yAxisId="people" dataKey="exits" name="Desvinculados · pontos" fill="#54D8E8"/)
  assert.match(source, /dataKey="exitedGmvPrior30d" name="GMV previo 30d · linha" stroke="#FF647C"/)
  assert.doesNotMatch(source, /Desvinculados · barras|<Bar dataKey="exits"|<Area[^>]+dataKey="exitedGmvPrior30d"/)
})

test("lost GMV chart compares daily exits with the remaining affiliated base", () => {
  assert.match(source, /<section className="lost-gmv-share-section/)
  assert.match(source, /<Scatter yAxisId="people" dataKey="exits" name="Desvinculados · pontos azuis" fill="#54D8E8"/)
  assert.match(source, /dataKey="lostGmvPercentOfRemainingBase" name="Percentual de GMV 30d perdido" stroke="#FF647C"/)
  assert.match(source, /GMV previo 30d dos creators que sairam no dia/)
  assert.match(source, /GMV previo 30d da base que permaneceu vinculada no dia/)
  assert.match(apiSource, /expectedLostPercent = remainingGmv > 0 \? round\(exitedGmv \/ remainingGmv \* 100\) : null/)
  assert.match(apiSource, /row\.lostGmvPercentOfRemainingBase !== expectedLostPercent/)
})
