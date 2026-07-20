import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { queryNotionDatabase } from '@/lib/notion-query'

export const dynamic = 'force-dynamic'

const CREATORS_DB = '2efb0bbef153811b946ddf8f0fff81a3'
const FOLDER_ID   = process.env.GDRIVE_FOLDER_ID || '1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj'
const GDRIVE_KEY  = process.env.GDRIVE_API_KEY || ''

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

function emptyDriveResult(sinceDate, untilDate, mode, warning) {
  return {
    weeklySalesMap: {},
    weeklyAmplify: {},
    coverage: {
      requested: { startDate: sinceDate, endDate: untilDate },
      effective: { startDate: null, endDate: null },
      matchedFiles: [],
      mode,
      warnings: warning ? [warning] : [],
    },
  }
}

async function fetchCreators() {
  const results = []
  let cursor
  do {
    const res = await queryNotionDatabase(CREATORS_DB, { start_cursor: cursor, page_size: 100 })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results.map(page => {
    const p = page.properties
    return {
      id: page.id,
      nome: p['Nome Completo']?.rich_text?.[0]?.plain_text ?? p['Qual ']?.title?.[0]?.plain_text ?? '',
      handle: (p['Qual seu @ do TikTok?']?.rich_text?.[0]?.plain_text ?? '').replace(/^@/,'').trim().toLowerCase(),
      categoria: p['Categoria Amplify Club']?.select?.name ?? 'Start',
      createdAt: page.created_time,
    }
  }).filter(c => c.handle)
}

async function fetchDriveXlsx(sinceDate, untilDate) {
  try {
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)&key=${GDRIVE_KEY}`
    const listRes = await fetch(listUrl)
    if (!listRes.ok) return emptyDriveResult(sinceDate, untilDate, 'unavailable', 'Nao foi possivel listar os arquivos semanais do Drive para este filtro.')
    const { files } = await listRes.json()
    if (!files?.length) return emptyDriveResult(sinceDate, untilDate, 'empty', 'Nenhum arquivo semanal encontrado no Drive para calcular este dashboard.')

    const relevant = files.filter(f => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m ? m[1] <= untilDate && m[2] >= sinceDate : false
    })
    if (!relevant.length) return emptyDriveResult(sinceDate, untilDate, 'no_overlap', 'Nao ha arquivo semanal com sobreposicao ao periodo selecionado.')

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
        const dataRows = rows.slice(1).filter(r => { const n = String(r[iNome]??'').trim(); return n && n !== '-' && n.toLowerCase() !== 'resumo' })
        const sales = dataRows.map(r => ({ creator: cleanHandle(String(r[iNome]??'')), gmv: parseBRL(r[iGmv]), comissao: parseBRL(r[iCom]) })).filter(r => r.creator)
        const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
        return {
          weekStart: m?.[1],
          weekEnd: m?.[2],
          fileName: file.name,
          sales,
          amplifyGmv: resumo ? parseBRL(resumo[iGmv]) : dataRows.reduce((s,r)=>s+parseBRL(r[iGmv]),0),
          amplifyCom: resumo ? parseBRL(resumo[iCom]) : dataRows.reduce((s,r)=>s+parseBRL(r[iCom]),0),
        }
      } catch { return null }
    }))

    const weeklySalesMap = {}, weeklyAmplify = {}, matchedFiles = []
    processed.filter(Boolean).forEach(v => {
      if (v.weekEnd) { weeklySalesMap[v.weekEnd] = v.sales; weeklyAmplify[v.weekEnd] = { gmv: v.amplifyGmv, com: v.amplifyCom } }
      if (v.weekStart && v.weekEnd) matchedFiles.push({ name: v.fileName, startDate: v.weekStart, endDate: v.weekEnd })
    })
    const starts = matchedFiles.map(f => f.startDate).sort()
    const ends = matchedFiles.map(f => f.endDate).sort()
    const exactFile = matchedFiles.length === 1 && matchedFiles[0].startDate === sinceDate && matchedFiles[0].endDate === untilDate
    return {
      weeklySalesMap,
      weeklyAmplify,
      coverage: {
        requested: { startDate: sinceDate, endDate: untilDate },
        effective: { startDate: starts[0] ?? null, endDate: ends.at(-1) ?? null },
        matchedFiles,
        mode: exactFile ? 'exact_file' : 'weekly_overlap',
        warnings: exactFile ? [] : ['Filtro calculado por arquivos semanais do Drive: o dashboard soma semanas que sobrepoem o periodo, nao um recorte diario exato.'],
      },
    }
  } catch { return emptyDriveResult(sinceDate, untilDate, 'error', 'Erro ao carregar arquivos semanais do Drive para este filtro.') }
}

let cache = null, cacheAt = 0

export async function GET(req) {
  try {
    const startDate = req.nextUrl.searchParams.get('startDate') ?? ''
    const endDate   = req.nextUrl.searchParams.get('endDate')   ?? new Date().toISOString().slice(0, 10)
    if (cache && !startDate && Date.now() - cacheAt < 5*60*1000) return NextResponse.json(cache)

    const creators = await fetchCreators()
    const firstDate = startDate || '2024-01-01'
    const { weeklySalesMap, weeklyAmplify, coverage } = await fetchDriveXlsx(firstDate, endDate)

    const accumulatedSales = {}
    Object.values(weeklySalesMap).forEach(ws => ws.forEach(s => {
      if (!accumulatedSales[s.creator]) accumulatedSales[s.creator] = { gmv: 0, comissao: 0 }
      accumulatedSales[s.creator].gmv      += s.gmv
      accumulatedSales[s.creator].comissao += s.comissao
    }))

    const enriched = creators.map(c => {
      const sale = matchCreator(c.handle, accumulatedSales)
      return { ...c, gmv: sale?.gmv ?? 0, comissao: sale?.comissao ?? 0, amplifyRevenue: (sale?.comissao ?? 0) * 0.10 }
    })

    const byCategoria = {}
    enriched.forEach(c => { if (!byCategoria[c.categoria]) byCategoria[c.categoria] = 0; byCategoria[c.categoria]++ })

    const weeklyAmplifyData = Object.entries(weeklyAmplify)
      .map(([date, v]) => ({ date, gmv: v.gmv, comissao: v.com, amplifyRevenue: v.com * 0.10 }))
      .sort((a,b) => a.date.localeCompare(b.date))

    const totalGmv     = enriched.reduce((s,c) => s + c.gmv, 0)
    const totalCom     = enriched.reduce((s,c) => s + c.comissao, 0)
    const amplifyTotal = totalCom * 0.10
    const active       = enriched.filter(c => c.gmv > 0).length

    const weeklyByCreator = {}
    enriched.forEach(c => {
      const points = Object.entries(weeklySalesMap).map(([date, ws]) => {
        const match = ws.find(s => s.creator === c.handle || (c.handle.length >= 5 && (s.creator.includes(c.handle) || c.handle.includes(s.creator))))
        return { date, gmv: match?.gmv ?? 0, comissao: match?.comissao ?? 0 }
      }).sort((a,b) => a.date.localeCompare(b.date))
      if (points.some(p => p.gmv > 0)) weeklyByCreator[c.handle] = points
    })

    const result = {
      summary: { total: enriched.length, active, totalGmv, totalCom, amplifyTotal, byCategoria, updatedAt: new Date().toISOString() },
      creators: enriched.sort((a,b) => b.gmv - a.gmv),
      weeklyAmplifyData, weeklyByCreator, dataCoverage: coverage,
    }
    if (!startDate) { cache = result; cacheAt = Date.now() }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
