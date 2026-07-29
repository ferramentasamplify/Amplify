import {
  TRACKING_EVENT_NAMES,
  appendTrackingEvent,
  isAuthorizedTrackingToken,
  normalizeTrackingEvent,
} from '../../../../lib/new-brand-funnel-events.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const DEFAULT_EVENTS_PATH = '/var/lib/amplify-hub/new-brand-funnel-events.jsonl'
const MAX_BODY_BYTES = 16 * 1024

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

export async function GET() {
  return json({
    funnel: 'new-brand-aula-mentoria',
    configured: Boolean(process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN),
    allowedEvents: TRACKING_EVENT_NAMES,
    contract: {
      required: ['event_id', 'event_name', 'occurred_at', 'source'],
      optional: ['subject_id', 'value', 'properties'],
      idempotency: 'event_id',
      pii: 'nao enviar nome, email, telefone ou documento',
    },
  })
}

export async function POST(request) {
  const expectedToken = process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN || ''
  if (!expectedToken) return json({ error: 'tracking ainda nao configurado' }, 503)
  if (!isAuthorizedTrackingToken(request.headers.get('authorization') || '', expectedToken)) {
    return json({ error: 'nao autorizado' }, 401)
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'payload excede 16 KB' }, 413)

  try {
    const payload = await request.json()
    const event = normalizeTrackingEvent(payload)
    const path = process.env.NEW_BRAND_FUNNEL_EVENTS_PATH || DEFAULT_EVENTS_PATH
    await appendTrackingEvent(path, event)
    return json({ accepted: true, event_id: event.eventId }, 202)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'payload invalido' }, 400)
  }
}
