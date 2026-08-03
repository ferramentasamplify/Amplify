import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyCreatorCost,
  buildCreatorCostInventory,
  buildMonthlyCreatorBusinessUnit,
  buildRetentionAnalytics,
  retentionSalaryAssumptionForMonth,
} from '../lib/creator-business-unit.mjs'

test('keeps the complete review inventory, including visible overlaps', () => {
  const inventory = buildCreatorCostInventory([
    { id: 'notion-meta', month: '2026-03', value: 100, tipo: 'Trafego Pago', name: 'Meta Notion', provedor: 'Meta', includedInResult: false },
    { id: 'meta-live', month: '2026-03', value: 110, tipo: 'Trafego Pago', name: 'Meta ao vivo', provedor: 'Meta Ads ao vivo', includedInResult: true },
    { id: 'openai', month: '2026-03', value: 20, tipo: 'API', name: 'OpenAI', provedor: 'OpenAI', includedInResult: true },
  ])
  assert.equal(inventory.totalCost, 230)
  assert.equal(inventory.lineItemCount, 3)
  assert.equal(inventory.categories.find((item) => item.key === 'paid-acquisition').lineItems.length, 2)
  assert.equal(inventory.categories.find((item) => item.key === 'ai-apis').amount, 20)
})

test('classifies creator costs robustly from Tipo, Name and Provedor', () => {
  assert.equal(classifyCreatorCost({ tipo: 'Folha', name: 'Salario time de aquisicao creators', provedor: 'Pessoa A' }), 'salaries-acquisition')
  assert.equal(classifyCreatorCost({ tipo: 'Pessoal', name: 'CS Retencao', provedor: 'Pessoa B' }), 'salaries-retention')
  assert.equal(classifyCreatorCost({ tipo: 'Trafego Pago', name: 'Meta Ads Creators', provedor: 'Meta' }), 'paid-acquisition')
  assert.equal(classifyCreatorCost({ tipo: 'Software', name: 'Chatwoot CRM', provedor: 'HubSpot' }), 'crm')
  assert.equal(classifyCreatorCost({ tipo: 'API', name: 'fatura 00042', provedor: 'OpenAI' }), 'ai-apis')
  assert.equal(classifyCreatorCost({ tipo: 'Viagem', name: 'Creator meetup', provedor: 'Hotel' }), 'other')
})

test('aggregates actual costs by month without filling missing months and keeps line items', () => {
  const rows = [
    { id: '1', month: '2026-07', value: 10, tipo: 'API', name: 'OpenAI 1', provedor: 'OpenAI' },
    { id: '2', month: '2026-07', value: 15, tipo: 'API', name: 'OpenAI 2', provedor: 'OpenAI' },
    { id: '3', month: '2026-08', value: 100, tipo: 'Trafego', name: 'Meta creators', provedor: 'Meta' },
  ]
  const result = buildMonthlyCreatorBusinessUnit({
    months: ['2026-07', '2026-08', '2026-09'],
    revenues: new Map([['2026-07', 500], ['2026-08', 700], ['2026-09', 900]]),
    costs: rows,
  })
  assert.equal(result[0].actualCost, 25)
  assert.equal(result[0].assumptionCost, 10000)
  assert.equal(result[0].consideredCost, 10025)
  assert.equal(result[0].categories.find((item) => item.key === 'ai-apis').lineItems.length, 2)
  assert.equal(result[1].actualCost, 100)
  assert.equal(result[2].actualCost, null)
  assert.equal(result[2].actualResult, null)
  assert.equal(result[2].consideredCost, 10000)
})

test('applies the informed retention salary premise without duplicating an observed retention salary', () => {
  assert.equal(retentionSalaryAssumptionForMonth('2026-01').value, 5000)
  assert.equal(retentionSalaryAssumptionForMonth('2026-05').value, 5000)
  assert.equal(retentionSalaryAssumptionForMonth('2026-06').value, 10000)
  assert.equal(retentionSalaryAssumptionForMonth('2026-12').value, 10000)
  const result = buildMonthlyCreatorBusinessUnit({
    months: ['2026-06'],
    revenues: new Map([['2026-06', 20000]]),
    costs: [{ id: 'ret-1', month: '2026-06', value: 7000, tipo: 'Salario', name: 'Time de retencao', provedor: 'Pessoa' }],
  })[0]
  assert.equal(result.actualCost, 7000)
  assert.equal(result.assumptionCost, 0)
  assert.equal(result.consideredCost, 7000)
})

test('derives exit duration, monthly prior GMV and later-return rate from daily transitions', () => {
  const daily = [
    { date: '2026-07-10', exits: 2, returns: 1, exitedCreatorIds: ['a', 'b'], exitedGmvPrior30d: 300, exitedCreatorsWithGmv30d: 2, gmvWindowComplete: true },
    { date: '2026-07-20', exits: 1, returns: 2, exitedCreatorIds: ['a'], exitedGmvPrior30d: 50, exitedCreatorsWithGmv30d: 1, gmvWindowComplete: true },
  ]
  const creators = [
    { id: 'a', runs: [{ from: '2026-07-01', to: '2026-07-09', days: 9 }, { from: '2026-07-15', to: '2026-07-19', days: 5 }, { from: '2026-07-25', to: '2026-07-31', days: 7 }] },
    { id: 'b', runs: [{ from: '2026-07-05', to: '2026-07-09', days: 5 }] },
  ]
  const creatorMonths = new Map([
    ['a', new Map([['2026-07', { gmv: 8000 }]])],
    ['b', new Map([['2026-07', { gmv: 0 }]])],
  ])
  const result = buildRetentionAnalytics(daily, creators, creatorMonths, ['2026-07'])
  assert.equal(result.summary.exitEventsWithDuration, 3)
  assert.equal(result.summary.meanDaysToExit, 6.33)
  assert.equal(result.summary.uniqueExitedCreators, 2)
  assert.equal(result.summary.uniqueExitedCreatorsWithLaterReturn, 1)
  assert.equal(result.summary.laterReturnPercent, 50)
  assert.equal(result.monthly[0].exitedGmvPrior30d, 350)
  assert.equal(result.monthly[0].observedExits, 3)
  assert.equal(result.monthly[0].observedReturns, 3)
  assert.equal(result.monthly[0].cohortReturnedCreators, 1)
  assert.equal(result.monthly[0].cohortReturnPercent, 50)
  assert.equal(result.monthly[0].cohortReturnPercentDisplay, null)
  assert.equal(result.monthly[0].exitedCreatorsWithGmv30d, 3)
  assert.equal(result.monthly[0].avgGmvPrior30dPerExit, 116.67)
  assert.equal(result.byTier.find((item) => item.key === 'silver').meanDaysToExit, 7)
})

test('excludes left-censored cycles that started on the first coverage day', () => {
  const result = buildRetentionAnalytics(
    [{ date: '2026-01-11', exitedCreatorIds: ['left'], exitedGmvPrior30d: 10, gmvWindowComplete: false }],
    [{ id: 'left', runs: [{ from: '2026-01-01', to: '2026-01-10', days: 10 }] }],
    new Map([['left', new Map([['2026-01', { gmv: 100 }]])]]),
    ['2026-01'],
    { coverageFrom: '2026-01-01' },
  )
  assert.equal(result.summary.exitEventsWithDuration, 0)
  assert.equal(result.monthly[0].exitedGmvPrior30d, 10)
  assert.equal(result.monthly[0].completeWindow, false)
})
