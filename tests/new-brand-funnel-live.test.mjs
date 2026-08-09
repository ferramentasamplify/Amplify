import test from 'node:test'
import assert from 'node:assert/strict'
import {
  actionTotal,
  buildLpSignalMetrics,
  buildWebinarCampaignMetrics,
  extractPixelEventTotals,
} from '../lib/new-brand-funnel-live.mjs'

const campaign = 'LEADS | MARCAS | WEBINAR TIKTOK SHOP | AGO26'

test('agrega o funil atribuido da campanha sem somar campanhas alheias', () => {
  const rows = [
    {
      campaign_name: campaign,
      spend: '24.89',
      impressions: '597',
      actions: [
        { action_type: 'video_view', value: '181' },
        { action_type: 'link_click', value: '8' },
        { action_type: 'landing_page_view', value: '7' },
        { action_type: 'lead', value: '1' },
        { action_type: 'offsite_conversion.custom.lead-webinar', value: '1' },
      ],
    },
    {
      campaign_name: 'OUTRA CAMPANHA',
      spend: '100',
      impressions: '1000',
      actions: [{ action_type: 'lead', value: '50' }],
    },
  ]
  const result = buildWebinarCampaignMetrics(rows, {
    campaignName: campaign,
    leadCustomConversionId: 'lead-webinar',
    reference: '2026-08-09',
  })

  assert.equal(actionTotal(rows.slice(0, 1), 'link_click'), 8)
  assert.deepEqual(result.values, {
    impressions: 597,
    videoViews: 181,
    linkClicks: 8,
    landingPageViews: 7,
    leads: 1,
  })
  assert.equal(result.spend, 24.89)
  assert.equal(result.cpl, 24.89)
  assert.ok(Math.abs(result.stages.at(-1).conversion - (100 / 7)) < 1e-10)
})

test('extrai eventos exclusivos do webinar do Dataset', () => {
  const totals = extractPixelEventTotals({
    data: [{
      data: [
        { value: 'WebinarPageView', count: 34 },
        { value: 'WebinarFormStart', count: 12 },
        { value: 'WebinarLead', count: 1 },
        { value: 'WebinarPurchaseIntent', count: 1 },
        { value: 'Lead', count: 60 },
      ],
    }],
  })
  const result = buildLpSignalMetrics(totals, { fallbackLeadCount: 99 })

  assert.equal(result.usesFallbackLead, false)
  assert.deepEqual(result.values, {
    pageViews: 34,
    formStarts: 12,
    leads: 1,
    purchaseIntents: 1,
  })
  assert.equal(result.stages[2].source, 'Pixel · WebinarLead')
})

test('usa temporariamente a conversao especifica para o lead anterior ao WebinarLead', () => {
  const result = buildLpSignalMetrics({
    WebinarPageView: 34,
    WebinarFormStart: 12,
    WebinarPurchaseIntent: 2,
  }, {
    fallbackLeadCount: 1,
    webinarLeadTrackingSince: '2026-08-09T22:00:00Z',
  })

  assert.equal(result.usesFallbackLead, true)
  assert.equal(result.values.leads, 1)
  assert.ok(Math.abs(result.stages[2].conversion - (100 / 12)) < 1e-10)
  assert.equal(result.stages[3].conversion, null)
  assert.equal(result.stages[3].nonMonotonic, true)
})
