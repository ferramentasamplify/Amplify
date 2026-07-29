import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../components/GrowthFunnelsView.js', import.meta.url), 'utf8')

test('novo funil usa faixas afuniladas em vez de uma grade de cards', () => {
  assert.match(source, /className="new-brand-funnel-body"/)
  assert.match(source, /className=\{`new-funnel-stage/)
  assert.match(source, /--stage-width/)
  assert.match(source, /new-funnel-transition/)
  assert.doesNotMatch(source, /className="new-brand-grid"/)
})

test('cada faixa mostra evento, origem e conversao entre etapas', () => {
  assert.match(source, /stage\.eventName/)
  assert.match(source, /stage\.sourceLabel/)
  assert.match(source, /Conversão da etapa anterior/)
})

test('o funil tem regra mobile propria sem remover a leitura das etapas', () => {
  assert.match(source, /@media\(max-width:620px\).*?\.new-funnel-stage/s)
  assert.match(source, /--mobile-stage-width/)
})
