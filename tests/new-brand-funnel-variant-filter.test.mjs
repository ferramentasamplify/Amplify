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

test('shows only variant-attributable funnel stages after selecting a variant', () => {
  const filtered = filterNewBrandStagesByVariant(stages, old)
  assert.deepEqual(filtered.map(({ key, value, conversion }) => ({ key, value, conversion })), [
    { key: 'creative-view', value: null, conversion: null },
    { key: 'landing-view', value: null, conversion: null },
    { key: 'diagnostic-form', value: 51, conversion: null },
    { key: 'purchase-intent', value: 22, conversion: 43.13725490196079 },
    { key: 'lesson-purchase', value: null, conversion: null },
  ])
  assert.equal(filtered[2].sourceLabel, 'Notion · Variante LP · LP antiga')
  assert.equal(filtered[3].sourceLabel, 'Notion · Variante LP · LP antiga')
})

test('renders a real zero while preserving unavailable stages for an empty variant', () => {
  const filtered = filterNewBrandStagesByVariant(stages, { key: 'b', label: 'Headline B', leads: 0, purchaseIntents: 0 })
  assert.equal(filtered.find((stage) => stage.key === 'diagnostic-form').value, 0)
  assert.equal(filtered.find((stage) => stage.key === 'purchase-intent').value, 0)
  assert.equal(filtered.find((stage) => stage.key === 'landing-view').value, null)
})
