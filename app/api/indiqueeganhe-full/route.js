import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { queryNotionDatabase } from '@/lib/notion-query'

export const dynamic = 'force-dynamic'

const INDIQUE_DB = '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID  = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY = process.env.GDRIVE_API_KEY || ''

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
  const normalized = String(status || '').trim().toLowerCase()
  return normalized === 'agenciado' || normalized === 'convite aceito'
}

function isAgenciadoStatus(status) {
  return String(status || '').trim().toLowerCase() === 'agenciado'
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
    const status = readPhase(p['Fase de agenciamento']) || readPhase(p['Qual a fase do agenciamento'])
    const gmvRange = readPhase(p['Faixa de GMV (Faturamento Mensal no Tiktok Shop)'])
    return {
      id: page.id,
      nome: p['Nome Completo']?.title?.[0]?.plain_text ?? '',
      handle: (p['@ TikTok']?.rich_text?.[0]?.plain_text ?? '').replace(/^@/,'').trim(),
      utm: p['UTM_Source']?.rich_text?.[0]?.plain_text ?? '',
      status,
      gmvRange,
      generatedCommission: commissionForGmvRange(gmvRange),
      created: page.created_time,
    }
  })
}

async function fetchXlsx(sinceDate, untilDate) {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)&key=${GDRIVE_KEY}`
    const listRes = await fetch(listUrl)
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
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`)
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
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req) {
  try {
    const startDate = req.nextUrl.searchParams.get('startDate') ?? ''
    const endDate = req.nextUrl.searchParams.get('endDate') ?? new Date().toISOString().slice(0, 10)
    const hasDateFilter = Boolean(startDate || req.nextUrl.searchParams.get('endDate'))

    if (cache && !hasDateFilter && Date.now() - cacheAt < CACHE_TTL) return NextResponse.json(cache)

    const leads = await fetchAllLeads()
    const dates = leads.map(l => l.created?.slice(0, 10)).filter(Boolean).sort()
    const firstDate = startDate || dates[0] || '2024-01-01'
    const { weeklySalesMap } = await fetchXlsx(firstDate, endDate)

    const accumulatedSales = {}
    Object.values(weeklySalesMap).forEach(ws => ws.forEach(s => {
      if (!accumulatedSales[s.creator]) accumulatedSales[s.creator] = { gmv: 0, comissao: 0 }
      accumulatedSales[s.creator].gmv += s.gmv
      accumulatedSales[s.creator].comissao += s.comissao
    }))

    const enriched = leads.map(l => {
      const sale = matchCreator(l.handle, accumulatedSales)
      return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
    })
    const periodLeads = enriched.filter(l => {
      const d = l.created?.slice(0, 10)
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
      const d = l.created?.slice(0, 10)
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
    if (!hasDateFilter) { cache = result; cacheAt = Date.now() }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
