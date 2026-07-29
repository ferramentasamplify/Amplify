import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GET, POST } from '../app/api/new-brand-funnel/events/route.js'

const validPayload = {
  event_id: 'form_submit_aula:lead-77',
  event_name: 'form_submit_aula',
  occurred_at: '2026-07-29T15:00:00.000Z',
  subject_id: 'lead-77',
  source: 'n8n',
  value: 1,
  properties: { utm_source: 'youtube' },
}

test('GET publica somente o contrato seguro e o estado da configuracao', async () => {
  const previous = process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
  delete process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
  try {
    const response = await GET()
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.configured, false)
    assert.ok(body.allowedEvents.includes('form_submit_aula'))
    assert.equal('events' in body, false)
  } finally {
    if (previous == null) delete process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
    else process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN = previous
  }
})

test('POST permanece fechado sem token configurado', async () => {
  const previous = process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
  delete process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
  try {
    const request = new Request('http://localhost/api/new-brand-funnel/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer qualquer' },
      body: JSON.stringify(validPayload),
    })
    const response = await POST(request)
    assert.equal(response.status, 503)
  } finally {
    if (previous == null) delete process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
    else process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN = previous
  }
})

test('POST exige bearer correto, valida e persiste o evento', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'brand-funnel-route-'))
  const previousToken = process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
  const previousPath = process.env.NEW_BRAND_FUNNEL_EVENTS_PATH
  process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN = 'token-forte-de-teste'
  process.env.NEW_BRAND_FUNNEL_EVENTS_PATH = join(directory, 'events.jsonl')
  try {
    const unauthorized = await POST(new Request('http://localhost/api/new-brand-funnel/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer errado' },
      body: JSON.stringify(validPayload),
    }))
    assert.equal(unauthorized.status, 401)

    const accepted = await POST(new Request('http://localhost/api/new-brand-funnel/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token-forte-de-teste' },
      body: JSON.stringify(validPayload),
    }))
    const body = await accepted.json()
    assert.equal(accepted.status, 202)
    assert.equal(body.accepted, true)
    assert.equal(body.event_id, validPayload.event_id)

    const invalid = await POST(new Request('http://localhost/api/new-brand-funnel/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token-forte-de-teste' },
      body: JSON.stringify({ ...validPayload, properties: { phone: 'nao' } }),
    }))
    assert.equal(invalid.status, 400)
  } finally {
    if (previousToken == null) delete process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN
    else process.env.NEW_BRAND_FUNNEL_INGEST_TOKEN = previousToken
    if (previousPath == null) delete process.env.NEW_BRAND_FUNNEL_EVENTS_PATH
    else process.env.NEW_BRAND_FUNNEL_EVENTS_PATH = previousPath
    await rm(directory, { recursive: true, force: true })
  }
})
