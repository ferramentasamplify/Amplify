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

function cleanHandle(h) {
  h = h.toLowerCase().trim()
  const m = h.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  return h.replace('@','').split('?')[0].split('&')[0].trim()
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

function matchCreator(handle, salesMap) {
  const h = cleanHandle(handle)
  if (!h) return null
  if (salesMap[h]) return salesMap[h]
  if (h.length >= 5) {
    const key = Object.keys(salesMap).find(k => k.includes(h) || h.includes(k))
    if (key) return salesMap[key]
  }
  return null
}

function isConvertedStatus(status) {
  return isAgenciadoStatus(status)
}

function isAgenciadoStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return normalized === 'agenciado' || normalized === 'convite aceito'
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

function nextDate(date) {
  const [year, month, day] = String(date || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return next.toISOString().slice(0, 10)
}

function buildReferenceDateFilter(startDate, endDate) {
  const date = {}
  if (startDate) date.on_or_after = startDate
  if (endDate) date.on_or_before = endDate
  return Object.keys(date).length
    ? { property: 'Data', date }
    : undefined
}

async function fetchAllLeads({ startDate = '', endDate = '' } = {}) {
  const results = []
  let cursor
  const filter = buildReferenceDateFilter(startDate, endDate)
  const sorts = startDate
    ? [{ property: 'Data', direction: 'descending' }]
    : undefined
  do {
    const res = await queryNotionDatabase(INDIQUE_DB, { start_cursor: cursor, page_size: 100, filter, sorts })
    const pageResults = res.results || []
    results.push(...pageResults)
    if (startDate && pageResults.length) {
      const oldestDate = pageResults
        .map((page) => toDateKey(readReferenceDate(page.properties?.Data, page.created_time)))
        .filter(Boolean)
        .sort()[0]
      if (oldestDate && oldestDate < startDate) break
    }
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
    const createdDate = toDateKey(created)
    return {
      id: page.id,
      nome: p['Nome Completo']?.title?.[0]?.plain_text ?? '',
      handle: formatTikTokHandle(p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''),
      utm: p['UTM_Source']?.rich_text?.[0]?.plain_text ?? '',
      status,
      gmvRange,
      generatedCommission: commissionForGmvRange(gmvRange),
      created,
      createdDate,
    }
  }).filter((lead) => {
    const date = lead.createdDate || lead.created?.slice(0, 10)
    return date && !isSuperAfiliadoUtm(lead.utm) && (!startDate || date >= startDate) && (!endDate || date <= endDate)
  })
}

async function fetchXlsx(sinceDate, untilDate) {
  if (!GDRIVE_KEY) return { weeklySalesMap: {}, weeklyAmplify: {} }

  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)&key=${GDRIVE_KEY}`
    const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(8000) })
    if (!listRes.ok) return { weeklySalesMap: {}, weeklyAmplify: {} }
    const { files } = await listRes.json()
    if (!files?.length) return { weeklySalesMap: {}, weeklyAmplify: {} }

    const relevant = files.filter(f => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m ? m[1] <= untilDate && m[2] >= sinceDate : false
    })
    if (!relevant.length) return { weeklySalesMap: {}, weeklyAmplify: {} }

    const processed = await Promise.all(relevant.map(async file => {
      try {
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`, { signal: AbortSignal.timeout(8000) })
        if (!dlRes.ok) return null
        const wb = XLSX.read(await dlRes.arrayBuffer(), { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
        if (rows.length < 2) return null
        const header = rows[0]
        const idx = n => header.findIndex(h => String(h).toLowerCase().includes(n.toLowerCase()))
        const iNome = idx('nome do criador') !== -1 ? idx('nome do criador') : idx('criador')
        const iGmv  = idx('valor bruto da mercadoria') !== -1 ? idx('valor bruto da mercadoria') : idx('gmv')
        const iCom  = idx('comissão estimada') !== -1 ? idx('comissão estimada') : idx('comiss')
        const resumo = rows.find(r => String(r[0]).toLowerCase() === 'resumo')
        const sales = rows.slice(1).filter(r => {
          const n = String(r[iNome] ?? '').trim()
          return n && n !== '-' && n !== '--' && n.toLowerCase() !== 'resumo'
        }).map(r => ({ creator: cleanHandle(String(r[iNome] ?? '')), gmv: parseBRL(r[iGmv]), comissao: parseBRL(r[iCom]) }))
          .filter(r => r.creator)
        const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
        return { weekEnd: m?.[2], sales, amplifyGmv: resumo ? parseBRL(resumo[iGmv]) : sales.reduce((s,r)=>s+r.gmv,0), amplifyCom: resumo ? parseBRL(resumo[iCom]) : sales.reduce((s,r)=>s+r.comissao,0) }
      } catch {
        return null
      }
    }))

    const weeklySalesMap = {}, weeklyAmplify = {}
    processed.filter(Boolean).forEach(v => {
      if (v.weekEnd) {
        weeklySalesMap[v.weekEnd] = v.sales
        weeklyAmplify[v.weekEnd] = { gmv: v.amplifyGmv, com: v.amplifyCom }
      }
    })
    return { weeklySalesMap, weeklyAmplify }
  } catch {
    return { weeklySalesMap: {}, weeklyAmplify: {} }
  }
}

