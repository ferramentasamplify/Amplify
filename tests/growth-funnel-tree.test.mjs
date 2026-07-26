import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMetaHierarchy, buildAudienceTree } from '../lib/growth-funnel-tree.mjs'

const ads = [
  { id: 'a1', name: 'Criativo A', campaign: 'Campanha Creator', adset: 'Conjunto 1', segment: 'creator', recent: { spend: 120, results: 12 } },
  { id: 'a2', name: 'Criativo B', campaign: 'Campanha Creator', adset: 'Conjunto 1', segment: 'creator', recent: { spend: 30, results: 0 } },
  { id: 'b1', name: 'Criativo Marca', campaign: 'Campanha Marca', adset: 'Conjunto M', segment: 'marca', recent: { spend: 75, results: 5 } },
]

test('Meta cria apenas niveis reais campanha > conjunto > anuncio e separa audiencias', () => {
  const creators = buildMetaHierarchy(ads, 'creators', { reference: 'Hoje' })
  const brands = buildMetaHierarchy(ads, 'brands', { reference: 'Hoje' })
  assert.equal(creators.length, 1)
  assert.equal(creators[0].children[0].children.length, 2)
  assert.equal(creators[0].metrics.investment, 150)
  assert.equal(creators[0].metrics.leads, 12)
  assert.equal(creators[0].metrics.mql, null)
  assert.equal(brands[0].label, 'Campanha Marca')
  assert.equal(brands[0].metrics.investment, 75)
})

test('arvore de audiencia nao inventa vendedor nem niveis sem fonte', () => {
  const audience = {
    key: 'creators', label: 'Creators', totals: { leads: 20, converted: 3 },
    stages: [{ key: 'leads', value: 20 }, { key: 'qualified', value: 8 }, { key: 'converted', value: 3 }],
    channels: [
      { key: 'paid-meta', label: 'Meta Ads', leads: 12, stages: [{ key: 'leads', value: 12 }, { key: 'qualified', value: 5 }, { key: 'converted', value: 2 }] },
      { key: 'other', label: 'Outros', leads: 8, stages: [{ key: 'leads', value: 8 }, { key: 'qualified', value: null }, { key: 'converted', value: null }] },
    ],
  }
  const tree = buildAudienceTree(audience, { paidChildren: buildMetaHierarchy(ads, 'creators') })
  assert.equal(tree.type, 'audience')
  assert.deepEqual(tree.children.map((node) => node.type), ['channel', 'channel'])
  assert.equal(tree.children[0].children[0].type, 'campaign')
  assert.equal(tree.children[1].children.length, 0)
  assert.equal(tree.children[1].metrics.mql, null)
  assert.equal(tree.metrics.converted, 3)
  assert.equal(tree.metrics.conversion, 15)
  assert.equal(tree.children[0].metrics.conversion, 2 / 12 * 100)
})

test('inclui vendedor somente quando a agregacao traz vendedor real', () => {
  const audience = {
    key: 'brands', label: 'Marcas', totals: { leads: 4, converted: 1 }, stages: [],
    channels: [{
      key: 'site', label: 'Site', leads: 4, stages: [],
      sellers: [{ key: 'ana', label: 'Ana', leads: 4, stages: [{ key: 'leads', value: 4 }, { key: 'closed', value: 1 }] }],
    }],
  }
  const tree = buildAudienceTree(audience)
  assert.equal(tree.children[0].children[0].type, 'seller')
  assert.equal(tree.children[0].children[0].metrics.converted, 1)
  assert.equal(tree.children[0].children[0].metrics.conversion, 25)
})
