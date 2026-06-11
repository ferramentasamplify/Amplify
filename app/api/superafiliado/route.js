import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
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

async function fetchAllLeads() {
  const results = []
  let cursor
  do {
    const res = await notion.databases.query({ database_id: INDIQUE_DB, start_cursor: cursor, page_size: 100 })
    results.push(...res.results)
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results.map((page) => {
    const p      = page.properties
    const nome   = p['Nome Completo']?.title?.[0]?.plain_text ?? ''
    const handle = p['@ TikTok']?.rich_text?.[0]?.plain_text ?? ''
    const utm    = p['UTM_Source']?.rich_text?.[0]?.plain_text ?? ''
    const rollup = p['Qual a fase do agenciamento']?.rollup?.array ?? []
    const status = rollup.find((r) => r.select?.name)?.select?.name ?? ''
    return { id: page.id, handle: handle.replace(/^@/,'').trim(), nome, status, created: page.created_time, utm }
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

    if (!relevant.length) return { totalGmv: 0, totalCom: 0 }

    let totalGmv = 0, totalCom = 0
    for (const file of relevant) {
      const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`)
      if (!dlRes.ok) continue
      const buf  = await dlRes.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
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
        rows.slice(1).forEach(r => { totalGmv += parseBRL(r[iGmv]); totalCom += parseBRL(r[iCom]) })
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

    const agenciados = leads.filter(l => INSIDE.has(l.status))
    const result = {
      total:       leads.length,
      agenciados:  agenciados.length,
      conversion:  leads.length ? Math.round(agenciados.length / leads.length * 100) : 0,
      totalGmv,
      totalCom,
      updatedAt:   new Date().toISOString(),
    }
    cache   = result
    cacheAt = Date.now()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
