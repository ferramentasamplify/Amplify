import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import * as XLSX from 'xlsx'
import { queryNotionDatabase } from '@/lib/notion-query'

export const dynamic = 'force-dynamic'

const INDIQUE_DB = '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID  = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY = process.env.GDRIVE_API_KEY || ''
const BR_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const SUPER_AFILIADO_UTMS = new Set([
  'giselecorreia',
  'jota_',
  'andreeleia_',
  'glow.fit1',
  'alex_',
  'marinaportelach',
  'alwaysfit',
  'laizmacaneiro',
])

function parseBRL(v) {
  if (!v) return 0
  return parseFloat(String(v).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.').trim()) || 0
}

function normalizeUtm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^@+/, '')
    .trim()
}

function isSuperAfiliadoUtm(value) {
  return SUPER_AFILIADO_UTMS.has(normalizeUtm(value))
}

function readPhase(prop) {
  if (!prop) return ''
  if (prop.select?.name) return prop.select.name
  if (prop.status?.name) return prop.status.name
  if (prop.multi_select?.length) return prop.multi_select.map(s => s.name).filter(Boolean).join(', ')
  if (prop.formula?.string != null) return String(prop.formula.string).trim()
  if (prop.rich_text?.length) return prop.rich_text.map(t => t.plain_text ?? '').join('').trim()
  if (prop.title?.length) return prop.title.map(t => t.plain_text ?? '').join('').trim()
  if (prop.rollup?.array?.length) {
    const item = prop.rollup.array.find(r => r.select?.name || r.status?.name || r.title?.length || r.rich_text?.length)
    return item?.select?.name
      || item?.status?.name
      || item?.title?.map(t => t.plain_text ?? '').join('').trim()
      || item?.rich_text?.map(t => t.plain_text ?? '').join('').trim()
      || ''
  }
  return ''
}

