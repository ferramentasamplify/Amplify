import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  TRACKING_EVENT_NAMES,
  normalizeTrackingEvent,
  aggregateTrackingEvents,
  appendTrackingEvent,
  loadTrackingEvents,
  isAuthorizedTrackingToken,
} from '../lib/new-brand-funnel-events.mjs'

test('normaliza um evento idempotente sem dados pessoais', () => {
  const event = normalizeTrackingEvent({
    event_id: 'form_submit_aula:lead-42',
    event_name: 'form_submit_aula',
    occurred_at: '2026-07-29T12:30:00.000Z',
    subject_id: 'lead-42',
    source: 'n8n',
    value: 1,
    properties: {
      utm_source: 'youtube',
      utm_campaign: 'aula-tiktok-shop',
      bitrix_deal_id: '987',
    },
  })

  assert.equal(event.version, 1)
  assert.equal(event.eventId, 'form_submit_aula:lead-42')
  assert.equal(event.eventName, 'form_submit_aula')
  assert.equal(event.subjectId, 'lead-42')
  assert.equal(event.value, 1)
  assert.deepEqual(event.properties, {
    utm_source: 'youtube',
    utm_campaign: 'aula-tiktok-shop',
    bitrix_deal_id: '987',
  })
})

test('aceita eventos auxiliares da LP sem transforma-los em fase do funil', () => {
  const event = normalizeTrackingEvent({
    event_id: 'price:visitor-42',
    event_name: 'price_reveal_aula',
    occurred_at: '2026-07-29T12:31:00.000Z',
    subject_id: 'visitor-42',
    source: 'lp',
  })
  const result = aggregateTrackingEvents([event], {
    from: '2026-07-01',
    to: '2026-07-31',
  })

  assert.equal(event.eventName, 'price_reveal_aula')
  assert.equal(result.acceptedEvents, 1)
  assert.equal(result.invalidEvents, 0)
  assert.equal(result.values['lesson-purchase'], null)
})

test('rejeita eventos desconhecidos e qualquer campo de PII', () => {
  assert.throws(() => normalizeTrackingEvent({
    event_id: 'x-1',
    event_name: 'evento_inventado',
    occurred_at: '2026-07-29T12:30:00.000Z',
    source: 'n8n',
  }), /evento nao permitido/i)

  assert.throws(() => normalizeTrackingEvent({
    event_id: 'form-1',
    event_name: 'form_submit_aula',
    occurred_at: '2026-07-29T12:30:00.000Z',
    subject_id: 'lead-1',
    source: 'n8n',
    properties: { email: 'nao-deve-ser-armazenado@example.com' },
  }), /propriedade nao permitida/i)
})

test('agrega por fase, deduplica event_id e respeita o periodo', () => {
  const events = [
    { eventId: 'lp:1', eventName: 'page_view_aula', occurredAt: '2026-07-10T10:00:00.000Z', value: 1 },
    { eventId: 'lp:1', eventName: 'page_view_aula', occurredAt: '2026-07-10T10:00:00.000Z', value: 1 },
    { eventId: 'lp:2', eventName: 'page_view_aula', occurredAt: '2026-07-10T11:00:00.000Z', value: 1 },
    { eventId: 'form:1', eventName: 'form_submit_aula', occurredAt: '2026-07-10T11:05:00.000Z', value: 1 },
    { eventId: 'meta:day:ad', eventName: 'creative_view_aula', occurredAt: '2026-07-10T23:00:00.000Z', value: 120 },
    { eventId: 'old', eventName: 'page_view_aula', occurredAt: '2026-06-30T23:59:59.000Z', value: 99 },
  ]

  const result = aggregateTrackingEvents(events, {
    from: '2026-07-01',
    to: '2026-07-31',
    connectedEventNames: TRACKING_EVENT_NAMES,
  })

  assert.equal(result.values['creative-view'], 120)
  assert.equal(result.values['landing-view'], 2)
  assert.equal(result.values['diagnostic-form'], 1)
  assert.equal(result.values['mentoring-sale'], 0)
  assert.equal(result.acceptedEvents, 4)
  assert.equal(result.duplicateEvents, 1)
})

test('mantem nulo quando a fonte da fase ainda nao foi conectada', () => {
  const result = aggregateTrackingEvents([], {
    from: '2026-07-01',
    to: '2026-07-31',
    connectedEventNames: ['page_view_aula'],
  })

  assert.equal(result.values['landing-view'], 0)
  assert.equal(result.values['lesson-purchase'], null)
  assert.equal(result.connectedStages, 1)
})

test('persiste em JSONL e ignora linha corrompida sem perder eventos validos', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brand-funnel-'))
  const path = join(directory, 'events.jsonl')
  try {
    const event = normalizeTrackingEvent({
      event_id: 'purchase:order-9',
      event_name: 'purchase_aula',
      occurred_at: '2026-07-29T13:00:00.000Z',
      subject_id: 'lead-9',
      source: 'n8n',
      properties: { order_id: 'order-9', revenue_cents: 9700, currency: 'BRL' },
    })
    await appendTrackingEvent(path, event)
    await import('node:fs/promises').then(({ appendFile }) => appendFile(path, '{linha-invalida}\n'))

    const loaded = await loadTrackingEvents(path)
    assert.equal(loaded.events.length, 1)
    assert.equal(loaded.invalidLines, 1)
    assert.equal(loaded.events[0].eventId, 'purchase:order-9')
    assert.match(await readFile(path, 'utf8'), /purchase_aula/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('compara o bearer token sem aceitar ausente ou incorreto', () => {
  assert.equal(isAuthorizedTrackingToken('Bearer token-correto-123', 'token-correto-123'), true)
  assert.equal(isAuthorizedTrackingToken('Bearer token-errado-123', 'token-correto-123'), false)
  assert.equal(isAuthorizedTrackingToken('', 'token-correto-123'), false)
  assert.equal(isAuthorizedTrackingToken('Bearer token-correto-123', ''), false)
})
