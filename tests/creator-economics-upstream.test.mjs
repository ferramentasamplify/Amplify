import assert from 'node:assert/strict'
import test from 'node:test'
import { proxyCreatorEconomics } from '../lib/creator-economics-upstream.mjs'

test('proxies the complete query to the VPS creator economics API', async () => {
  let requestedUrl = null
  const request = new Request('https://amplifyhub123.netlify.app/api/creator-economics?from=2026-01&to=2026-08&source=paid-meta&q=creator&page=2&limit=25&sort=gmv')
  const fetchImpl = async (url, options) => {
    requestedUrl = String(url)
    assert.equal(options.cache, 'no-store')
    return Response.json({ summary: { creators: 123 } }, {
      headers: { 'x-upstream-marker': 'vps' },
    })
  }

  const response = await proxyCreatorEconomics(request, {
    fetchImpl,
    upstream: 'https://amplify-hub.72.60.147.19.sslip.io/api/creator-economics',
  })

  assert.equal(requestedUrl, 'https://amplify-hub.72.60.147.19.sslip.io/api/creator-economics?from=2026-01&to=2026-08&source=paid-meta&q=creator&page=2&limit=25&sort=gmv')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { summary: { creators: 123 } })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('preserves an upstream error status and body', async () => {
  const request = new Request('https://amplifyhub123.netlify.app/api/creator-economics?from=2026-01&to=2026-08')
  const response = await proxyCreatorEconomics(request, {
    fetchImpl: async () => Response.json({ error: 'upstream unavailable' }, { status: 503 }),
    upstream: 'https://amplify-hub.72.60.147.19.sslip.io/api/creator-economics',
  })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'upstream unavailable' })
})