let cache = null, cacheAt = 0
const CACHE_TTL = 4 * 60 * 60 * 1000
const CACHE_FILE = '/tmp/amplify-hub-indiqueeganhe-full-cache.json'
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

function filterCachedData(data, startDate, endDate) {
  const leads = (data.leads || []).filter((lead) => {
    const d = lead.createdDate || lead.created?.slice(0, 10)
    return d && (!startDate || d >= startDate) && (!endDate || d <= endDate)
  })
  const totalAgenciados = leads.filter((lead) => isAgenciadoStatus(lead.status)).length
  const totalGmv = leads.reduce((sum, lead) => sum + Number(lead.gmv || 0), 0)
  const totalCom = leads.reduce((sum, lead) => sum + Number(lead.comissao || 0), 0)
  const totalGeneratedCommission = leads.reduce((sum, lead) => {
    return isAgenciadoStatus(lead.status) ? sum + Number(lead.generatedCommission || 0) : sum
  }, 0)
  const leadsWithGmv = leads.filter((lead) => Number(lead.gmv || 0) > 0)
  const byStatus = leads.reduce((acc, lead) => {
    const status = lead.status || 'Sem status'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const byDay = leads.reduce((acc, lead) => {
    const d = lead.createdDate || lead.created?.slice(0, 10)
    if (!d) return acc
    if (!acc[d]) acc[d] = { n: 0, converted: 0 }
    acc[d].n += 1
    if (isConvertedStatus(lead.status)) acc[d].converted += 1
    return acc
  }, {})
  const weeklyData = (data.weeklyData || []).filter((point) => {
    return (!startDate || point.date >= startDate) && (!endDate || point.date <= endDate)
  })
  const weeklyDataByCreator = Object.fromEntries(
    Object.entries(data.weeklyDataByCreator || {}).map(([creator, points]) => [
      creator,
      points.filter((point) => (!startDate || point.date >= startDate) && (!endDate || point.date <= endDate)),
    ])
  )

  return {
    ...data,
    summary: {
      ...(data.summary || {}),
      total: leads.length,
      totalAgenciados,
      conversionRate: leads.length ? Math.round(totalAgenciados / leads.length * 100) : 0,
      totalGeneratedCommission,
      leadsWithGmv: leadsWithGmv.length,
      matchRate: leads.length ? Math.round(leadsWithGmv.length / leads.length * 100) : 0,
      totalGmv,
      totalCom,
      indiqueEarn: totalCom * 0.10 * 0.20,
      byStatus,
    },
    leads,
    byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })),
    weeklyData,
    weeklyDataByCreator,
    fromCache: true,
  }
}

