const fs = require('fs')

const DBS = {
  machine: '2efb0bbe-f153-813a-92a5-c3e20c6130b2',
  forms: '2efb0bbe-f153-811b-946d-df8f0fff81a3',
  indique: '31ab0bbef15380a1ab97caa5c68e9813',
  sniper: '344b0bbef153803d9fe9f956e2f67f20',
}

function readToken() {
  if (process.env.NOTION_TOKEN || process.env.NOTION_API_TOKEN) return process.env.NOTION_TOKEN || process.env.NOTION_API_TOKEN
  try {
    const credentials = JSON.parse(fs.readFileSync('/tmp/creds.json', 'utf8'))
    const credential = credentials.find((item) => item.name === 'Notion <> Amplify')
    return credential?.data?.apiKey || credential?.data?.apiToken || credential?.data?.token || ''
  } catch { return '' }
}
const token = readToken()
if (!token) throw new Error('credencial Notion ausente')

function text(prop) {
  if (!prop) return ''
  for (const key of ['title', 'rich_text']) {
    if (Array.isArray(prop[key])) return prop[key].map((item) => item?.plain_text || item?.text?.content || '').join('').trim()
  }
  if (prop.select) return prop.select.name || ''
  if (prop.status) return prop.status.name || ''
  if (prop.date) return prop.date.start || ''
  if (prop.created_time) return prop.created_time
  if (prop.formula) return String(prop.formula.string ?? prop.formula.number ?? '')
  if (prop.rollup) {
    if (Array.isArray(prop.rollup.array)) return prop.rollup.array.map(text).filter(Boolean).join(', ')
    return String(prop.rollup.string ?? prop.rollup.number ?? '')
  }
  return ''
}

function normalizeHandle(value) {
  let out = String(value || '').trim().toLowerCase()
  try {
    if (/^https?:\/\//.test(out)) out = new URL(out).pathname
  } catch {}
  out = out.replace(/^.*tiktok\.com\/@?/i, '').replace(/^@+/, '').split(/[/?#\s]/)[0]
  return out.replace(/[^a-z0-9._-]/g, '')
}

function iso(value, fallback = '') {
  const raw = String(value || fallback || '').trim()
  const parsed = raw ? new Date(raw) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : ''
}

async function notion(path, options = {}) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(`Notion ${response.status}: ${payload.code || payload.message || 'erro'}`)
  return payload
}

async function queryAll(databaseId) {
  const rows = []
  let cursor = null
  do {
    const payload = await notion(`databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    })
    rows.push(...(payload.results || []))
    cursor = payload.has_more ? payload.next_cursor : null
  } while (cursor)
  return rows
}

function compactForm(page) {
  const p = page.properties || {}
  const h = normalizeHandle(text(p['Qual seu @ do TikTok?']))
  if (!h) return null
  return {
    h,
    createdAt: iso(page.created_time),
    startAt: iso(text(p['Data início Amplify'])),
    channel: text(p['Canal de Origem']),
  }
}

function compactIndique(page) {
  const p = page.properties || {}
  const h = normalizeHandle(text(p['@ TikTok']))
  if (!h) return null
  return {
    h,
    createdAt: iso(text(p.Data), page.created_time),
    utm: text(p.UTM_Source),
    phase: text(p['Fase de agenciamento']),
  }
}

function compactMachine(page) {
  const p = page.properties || {}
  const h = normalizeHandle(text(p['@ do Tiktok']))
  if (!h) return null
  const atendimento = text(p['Qual a plataforma de atendimento?'])
  if (/renova/i.test(atendimento)) return null
  return {
    h,
    createdAt: iso(text(p['Data do Primeiro contato']), page.created_time),
    agenciadoAt: iso(text(p['Data do agenciamento'])),
    origin: text(p.Origem),
    phase: text(p['Qual fase do agenciamento?']),
  }
}

function compactSniper(page) {
  const p = page.properties || {}
  const h = normalizeHandle(text(p['Creator ID']))
  if (!h) return null
  return {
    h,
    createdAt: iso(page.created_time),
    firstContactAt: iso(text(p['Data do primeiro Huggy'])),
    phase: text(p['Status de contato']),
  }
}

async function main() {
  const [forms, indique, machine, sniper] = await Promise.all([
    queryAll(DBS.forms), queryAll(DBS.indique), queryAll(DBS.machine), queryAll(DBS.sniper),
  ])
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: {
      forms: { name: 'Notion · Base de Creators', databaseId: DBS.forms, rows: forms.length },
      indique: { name: 'Notion · Indique e Ganhe', databaseId: DBS.indique, rows: indique.length },
      machine: { name: 'Notion · Novos Creators', databaseId: DBS.machine, rows: machine.length },
      sniper: { name: 'Notion · Leads Outbound', databaseId: DBS.sniper, rows: sniper.length },
    },
    forms: forms.map(compactForm).filter(Boolean),
    indique: indique.map(compactIndique).filter(Boolean),
    machine: machine.map(compactMachine).filter(Boolean),
    sniper: sniper.map(compactSniper).filter(Boolean),
  }
  process.stdout.write(JSON.stringify(output))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
