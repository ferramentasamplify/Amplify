import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveCreatorBaseHealth } from '../lib/creator-base-health.mjs'

test('derives rolling 30-day productivity, coverage and concentration with matching denominators', () => {
  const [row] = deriveCreatorBaseHealth([{
    date: '2026-07-31',
    affiliatedCreators: 2349,
    gmvCreatorsLast30Days: 1414,
    gmvTotal30Days: 11552427.59,
    gmv80CreatorCount30Days: 54,
    gmv80CreatorShareActivePercent30Days: 2.3,
  }])

  assert.equal(row.gmvPerMonetizedCreator30Days, 8170.03)
  assert.equal(row.monetizedCoverage30DaysPercent, 60.2)
  assert.equal(row.gmv80CreatorShareActivePercent30Days, 2.3)
  assert.equal(row.gmv80CreatorShareMonetizedPercent30Days, 3.82)
})

test('returns null instead of fabricated zero when a denominator is unavailable', () => {
  const [row] = deriveCreatorBaseHealth([{
    date: '2026-01-01',
    affiliatedCreators: 0,
    gmvCreatorsLast30Days: 0,
    gmvTotal30Days: 0,
    gmv80CreatorCount30Days: 0,
    gmv80CreatorShareActivePercent30Days: null,
  }])

  assert.equal(row.gmvPerMonetizedCreator30Days, null)
  assert.equal(row.monetizedCoverage30DaysPercent, null)
  assert.equal(row.gmv80CreatorShareMonetizedPercent30Days, null)
})
