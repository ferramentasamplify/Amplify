import { NextResponse } from 'next/server'
import pkg from '@notionhq/client'
const { Client } = pkg
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

const notion     = new Client({ auth: process.env.NOTION_TOKEN })
const INDIQUE_DB = '31ab0bbef15380a1ab97caa5c68e9813'
const FOLDER_ID  = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY = process.env.GDRIVE_API_KEY || ''
const INSIDE     = new Set(['Agenciado', 'Convite Aceito'])

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

async function fetchAllLeads() {
  const results = []
  let cursor
  do {
    const res = await notion.databases.query({ database_id: INDIQUE_DB, start_cursor: cursor, page_size: 100 })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results.map((page) => {
    const p = page.properties
    const rollup = p['Qual a fase do agenciamento']?.rollup?.array ?? []
    const status = rollup.find(r => r.select?.name)?.select?.name ?? ''
    return {
      id: page.id,
      nome: p['Nome Completo']?.title?.[0]?.plain_text ?? '',
      handle: (p['@ TikTok']?.rich_text?.[0]?.plain_text ?? '').replace(/^@/,'').trim(),
      utm: p['UTM_Source']?.rich_text?.[0]?.plain_text ?? '',
      status, created: page.created_time,
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
        const buf = await dlRes.arrayBuffer()
        const wb  = XLSX.read(buf, { type: 'array' })
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
      } catch { return null }
    }))

    const weeklySalesMap = {}, weeklyAmplify = {}
    processed.filter(Boolean).forEach(v => {
      if (v.weekEnd) {
        weeklySalesMap[v.weekEnd] = v.sales
        weeklyAmplify[v.weekEnd]  = { gmv: v.amplifyGmv, com: v.amplifyCom }
      }
    })
    return { weeklySalesMap, weeklyAmplify }
  } catch { return { weeklySalesMap: {}, weeklyAmplify: {} } }
}

let cache = null, cacheAt = 0
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req) {
  try {
    if (cache && !req.nextUrl.searchParams.get('startDate') && Date.now() - cacheAt < CACHE_TTL) return NextResponse.json(cache)

    const startDate = req.nextUrl.searchParams.get('startDate') ?? ''
    const endDate   = req.nextUrl.searchParams.get('endDate')   ?? new Date().toISOString().slice(0,10)

    const leads = await fetchAllLeads()
    const dates = leads.map(l => l.created?.slice(0,10)).filter(Boolean).sort()
    const firstDate = startDate || dates[0] || '2024-01-01'
    const { weeklySalesMap, weeklyAmplify } = await fetchXlsx(firstDate, endDate)

    const accumulatedSales = {}
    Object.values(weeklySalesMap).forEach(ws => ws.forEach(s => {
      if (!accumulatedSales[s.creator]) accumulatedSales[s.creator] = { gmv: 0, comissao: 0 }
      accumulatedSales[s.creator].gmv      += s.gmv
      accumulatedSales[s.creator].comissao += s.comissao
    }))

    const enriched = leads.map(l => {
      const inside = INSIDE.has(l.status)
      const sale   = inside ? matchCreator(l.handle, accumulatedSales) : null
      return { ...l, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0 }
    })

    const agenciados = enriched.filter(l => INSIDE.has(l.status))
    const totalGmv   = agenciados.reduce((s,l) => s + l.gmv, 0)
    const totalCom   = agenciados.reduce((s,l) => s + l.comissao, 0)
    const giseleEarn = totalCom * 0.10 * 0.20

    const byDay = {}
    enriched.forEach(l => {
      const d = l.created?.slice(0,10)
      if (d && d >= firstDate && d <= endDate) byDay[d] = (byDay[d] ?? 0) + 1
    })

    const weeklyData = Object.entries(weeklySalesMap).map(([date, ws]) => {
      const gmv = ws.reduce((s,r) => s + r.gmv, 0)
      const com = ws.reduce((s,r) => s + r.comissao, 0)
      return { date, gmv, comissao: com, giseleEarn: com * 0.10 * 0.20 }
    }).sort((a,b) => a.date.localeCompare(b.date))

    const weeklyDataByCreator = {}
    agenciados.forEach(lead => {
      const h = cleanHandle(lead.handle)
      const points = Object.entries(weeklySalesMap).map(([date, ws]) => {
        const match = ws.find(s => s.creator === h || (h.length >= 5 && (s.creator.includes(h) || h.includes(s.creator))))
        return { date, gmv: match?.gmv ?? 0, comissao: match?.comissao ?? 0, giseleEarn: (match?.comissao ?? 0) * 0.10 * 0.20 }
      }).sort((a,b) => a.date.localeCompare(b.date))
      if (points.some(p => p.gmv > 0)) weeklyDataByCreator[lead.handle || h] = points
    })

    const result = {
      summary: { total: enriched.length, agenciados: agenciados.length, conversion: enriched.length ? Math.round(agenciados.length/enriched.length*100) : 0, totalGmv, totalCom, giseleEarn, updatedAt: new Date().toISOString() },
      leads: enriched.sort((a,b) => b.gmv - a.gmv),
      byDay: Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([date,n]) => ({ date, n })),
      weeklyData, weeklyDataByCreator,
    }
    if (!startDate) { cache = result; cacheAt = Date.now() }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
