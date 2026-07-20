import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)
const CREATIVE_DATA = '/root/.openclaw/workspaces/analista-trafego/creative-dashboard/data/ads.json'
const LIVE_SYNC = '/root/.openclaw/workspaces/analista-trafego/creative-dashboard/scripts/sync_live_dashboard.py'

export async function GET() {
  let syncError = null
  try {
    await execFileAsync('python3', [LIVE_SYNC], {
      timeout: 45000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, META_DASH_MAX_AGE_SECONDS: '0' },
    })
  } catch (error) {
    syncError = error?.stderr || error?.message || 'Falha ao sincronizar com o Meta'
    console.error('[/api/meta-creative live-sync]', syncError)
  }

  try {
    const payload = JSON.parse(await readFile(CREATIVE_DATA, 'utf8'))
    const ads = (payload.ads || []).map((ad) => ({
      id: ad.id,
      name: ad.name,
      campaign: ad.campaign,
      adset: ad.adset,
      segment: ad.segment,
      status: ad.status,
      effective_status: ad.effective_status,
      status_label: ad.status_label,
      created_time: ad.created_time,
      age_days: ad.age_days,
      budget_daily: ad.budget_daily,
      budget_source: ad.budget_source,
      budget_key: ad.budget_key,
      recent: ad.recent || {},
      deltas: ad.deltas || {},
      decision: ad.decision || {},
      creative: {
        title: ad.creative?.title,
        body: ad.creative?.body,
        thumbnail_url: ad.creative?.thumbnail_url,
        video_url: ad.creative?.video_url,
        video_id: ad.creative?.video_id,
        preview_shareable_link: ad.creative?.preview_shareable_link,
      },
    }))
    const response = Response.json({
      summary: {
        ...(payload.summary || {}),
        live_sync_error: syncError || payload.summary?.live_sync_error || null,
      },
      ads,
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error('[/api/meta-creative]', error)
    return Response.json({ error: error.message }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
