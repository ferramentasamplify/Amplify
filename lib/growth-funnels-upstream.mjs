export const DEFAULT_GROWTH_FUNNELS_UPSTREAM = 'https://amplify-hub.72.60.147.19.sslip.io/api/growth-funnels'

export function isNetlifyGrowthFunnelsRequest(request) {
  return new URL(request.url).hostname.endsWith('.netlify.app')
}

export async function proxyGrowthFunnels(request, {
  fetchImpl = fetch,
  upstream = process.env.GROWTH_FUNNELS_UPSTREAM_URL || DEFAULT_GROWTH_FUNNELS_UPSTREAM,
} = {}) {
  const requestUrl = new URL(request.url)
  const targetUrl = new URL(upstream)
  targetUrl.search = requestUrl.search

  const upstreamResponse = await fetchImpl(targetUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })
  const headers = new Headers()
  headers.set('content-type', upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')

  return new Response(await upstreamResponse.arrayBuffer(), {
    status: upstreamResponse.status,
    headers,
  })
}
