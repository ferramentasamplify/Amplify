import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateLpVariants, mergeLpVariantVisits } from '../lib/lp-variant-metrics.mjs'

const page = ({ variant = '', stage = 'Preencheu LP', origin = 'Landing page' } = {}) => ({
  properties: {
    'Variante LP': { select: variant ? { name: variant } : null },
    'Etapa do funil': { select: { name: stage } },
    Origem: { rich_text: [{ plain_text: origin }] },
  },
})

test('aggregates leads and purchase intents without mixing acquisition origin', () => {
  const result = aggregateLpVariants([
    page({ variant: 'LP antiga', origin: 'meta / paid_social' }),
    page({ variant: 'LP antiga', stage: 'Clicou em comprar', origin: 'meta / paid_social' }),
    page({ variant: 'Headline A', stage: 'Clicou em comprar', origin: 'meta / paid_social' }),
    page({ variant: 'Headline B' }),
    page(),
  ])
  assert.deepEqual(result.rows, [
    { key: 'old', label: 'LP antiga', leads: 2, purchaseIntents: 1, paidMetaLeads: 2, leadToIntent: 50 },
    { key: 'a', label: 'Headline A', leads: 1, purchaseIntents: 1, paidMetaLeads: 1, leadToIntent: 100 },
    { key: 'b', label: 'Headline B', leads: 1, purchaseIntents: 0, paidMetaLeads: 0, leadToIntent: 0 },
  ])
  assert.equal(result.totalLeads, 5)
  assert.equal(result.totalPurchaseIntents, 2)
  assert.equal(result.unidentified, 1)
})

test('does not invent a variant when the field is blank or unknown', () => {
  const result = aggregateLpVariants([page(), page({ variant: 'Other' })])
  assert.equal(result.unidentified, 2)
  assert.equal(result.rows.reduce((sum, row) => sum + row.leads, 0), 0)
})

test('merges identified LP sessions and never reports fewer entries than proven leads', () => {
  const variants = aggregateLpVariants([
    page({ variant: 'LP antiga' }),
    page({ variant: 'LP antiga' }),
    page({ variant: 'Headline A' }),
  ])
  const merged = mergeLpVariantVisits(variants, {
    available: true,
    metric: 'unique_sessions',
    rows: [
      { key: 'old', visits: 0 },
      { key: 'a', visits: 0 },
      { key: 'b', visits: 3 },
    ],
  })
  assert.deepEqual(merged.rows.map(({ key, visits, visitSource }) => ({ key, visits, visitSource })), [
    { key: 'old', visits: 2, visitSource: 'lead_floor' },
    { key: 'a', visits: 1, visitSource: 'lead_floor' },
    { key: 'b', visits: 3, visitSource: 'lp_view' },
  ])
})
