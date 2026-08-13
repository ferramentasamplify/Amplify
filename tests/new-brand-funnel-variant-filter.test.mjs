import test from 'node:test'
import assert from 'node:assert/strict'
import { filterNewBrandStagesByVariant } from '../lib/new-brand-funnel-variant-filter.mjs'

const stages = [
  { key: 'creative-view', value: 4591, conversion: null },
  { key: 'landing-view', value: 248, conversion: 5.4 },
  { key: 'diagnostic-form', value: 54, conversion: 21.8 },
  { key: 'purchase-intent', value: 22, conversion: 40.7 },
  { key: 'lesson-purchase', value: null, conversion: null },
]

const old = { key: 'old', label: 'LP antiga', leads: 51, purchaseIntents: 22 }

test('keeps the consolidated funnel unchanged when no variant is selected', () => {
  assert.equal(filterNewBrandStagesByVariant(stages, null), stages)
})

test('keeps real shared tracking visible and filters only attributable stages', () => {
  const filtered = filterNewBrandStagesByVariant(stages, old)
  assert.deepEqual(filtered.map(({ key, value, conversion, metricScope }) => ({ key, value, conversion, metricScope })), [
    { key: 'creative-view', value: 4591, conversion: null, metricScope: 'shared' },
    { key: 'landing-view', value: 248, conversion: 5.4, metricScope: 'shared' },
    { key: 'diagnostic-form', value: 51, conversion: null, metricScope: 'variant' },
    { key: 'purchase-intent', value: 22, conversion: 43.13725490196079, metricScope: 'variant' },
    { key: 'lesson-purchase', value: null, conversion: null, metricScope: 'unavailable' },
  ])
  assert.equal(filtered[0].sourceLabel, 'Tracking geral · todas as variantes')
  assert.equal(filtered[1].sourceLabel, 'Tracking geral · todas as variantes')
  assert.equal(filtered[2].sourceLabel, 'Notion · Variante LP · LP antiga')
  assert.equal(filtered[3].sourceLabel, 'Notion · Variante LP · LP antiga')
})

test('renders a real zero while preserving unavailable stages for an empty variant', () => {
  const filtered = filterNewBrandStagesByVariant(stages, { key: 'b', label: 'Headline B', leads: 0, purchaseIntents: 0 })
  assert.equal(filtered.find((stage) => stage.key === 'diagnostic-form').value, 0)
  assert.equal(filtered.find((stage) => stage.key === 'purchase-intent').value, 0)
  assert.equal(filtered.find((stage) => stage.key === 'landing-view').value, 248)
  assert.equal(filtered.find((stage) => stage.key === 'landing-view').metricScope, 'shared')
})
