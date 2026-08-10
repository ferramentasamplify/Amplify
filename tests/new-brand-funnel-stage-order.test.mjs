import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildNewBrandFunnel, NEW_BRAND_FUNNEL_STAGES } from '../lib/new-brand-funnel.mjs'

test('intencao de compra fica imediatamente depois do formulario e antes do SDR', () => {
  const keys = NEW_BRAND_FUNNEL_STAGES.map((stage) => stage.key)
  const formIndex = keys.indexOf('diagnostic-form')
  const intentIndex = keys.indexOf('purchase-intent')
  const sdrIndex = keys.indexOf('sdr-form')

  assert.equal(intentIndex, formIndex + 1)
  assert.equal(sdrIndex, intentIndex + 1)
  assert.equal(NEW_BRAND_FUNNEL_STAGES[intentIndex].eventName, 'Clicou em comprar')
})

test('intencao de compra recebe valor e calcula conversao a partir do formulario', () => {
  const funnel = buildNewBrandFunnel({
    'diagnostic-form': 14,
    'purchase-intent': 12,
  })
  const intent = funnel.stages.find((stage) => stage.key === 'purchase-intent')

  assert.equal(intent.value, 12)
  assert.ok(Math.abs(intent.conversion - ((12 / 14) * 100)) < 1e-10)
  assert.equal(funnel.stages.length, 11)
})

test('fonte da intencao e o status Clicou em comprar no Notion, nao o contador bruto do Pixel', async () => {
  const route = await readFile(new URL('../app/api/growth-funnels/route.js', import.meta.url), 'utf8')

  assert.match(route, /property: 'Etapa do funil', select: \{ equals: 'Clicou em comprar' \}/)
  assert.match(route, /connectedValues\['purchase-intent'\] = notionPurchaseIntent\.value/)
  assert.doesNotMatch(route, /connectedValues\['purchase-intent'\] = lpSignals\.values\.purchaseIntents/)
})
