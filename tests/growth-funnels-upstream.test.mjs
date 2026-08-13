import assert from 'node:assert/strict'
import test from 'node:test'
import { isNetlifyGrowthFunnelsRequest, proxyGrowthFunnels } from '../lib/growth-funnels-upstream.mjs'

test('detects Netlify growth funnel requests without relying on runtime env', () => {
  assert.equal(isNetlifyGrowthFunnelsRequest(new Request('https://amplifyhub123.netlify.app/api/growth-funnels')), true)
  assert.equal(isNetlifyGrowthFunnelsRequest(new Request('https://main--amplifyhub123.netlify.app/api/growth-funnels')), true)
  assert.equal(isNetlifyGrowthFunnelsRequest(new Request('https://amplify-hub.72.60.147.19.sslip.io/api/growth-funnels')), false)
})

test('proxies the complete growth funnel query to the VPS API', async () => {
  let requestedUrl = null
  const request = new Request('https://amplifyhub123.netlify.app/api/growth-funnels?from=2026-08-01&to=2026-08-13&_=123')
  const response = await proxyGrowthFunnels(request, {
    upstream: 'https://amplify-hub.72.60.147.19.sslip.io/api/growth-funnels',
    fetchImpl: async (url, options) => {
      requestedUrl = String(url)
      assert.equal(options.cache, 'no-store')
      return Response.json({ newBrandFunnel: { live: true } })
    },
  })
  assert.equal(requestedUrl, 'https://amplify-hub.72.60.147.19.sslip.io/api/growth-funnels?from=2026-08-01&to=2026-08-13&_=123')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { newBrandFunnel: { live: true } })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('preserves upstream growth funnel failures', async () => {
  const response = await proxyGrowthFunnels(new Request('https://amplifyhub123.netlify.app/api/growth-funnels'), {
    fetchImpl: async () => Response.json({ error: 'upstream unavailable' }, { status: 503 }),
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'upstream unavailable' })
})