export async function GET(req) {
  try {
    const startDate = req.nextUrl.searchParams.get('startDate') ?? ''
    const endDate = req.nextUrl.searchParams.get('endDate') ?? new Date().toISOString().slice(0, 10)
    const hasDateFilter = Boolean(startDate || req.nextUrl.searchParams.get('endDate'))
    const forceSnapshot = req.nextUrl.searchParams.get('snapshot') === '1'
    const includeSales = req.nextUrl.searchParams.get('includeSales') === '1'
    const cacheKey = JSON.stringify({ startDate, endDate, hasDateFilter, includeSales })

    if (forceSnapshot) {
      const snapshot = await readBundledSnapshot()
      if (snapshot) {
        const data = hasDateFilter ? filterCachedData(snapshot, startDate, endDate) : snapshot
        return json({ ...data, source: 'bundled-snapshot' })
      }
    }

    const saved = await readCacheFile(cacheKey)
    if (hasDateFilter && saved) {
      return json({ ...filterCachedData(saved.data, startDate, endDate), source: 'live-cache' })
    }

    if (!hasDateFilter) {
      if (cache && Date.now() - cacheAt < CACHE_TTL) return json({ ...cache, source: 'live-cache' })
      if (saved) {
        cache = saved.data
        cacheAt = saved.cacheAt
        return json({ ...saved.data, source: 'live-cache' })
      }
    }

    try {
      const leads = await fetchAllLeads({ startDate, endDate: hasDateFilter ? endDate : '' })
      const dates = leads.map(l => l.createdDate || l.created?.slice(0, 10)).filter(Boolean).sort()
      const firstDate = startDate || dates[0] || '2024-01-01'
      const { weeklySalesMap } = includeSales ? await fetchXlsx(firstDate, endDate) : { weeklySalesMap: {} }

      const accumulatedSales = {}
      Object.values(weeklySalesMap).forEach(ws => ws.forEach(s => {
        if (!accumulatedSales[s.creator]) accumulatedSales[s.creator] = { gmv: 0, comissao: 0 }
        accumulatedSales[s.creator].gmv += s.gmv
        accumulatedSales[s.creator].comissao += s.comissao
      }))

      const enriched = leads.map(l => {
        const sale = includeSales ? matchCreator(l.handle, accumulatedSales) : null
        return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
      })
      const periodLeads = enriched.filter(l => {
        const d = l.createdDate || l.created?.slice(0, 10)
        return d && d >= firstDate && d <= endDate
      })
      const leadsWithGmv = periodLeads.filter(l => l.gmv > 0)
      const totalGmv = periodLeads.reduce((s, l) => s + l.gmv, 0)
      const totalCom = periodLeads.reduce((s, l) => s + l.comissao, 0)
      const indiqueEarn = totalCom * 0.10 * 0.20
      const totalAgenciados = periodLeads.filter(l => isAgenciadoStatus(l.status)).length
      const conversionRate = periodLeads.length ? Math.round(totalAgenciados / periodLeads.length * 100) : 0
      const totalGeneratedCommission = periodLeads.reduce((sum, lead) => {
        return isAgenciadoStatus(lead.status) ? sum + lead.generatedCommission : sum
      }, 0)
      const byStatus = periodLeads.reduce((acc, lead) => {
        const status = lead.status || 'Sem status'
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      }, {})

      const byDay = {}
      periodLeads.forEach(l => {
        const d = l.createdDate || l.created?.slice(0, 10)
        if (d) {
          if (!byDay[d]) byDay[d] = { n: 0, converted: 0 }
          byDay[d].n += 1
          if (isConvertedStatus(l.status)) byDay[d].converted += 1
        }
      })

      const weeklyData = Object.entries(weeklySalesMap).map(([date, ws]) => {
        const gmv = ws.reduce((s, r) => s + r.gmv, 0)
        const com = ws.reduce((s, r) => s + r.comissao, 0)
        return { date, gmv, comissao: com, indiqueEarn: com * 0.10 * 0.20 }
      }).sort((a, b) => a.date.localeCompare(b.date))

      const weeklyDataByCreator = {}
      periodLeads.forEach(lead => {
        const h = cleanHandle(lead.handle)
        const points = Object.entries(weeklySalesMap).map(([date, ws]) => {
          const match = ws.find(s => s.creator === h || (h.length >= 5 && (s.creator.includes(h) || h.includes(s.creator))))
          return { date, gmv: match?.gmv ?? 0, comissao: match?.comissao ?? 0, indiqueEarn: (match?.comissao ?? 0) * 0.10 * 0.20 }
        }).sort((a, b) => a.date.localeCompare(b.date))
        if (points.some(p => p.gmv > 0)) weeklyDataByCreator[lead.handle || h] = points
      })

      const result = {
        summary: { total: periodLeads.length, totalAgenciados, conversionRate, totalGeneratedCommission, leadsWithGmv: leadsWithGmv.length, matchRate: periodLeads.length ? Math.round(leadsWithGmv.length / periodLeads.length * 100) : 0, totalGmv, totalCom, indiqueEarn, byStatus, updatedAt: new Date().toISOString() },
        leads: periodLeads.sort((a, b) => b.gmv - a.gmv),
        byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })),
        weeklyData,
        weeklyDataByCreator,
      }
      if (!hasDateFilter) {
        cache = result
        cacheAt = Date.now()
      }
      await writeCacheFile(cacheKey, result)
      return json({ ...result, source: 'live-notion' })
    } catch (liveError) {
      const snapshot = await readBundledSnapshot()
      if (snapshot) {
        const data = hasDateFilter ? filterCachedData(snapshot, startDate, endDate) : snapshot
        return json({ ...data, source: 'snapshot-fallback', liveError: liveError.message })
      }
      throw liveError
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
