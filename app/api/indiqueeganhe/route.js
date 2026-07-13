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

function isAgenciadoStatus(status) {
  return String(status || '').trim().toLowerCase() === 'agenciado'
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
      status,
      gmvRange,
      generatedCommission: commissionForGmvRange(gmvRange),
      created: page.created_time,
      utm: p['UTM_Source']?.rich_text?.[0]?.plain_text ?? '',
    }
  })
}

async function fetchXlsxSummary() {
  try {
    const sinceDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const untilDate = new Date().toISOString().slice(0, 10)
    const listUrl = `https://www.googleapis.com/drive/v3/files?` +
      `q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` +
      `&orderBy=modifiedTime+desc&pageSize=10&fields=files(id,name,modifiedTime)` +
      `&key=${GDRIVE_KEY}`

    const listRes = await fetch(listUrl)
    if (!listRes.ok) return { totalGmv: 0, totalCom: 0 }
    const { files } = await listRes.json()
    if (!files?.length) return { totalGmv: 0, totalCom: 0 }

    const relevant = files.filter((f) => {
      const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)
      return m ? m[1] <= untilDate && m[2] >= sinceDate : false
    })

    let totalGmv = 0, totalCom = 0
    for (const file of relevant) {
      const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`)
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
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  try {
    if (cache && Date.now() - cacheAt < CACHE_TTL) return NextResponse.json(cache)

    const [leads, { totalGmv, totalCom }] = await Promise.all([fetchAllLeads(), fetchXlsxSummary()])
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
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
