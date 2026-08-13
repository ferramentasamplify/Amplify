import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../components/GrowthFunnelsView.js', import.meta.url), 'utf8')

test('variant cards are single-select buttons with an explicit consolidated option', () => {
  assert.match(source, /Todas as variantes/)
  assert.match(source, /aria-pressed=\{selectedVariantKey === row\.key\}/)
  assert.match(source, /setSelectedVariantKey\(selectedVariantKey === row\.key \? null : row\.key\)/)
  assert.match(source, /className=\{`lp-variant-card.*?selected/s)
})

test('selected variant filters the lower funnel and clearly labels its scope', () => {
  assert.match(source, /filterNewBrandStagesByVariant/)
  assert.match(source, /Funil filtrado por/)
  assert.match(source, /Somente etapas identificadas por variante/)
  assert.match(source, /data-variant-filter=\{selectedVariant\?\.key \|\| "all"\}/)
})