function formatTikTokHandle(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'desconhecido'

  const atMatch = raw.match(/(?:^|tiktok\.com\/)@([^/?&#\s]+)/i)
  if (atMatch?.[1]) return `@${atMatch[1].replace(/^@/, '').trim()}`

  if (/^(?:https?:\/\/)?(?:www\.)?(?:vt|vm)\.tiktok\.com\//i.test(raw)) return 'não informado'

  const pathMatch = raw.match(/tiktok\.com\/(?!link\/|share\/|t\/|v\/|embed\/|@)([^/?&#\s]+)/i)
  if (pathMatch?.[1]) return `@${pathMatch[1].replace(/^@/, '').trim()}`

  if (raw.startsWith('@') && raw.replace(/^@/, '').trim()) return raw
  if (/^https?:\/\//i.test(raw)) return 'não informado'
  return 'desconhecido'
}

function isAgenciadoStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return normalized === 'agenciado' || normalized === 'convite aceito'
}

function toDateKey(value) {
  const raw = String(value || '')
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : BR_DATE_FORMATTER.format(date)
}

function readReferenceDate(prop, fallback) {
  return prop?.date?.start || prop?.created_time || fallback || ''
}

function commissionForGmvRange(range) {
  const normalized = String(range || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized || normalized.includes('nao sei')) return 15
  if (normalized.includes('acima') || normalized.includes('100.000') && !normalized.includes('30.000')) return 350
  if (normalized.includes('30.000') && normalized.includes('100.000')) return 200
  if (normalized.includes('30.000')) return 50
  if (normalized.includes('2000') || normalized.includes('2.000')) return 15
  return 15
}

async function fetchAllLeads() {
  const results = []
  let cursor
  do {
    const res = await queryNotionDatabase(INDIQUE_DB, { start_cursor: cursor, page_size: 100 })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results.map((page) => {
    const p = page.properties
    const status = readPhase(p['Fase de agenciamento'])
    const gmvRange = readPhase(
      p['Faixa de GMV (Faturamento Mensal no TikTok Shop)']
      || p['Faixa de GMV (Faturamento Mensal no Tiktok Shop)']
    )
    const created = readReferenceDate(p['Data'], page.created_time)
    return {
      id: page.id,
      nome: p['Nome Completo']?.title?.[0]?.plain_text ?? '',
      handle: formatTikTokHandle(p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''),
      status,
      gmvRange,
      generatedCommission: commissionForGmvRange(gmvRange),
      created,
      createdDate: toDateKey(created),
      utm: p['UTM_Source']?.rich_text?.[0]?.plain_text ?? '',
    }
  }).filter((lead) => !isSuperAfiliadoUtm(lead.utm))
}

async function fetchXlsxSummary() {
  if (!GDRIVE_KEY) return { totalGmv: 0, totalCom: 0 }

  try {
    const sinceDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const untilDate = new Date().toISOString().slice(0, 10)
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=10&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(8000) })
    if (!listRes.ok) return { totalGmv: 0, totalCom: 0 }
    const { files } = await listRes.json()
    if (!files?.length) return { totalGmv: 0, totalCom: 0 }

    const relevant = files.filter((f) => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m ? m[1] <= untilDate && m[2] >= sinceDate : false
    })

    let totalGmv = 0, totalCom = 0
    for (const file of relevant) {
      const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`, { signal: AbortSignal.timeout(8000) })
      if (!dlRes.ok) continue
      const wb = XLSX.read(await dlRes.arrayBuffer(), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
      if (rows.length < 2) continue
      const header = rows[0]
      const idx = (n) => header.findIndex(h => String(h).toLowerCase().includes(n.toLowerCase()))
      const iGmv = idx('valor bruto da mercadoria') !== -1 ? idx('valor bruto da mercadoria') : idx('gmv')
      const iCom = idx('comissão estimada') !== -1 ? idx('comissão estimada') : idx('comiss')
      const resumo = rows.find(r => String(r[0]).toLowerCase() === 'resumo')
      if (resumo) {
        totalGmv += parseBRL(resumo[iGmv])
        totalCom += parseBRL(resumo[iCom])
      } else {
        rows.slice(1).forEach(r => {
          totalGmv += parseBRL(r[iGmv])
          totalCom += parseBRL(r[iCom])
        })
      }
    }
    return { totalGmv, totalCom }
  } catch {
    return { totalGmv: 0, totalCom: 0 }
  }
}

let cache = null, cacheAt = 0
const CACHE_TTL = 4 * 60 * 60 * 1000
const CACHE_FILE = '/tmp/amplify-hub-indiqueeganhe-summary-cache.json'
const SNAPSHOT_FILE = `${process.cwd()}/data/indiqueeganhe-full-snapshot.json`
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
}

function json(data, init = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CACHE_HEADERS,
      ...(init.headers || {}),
    },
  })
}

async function readCacheFile(cacheKey) {
  try {
    const saved = JSON.parse(await readFile(CACHE_FILE, 'utf8'))
    if (saved?.cacheAt && saved?.data && saved?.cacheKey === cacheKey && Date.now() - saved.cacheAt < CACHE_TTL) return saved
  } catch {}
  return null
}

async function readBundledSnapshot() {
  try {
    const saved = JSON.parse(await readFile(SNAPSHOT_FILE, 'utf8'))
    return saved?.data || saved
  } catch {}
  return null
}

async function writeCacheFile(cacheKey, data) {
  try {
    await writeFile(CACHE_FILE, JSON.stringify({ cacheAt: Date.now(), cacheKey, data }), 'utf8')
  } catch {}
}

export async function GET(req) {
  try {
    const forceSnapshot = req.nextUrl.searchParams.get('snapshot') === '1'
    const includeSales = req.nextUrl.searchParams.get('includeSales') === '1'
    const cacheKey = JSON.stringify({ includeSales })

    if (forceSnapshot) {
      const snapshot = await readBundledSnapshot()
      if (snapshot?.summary) {
        return json({ ...snapshot.summary, source: 'bundled-snapshot' })
      }
    }

    if (cache && Date.now() - cacheAt < CACHE_TTL) return json({ ...cache, source: 'live-cache' })
    const saved = await readCacheFile(cacheKey)
    if (saved) {
      cache = saved.data
      cacheAt = saved.cacheAt
      return json({ ...saved.data, source: 'live-cache' })
    }

    try {
      const [leads, sales] = await Promise.all([
        fetchAllLeads(),
        includeSales ? fetchXlsxSummary() : Promise.resolve({ totalGmv: 0, totalCom: 0 }),
      ])
      const { totalGmv, totalCom } = sales
      const totalAgenciados = leads.filter(l => isAgenciadoStatus(l.status)).length
      const conversionRate = leads.length ? Math.round(totalAgenciados / leads.length * 100) : 0
      const totalGeneratedCommission = leads.reduce((sum, lead) => {
        return isAgenciadoStatus(lead.status) ? sum + lead.generatedCommission : sum
      }, 0)
      const byStatus = leads.reduce((acc, lead) => {
        const status = lead.status || 'Sem status'
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {})

      const result = {
        total: leads.length,
        totalAgenciados,
        conversionRate,
        totalGeneratedCommission,
        byStatus,
        totalGmv,
        totalCom,
        indiqueEarn: totalCom * 0.10 * 0.20,
        updatedAt: new Date().toISOString(),
      }
      cache = result
      cacheAt = Date.now()
      await writeCacheFile(cacheKey, result)
      return json({ ...result, source: 'live-notion' })
    } catch (liveError) {
      const snapshot = await readBundledSnapshot()
      if (snapshot?.summary) {
        return json({ ...snapshot.summary, source: 'snapshot-fallback', liveError: liveError.message })
      }
      throw liveError
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
