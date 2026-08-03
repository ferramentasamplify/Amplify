import assert from "node:assert/strict"
import test from "node:test"

import {
  CREATOR_DASHBOARD_SECTIONS,
  normalizeCreatorDashboardSection,
  filterDashboardRows,
} from "../lib/creator-dashboard.mjs"

const EXPECTED_SECTIONS = [
  "overview",
  "base",
  "activation",
  "movement",
  "retention",
  "finance",
  "portfolio",
  "acquisition",
]

test("creator dashboard exposes the official sections in chart order", () => {
  assert.deepEqual(
    CREATOR_DASHBOARD_SECTIONS.map((section) => section.id),
    EXPECTED_SECTIONS,
  )
  for (const section of CREATOR_DASHBOARD_SECTIONS) {
    assert.ok(section.label)
    assert.ok(section.tableLabel)
  }
})

test("unknown creator dashboard sections fall back to overview", () => {
  assert.equal(normalizeCreatorDashboardSection("movement"), "movement")
  assert.equal(normalizeCreatorDashboardSection("not-a-section"), "overview")
  assert.equal(normalizeCreatorDashboardSection(null), "overview")
})

test("dashboard tables follow date month and category selections", () => {
  const rows = [
    { date: "2026-07-01", month: "2026-07", tier: "start" },
    { date: "2026-07-02", month: "2026-07", tier: "growth" },
    { date: "2026-08-01", month: "2026-08", tier: "growth" },
  ]

  assert.deepEqual(filterDashboardRows(rows, { date: "2026-07-02" }), [rows[1]])
  assert.deepEqual(filterDashboardRows(rows, { month: "2026-07" }), [rows[0], rows[1]])
  assert.deepEqual(filterDashboardRows(rows, { key: "tier", value: "growth" }), [rows[1], rows[2]])
  assert.deepEqual(filterDashboardRows(rows, {}), rows)
})

test("dashboard selection never removes rows when a field is unavailable", () => {
  const rows = [{ month: "2026-07" }, { month: "2026-08" }]
  assert.deepEqual(filterDashboardRows(rows, { date: "2026-07-01" }), rows)
})
