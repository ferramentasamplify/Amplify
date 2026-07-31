const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const DOWNLOADS = process.env.TIKTOK_REPORTS_DIR || path.join(process.cwd(), 'data/tiktok-shop-reports/downloads')
const ACQUISITION = process.env.CREATOR_ECONOMICS_ACQUISITION || '/var/lib/amplify-hub/creator-economics-acquisition.json'
const AMPLIFYOS_ACQUISITION = process.env.AMPLIFYOS_CREATOR_ACQUISITION || '/var/lib/amplify-hub/amplifyos-creator-acquisition.json'
const OUTPUT = process.env.CREATOR_ECONOMICS_OUTPUT || '/var/lib/amplify-hub/creator-economics-live.json'
const SUPER_UTMS = new Set(['giselecorreia', 'jota_', 'andreeleia_', 'glow.fit1'])

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function normalizeHandle(value) {
  let out = normalize(value)
  try { if (/^https?:\/\//.test(out)) out = new URL(out).pathname } catch {}
  out = out.replace(/^.*tiktok\.com\/@?/i, '').replace(/^@+/, '').split(/[/?#\s]/)[0]
  return out.replace(/[^a-z0-9._-]/g, '')
}
function amount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let raw = String(value ?? '').replace(/R\$/gi, '').replace(/\s/g, '')
  if (!raw) return 0
  if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  else if (raw.includes(',')) raw = raw.replace(',', '.')
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}
function round(value) { return Math.round((Number(value) || 0) * 100) / 100 }
function dayDiff(a, b) { return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) }
function earliest(rows, key = 'createdAt') { return [...rows].filter(Boolean).sort((a, b) => String(a[key] || '9999').localeCompare(String(b[key] || '9999')))[0] || null }
function groupByHandle(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const h = normalizeHandle(row.h)
    if (!h) continue
    if (!map.has(h)) map.set(h, [])
    map.get(h).push(row)
  }
  return map
}
function matches(map, aliases) { return aliases.flatMap((alias) => map.get(alias) || []) }
function sourceRecord(record, source, systemKey, systemLabel) {
  return { ...source, entryAt: String(record?.createdAt || '').slice(0, 10), systemKey, systemLabel }
}
function classify(machine, indique, sniper, form, amplifyos) {
  if (indique) {
    const utm = normalize(indique.utm)
    if (SUPER_UTMS.has(utm)) return sourceRecord(indique, { key: 'super-affiliate', label: 'Super Afiliado', detail: indique.utm || 'UTM cadastrada', evidence: 'UTM_Source · Indique e Ganhe' }, 'indique', 'Indique e Ganhe')
    return sourceRecord(indique, { key: 'referral', label: 'Indique e Ganhe', detail: indique.utm || 'Sem UTM', evidence: 'Formulario Indique e Ganhe' }, 'indique', 'Indique e Ganhe')
  }
  if (sniper) return sourceRecord(sniper, { key: 'sniper', label: 'Sniper outbound', detail: sniper.phase || 'Lead outbound', evidence: 'Base Leads Outbound' }, 'sniper', 'Sniper')
  if (amplifyos) {
    const origin = normalize(amplifyos.origin)
    if (/programa indique/.test(origin)) return sourceRecord(amplifyos, { key: 'referral', label: 'Indique e Ganhe', detail: amplifyos.origin, evidence: 'Origem · AmplifyOS' }, 'amplifyos', 'AmplifyOS / Nova IA')
    if (/ads meta/.test(origin)) return sourceRecord(amplifyos, { key: 'paid-meta', label: 'Meta Ads', detail: amplifyos.origin, evidence: 'Origem · AmplifyOS' }, 'amplifyos', 'AmplifyOS / Nova IA')
    if (/whatsapp.*direto/.test(origin)) return sourceRecord(amplifyos, { key: 'direct', label: 'WhatsApp direto', detail: amplifyos.origin, evidence: 'Origem · AmplifyOS' }, 'amplifyos', 'AmplifyOS / Nova IA')
  }
  if (machine) {
    const origin = normalize(machine.origin)
    if (/programa indique/.test(origin)) return sourceRecord(machine, { key: 'referral', label: 'Indique e Ganhe', detail: machine.origin, evidence: 'Origem · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
    if (/ads meta/.test(origin)) return sourceRecord(machine, { key: 'paid-meta', label: 'Meta Ads', detail: machine.origin, evidence: 'Origem explicita · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
    if (/origem desconhecida/.test(origin)) return sourceRecord(machine, { key: 'unknown', label: 'Origem nao identificada', detail: machine.origin, evidence: 'Origem desconhecida · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
    if (/organico meta/.test(origin)) return sourceRecord(machine, { key: 'instagram-organic', label: 'Instagram organico', detail: machine.origin, evidence: 'Origem · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
    if (/organico tiktok/.test(origin)) return sourceRecord(machine, { key: 'tiktok-organic', label: 'TikTok organico', detail: machine.origin, evidence: 'Origem · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
    if (origin) return sourceRecord(machine, { key: 'other', label: 'Outros canais', detail: machine.origin, evidence: 'Origem · Novos Creators' }, 'notion', 'Notion / Maquina antiga')
  }
  if (form) {
    const channel = normalize(form.channel)
    if (/me indicaram/.test(channel)) return sourceRecord(form, { key: 'word-of-mouth', label: 'Indicacao direta', detail: form.channel, evidence: 'Canal de Origem · formulario' }, 'form', 'Formulario / Base de Creators')
    if (/instagram/.test(channel)) return sourceRecord(form, { key: 'instagram-organic', label: 'Instagram organico', detail: form.channel, evidence: 'Canal de Origem · formulario' }, 'form', 'Formulario / Base de Creators')
    if (/tiktok/.test(channel)) return sourceRecord(form, { key: 'tiktok-organic', label: 'TikTok organico', detail: form.channel, evidence: 'Canal de Origem · formulario' }, 'form', 'Formulario / Base de Creators')
    if (/entraram em contato/.test(channel)) return sourceRecord(form, { key: 'outbound', label: 'Contato da Amplify', detail: form.channel, evidence: 'Canal de Origem · formulario' }, 'form', 'Formulario / Base de Creators')
    if (channel) return sourceRecord(form, { key: 'other', label: 'Outros canais', detail: form.channel, evidence: 'Canal de Origem · formulario' }, 'form', 'Formulario / Base de Creators')
  }
  return { key: 'unknown', label: 'Origem nao identificada', detail: '', evidence: 'Sem correspondencia de origem', entryAt: '', systemKey: 'unknown', systemLabel: 'Sistema nao identificado' }
}
function firstTouchSystem(records) {
  const candidates = records.filter((item) => item?.record?.createdAt).map((item) => ({ ...item, createdAt: String(item.record.createdAt).slice(0, 10) }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.priority - b.priority)
  return candidates[0] || null
}
function buildRuns(dates) {
  if (!dates.length) return []
  const sorted = [...new Set(dates)].sort()
  const runs = []
  let from = sorted[0], previous = sorted[0]
  for (const current of sorted.slice(1)) {
    if (dayDiff(previous, current) !== 1) {
      runs.push({ from, to: previous, days: dayDiff(from, previous) + 1 })
      from = current
    }
    previous = current
  }
  runs.push({ from, to: previous, days: dayDiff(from, previous) + 1 })
  return runs
}
function readJsonGz(file) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) }
function previousDay(value) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
function reportFiles() {
  return fs.readdirSync(DOWNLOADS)
    .filter((name) => /^creator_gmv.*\.json\.gz$/.test(name))
    .map((name) => {
      const match = name.match(/__(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:__.*)?\.json\.gz$/)
      return match ? { file: path.join(DOWNLOADS, name), date: previousDay(match[2]) } : null
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))
}

function main() {
  const acquisition = JSON.parse(fs.readFileSync(ACQUISITION, 'utf8'))
  const amplifyosAcquisition = JSON.parse(fs.readFileSync(AMPLIFYOS_ACQUISITION, 'utf8'))
  const maps = {
    forms: groupByHandle(acquisition.forms), indique: groupByHandle(acquisition.indique),
    machine: groupByHandle(acquisition.machine), sniper: groupByHandle(acquisition.sniper),
    amplifyos: groupByHandle(amplifyosAcquisition.rows),
  }
  const creators = new Map()
  const files = reportFiles()
  for (const report of files) {
    const payload = readJsonGz(report.file)
    for (const row of payload.items || []) {
      const alias = normalizeHandle(row.author_alias)
      const authorId = String(row.author_id || '').trim()
      if (!authorId && !alias) continue
      const id = authorId || `alias:${alias}`
      if (!creators.has(id)) creators.set(id, { id, aliases: new Set(), latestAlias: '', dates: [], monthLast: new Map() })
      const creator = creators.get(id)
      if (alias) {
        creator.aliases.add(alias)
        creator.latestAlias = alias
      }
      creator.dates.push(report.date)
      creator.monthLast.set(report.date.slice(0, 7), {
        month: report.date.slice(0, 7), snapshotDate: report.date,
        gmv: amount(row.sum_cl_pay_amt),
        estimatedCreatorCommission: amount(row.pre_estimated_commission),
      })
    }
  }

  const rows = []
  for (const creator of creators.values()) {
    const aliases = [...creator.aliases]
    const form = earliest(matches(maps.forms, aliases))
    const indique = earliest(matches(maps.indique, aliases))
    const machine = earliest(matches(maps.machine, aliases))
    const sniper = earliest(matches(maps.sniper, aliases))
    const amplifyos = earliest(matches(maps.amplifyos, aliases))
    const touches = [
      { record: indique, source: classify(null, indique, null, null, null), priority: 0 },
      { record: sniper, source: classify(null, null, sniper, null, null), priority: 1 },
      { record: amplifyos, source: classify(null, null, null, null, amplifyos), priority: 2 },
      { record: machine, source: classify(machine, null, null, null, null), priority: 3 },
      { record: form, source: classify(null, null, null, form, null), priority: 4 },
    ]
    const firstTouch = firstTouchSystem(touches)
    const firstKnownSource = firstTouchSystem(touches.filter((touch) => touch.source.key !== 'unknown'))
    const fallbackKnownSource = touches.find((touch) => touch.record && touch.source.key !== 'unknown')
    const source = firstKnownSource?.source || fallbackKnownSource?.source || firstTouch?.source || classify(null, null, null, null, null)
    const runs = buildRuns(creator.dates)
    const monthly = [...creator.monthLast.values()].sort((a, b) => a.month.localeCompare(b.month)).map((month) => ({
      ...month,
      activeDays: new Set(creator.dates.filter((date) => date.startsWith(month.month))).size,
      gmv: round(month.gmv),
      estimatedCreatorCommission: round(month.estimatedCreatorCommission),
      estimatedAmplifyRevenue: round(month.estimatedCreatorCommission * 0.10),
    }))
    const latestAlias = creator.latestAlias || aliases.at(-1) || creator.id
    const totalGmv = round(monthly.reduce((sum, item) => sum + item.gmv, 0))
    const commission = round(monthly.reduce((sum, item) => sum + item.estimatedCreatorCommission, 0))
    rows.push({
      id: creator.id,
      handle: latestAlias,
      aliases,
      firstLinked: runs[0]?.from || '',
      lastLinked: runs.at(-1)?.to || '',
      activeDays: new Set(creator.dates).size,
      runs,
      returned: runs.length > 1,
      returnDates: runs.slice(1).map((run) => run.from),
      form: form ? { matched: true, createdAt: form.createdAt || '', channel: form.channel || '' } : { matched: false, createdAt: '', channel: '' },
      acquisition: {
        ...source,
        entryAt: firstTouch?.createdAt || source.entryAt || '',
        systemKey: firstTouch?.source?.systemKey || source.systemKey,
        systemLabel: firstTouch?.source?.systemLabel || source.systemLabel,
        utm: source.key === 'super-affiliate' || source.key === 'referral' ? (indique?.utm || '') : '',
      },
      monthly,
      totals: { gmv: totalGmv, estimatedCreatorCommission: commission, estimatedAmplifyRevenue: round(commission * 0.10) },
    })
  }
  rows.sort((a, b) => b.totals.estimatedAmplifyRevenue - a.totals.estimatedAmplifyRevenue || a.handle.localeCompare(b.handle))
  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    coverage: { from: files[0]?.date || null, to: files.at(-1)?.date || null, dailySnapshots: files.length },
    methodology: {
      identity: 'author_id no Partner Center; join externo por @ normalizado e aliases historicos.',
      gmv: 'Ultimo valor acumulado disponivel de cada creator em cada mes; meses somados sem duplicar snapshots diarios.',
      creatorCommission: 'Campo Est. commission (pre_estimated_commission) do Partner Center.',
      amplifyRevenue: '10% da comissao estimada do creator; nao e 1% fixo do GMV.',
      form: 'Correspondencia exata do @ com a Base de Creators; sem fuzzy match.',
      source: 'Data e sistema de first-touch usam a entrada mais antiga. Canal usa a evidencia conhecida mais antiga; origem desconhecida permanece unknown e nunca herda paid.',
      cac: 'CPL Meta e observado na plataforma. CAC pago e media agregada alocada somente entre origens Ads Meta explicitas na janela comum; CAC atribuido individual/campanha/anuncio esta indisponivel sem IDs Meta no CRM.',
      ltv: 'GMV observado e somado pelo ultimo snapshot mensal. Receita Amplify estimada e 10% da Est. commission; nao e comissao liquidada nem lucro contabil.',
      returning: 'Retornante e o mesmo author_id em nova sequencia apos pelo menos um dia ausente; activeDays conta datas distintas.',
      referral: 'Super Afiliado usa membership exata no registro UTM 2026-07-31-v1; demais linhas do intake comprovado de referral ficam em Indique e Ganhe.',
    },
    sources: { ...acquisition.sources, amplifyos: { name: amplifyosAcquisition.source, ...amplifyosAcquisition.coverage }, retention: { name: 'TikTok Shop Partner Center · creator_gmv', files: files.length } },
    superAffiliateUtms: [...SUPER_UTMS],
    creators: rows,
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(output))
  console.log(JSON.stringify({ output: OUTPUT, creators: rows.length, coverage: output.coverage, matchedForms: rows.filter((row) => row.form.matched).length, sources: Object.fromEntries([...new Set(rows.map((row) => row.acquisition.key))].map((key) => [key, rows.filter((row) => row.acquisition.key === key).length])) }, null, 2))
}

try { main() } catch (error) { console.error(error.stack || error.message); process.exit(1) }
