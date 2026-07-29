import { appendFile, chmod, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { timingSafeEqual } from 'node:crypto'

const EVENT_STAGE_MAP = Object.freeze({
  creative_view_aula: 'creative-view',
  page_view_aula: 'landing-view',
  form_submit_aula: 'diagnostic-form',
  bitrix_lead_created_aula: 'sdr-form',
  purchase_aula: 'lesson-purchase',
  bitrix_purchase_signal_aula: 'sdr-purchase',
  lesson_complete: 'lesson-consumption',
  mentoria_cta_click: 'mentoring-invite',
  bitrix_mentoria_signal: 'sdr-intent',
  mentoria_sale: 'mentoring-sale',
  form_start_aula: null,
  price_reveal_aula: null,
  checkout_click_aula: null,
  lesson_start: null,
  meeting_booked: null,
  meeting_attended: null,
})

export const TRACKING_EVENT_NAMES = Object.freeze(Object.keys(EVENT_STAGE_MAP))
export const TRACKING_STAGE_KEYS = Object.freeze([...new Set(Object.values(EVENT_STAGE_MAP).filter(Boolean))])

const ALLOWED_PROPERTIES = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'campaign_id', 'adset_id', 'ad_id', 'creative_id',
  'bitrix_deal_id', 'order_id', 'course_user_id', 'platform',
  'currency', 'revenue_cents',
])

function requiredText(value, label, maxLength = 180) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} obrigatorio`)
  const text = value.trim()
  if (text.length > maxLength) throw new Error(`${label} excede o limite`)
  return text
}

function normalizeProperties(properties) {
  if (properties == null) return {}
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('properties deve ser um objeto')
  }
  const normalized = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) throw new Error(`propriedade nao permitida: ${key}`)
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`valor invalido em properties: ${key}`)
    }
    if (typeof value === 'string' && value.length > 240) throw new Error(`propriedade excede o limite: ${key}`)
    normalized[key] = value
  }
  return normalized
}

export function normalizeTrackingEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload invalido')
  const eventName = requiredText(payload.event_name, 'event_name', 80)
  if (!Object.hasOwn(EVENT_STAGE_MAP, eventName)) throw new Error(`evento nao permitido: ${eventName}`)

  const occurredAt = requiredText(payload.occurred_at, 'occurred_at', 40)
  const timestamp = Date.parse(occurredAt)
  if (!Number.isFinite(timestamp)) throw new Error('occurred_at invalido')

  const rawValue = payload.value == null ? 1 : Number(payload.value)
  if (!Number.isFinite(rawValue) || rawValue <= 0 || !Number.isInteger(rawValue) || rawValue > 10_000_000) {
    throw new Error('value deve ser um inteiro positivo')
  }

  return {
    version: 1,
    eventId: requiredText(payload.event_id, 'event_id', 180),
    eventName,
    occurredAt: new Date(timestamp).toISOString(),
    subjectId: payload.subject_id == null ? null : requiredText(payload.subject_id, 'subject_id', 180),
    source: requiredText(payload.source, 'source', 80),
    value: rawValue,
    properties: normalizeProperties(payload.properties),
    receivedAt: new Date().toISOString(),
  }
}

function dateBoundary(date, end = false) {
  const suffix = end ? 'T23:59:59.999Z' : 'T00:00:00.000Z'
  const timestamp = Date.parse(`${date}${suffix}`)
  if (!Number.isFinite(timestamp)) throw new Error('periodo invalido')
  return timestamp
}

export function aggregateTrackingEvents(events, { from, to, connectedEventNames = [] } = {}) {
  const start = dateBoundary(from)
  const end = dateBoundary(to, true)
  const connected = new Set(connectedEventNames.filter((name) => Object.hasOwn(EVENT_STAGE_MAP, name)))
  const values = Object.fromEntries(TRACKING_STAGE_KEYS.map((key) => [key, null]))

  for (const eventName of connected) {
    const stageKey = EVENT_STAGE_MAP[eventName]
    if (stageKey) values[stageKey] = 0
  }

  const seen = new Set()
  let acceptedEvents = 0
  let duplicateEvents = 0
  let invalidEvents = 0

  for (const event of Array.isArray(events) ? events : []) {
    const knownEvent = Object.hasOwn(EVENT_STAGE_MAP, event?.eventName)
    const stageKey = knownEvent ? EVENT_STAGE_MAP[event.eventName] : null
    const timestamp = Date.parse(event?.occurredAt)
    const value = Number(event?.value)
    if (!knownEvent || !event?.eventId || !Number.isFinite(timestamp) || !Number.isInteger(value) || value <= 0) {
      invalidEvents += 1
      continue
    }
    if (timestamp < start || timestamp > end) continue
    if (seen.has(event.eventId)) {
      duplicateEvents += 1
      continue
    }
    seen.add(event.eventId)
    connected.add(event.eventName)
    if (stageKey) {
      if (values[stageKey] == null) values[stageKey] = 0
      values[stageKey] += value
    }
    acceptedEvents += 1
  }

  return {
    values,
    connectedEventNames: [...connected],
    connectedStages: TRACKING_STAGE_KEYS.filter((key) => values[key] != null).length,
    acceptedEvents,
    duplicateEvents,
    invalidEvents,
  }
}

export function stageKeyForEvent(eventName) {
  return EVENT_STAGE_MAP[eventName] || null
}

export async function appendTrackingEvent(path, event) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await appendFile(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 })
  await chmod(path, 0o600)
}

export async function loadTrackingEvents(path) {
  let content = ''
  try {
    content = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { events: [], invalidLines: 0 }
    throw error
  }

  const events = []
  let invalidLines = 0
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line)
      if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid')
      events.push(event)
    } catch {
      invalidLines += 1
    }
  }
  return { events, invalidLines }
}

export function isAuthorizedTrackingToken(authorization, expectedToken) {
  if (typeof expectedToken !== 'string' || !expectedToken) return false
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice(7), 'utf8')
  const expected = Buffer.from(expectedToken, 'utf8')
  if (supplied.length !== expected.length) return false
  return timingSafeEqual(supplied, expected)
}
