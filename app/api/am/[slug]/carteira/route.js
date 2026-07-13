import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { queryNotionDatabase } from "@/lib/notion-query";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";

async function fetchAllCreators() {
  const out = [];
  let cursor;
  do {
    const res = await queryNotionDatabase(CREATORS_DB, {
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return out.map((page) => {
    const p = page.properties;
    const nome =
      p["Nome Completo"]?.rich_text?.[0]?.plain_text ??
      p["Nome"]?.title?.[0]?.plain_text ??
      p["Qual "]?.title?.[0]?.plain_text ??
      "";
    const handle = (
      p["Qual seu @ do TikTok?"]?.rich_text?.[0]?.plain_text ?? ""
    )
      .replace(/^@/, "")
      .trim()
      .toLowerCase();
    const categoria = p["Categoria Amplify Club"]?.select?.name ?? "Start";
    // Pega qualquer campo que pareça "contato" / whatsapp / email
    const whatsapp =
      p["WhatsApp"]?.phone_number ??
      p["WhatsApp"]?.rich_text?.[0]?.plain_text ??
      null;
    const email =
      p["E-mail"]?.email ??
      p["Email"]?.email ??
      p["E-mail"]?.rich_text?.[0]?.plain_text ??
      null;
    const fase =
      p["Fase"]?.status?.name ??
      p["Fase"]?.select?.name ??
      p["Status"]?.status?.name ??
      null;
    return {
      id: page.id,
      notionUrl: `https://www.notion.so/amplify/${page.id.replace(/-/g, "")}`,
      nome,
      handle,
      categoria,
      whatsapp,
      email,
      fase,
    };
  }).filter((c) => c.handle);
}

/**
 * GET /api/am/[slug]/carteira
 * Headers obrigatórios: cookie am_session válido
 *   - Se o slug do path bater com o da sessão → libera
 *   - Se for admin (gabriel) → libera qualquer carteira
 *   - Senão → 403
 *
 * Retorna:
 *   {
 *     am: { slug, displayName, ... },
 *     creators: [{ id, nome, handle, categoria, notionUrl, whatsapp, email, gmv, comissao, amplifyRevenue, lastUpdate, ... }],
 *     summary: { total, ativos, gmvTotal, comissaoTotal, receitaTotal, byCategoria },
 *     updatedAt
 *   }
 */
export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const target = AM_BY_SLUG[slug];
    if (!target) return NextResponse.json({ error: "AM inválido." }, { status: 404 });

    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Sessão ausente. Faça login." }, { status: 401 });
    }
    if (session.slug !== slug && !session.am.isAdmin) {
      return NextResponse.json({ error: "Sem permissão pra ver essa carteira." }, { status: 403 });
    }

    const handlesDaCarteira = CARTEIRAS[slug] || [];
    const handleSet = new Set(handlesDaCarteira.map((h) => h.toLowerCase().replace(/^@/, "").trim()));
    if (handleSet.size === 0) {
      return NextResponse.json({
        am: publicAmData(target),
        creators: [],
        summary: { total: 0, ativos: 0, gmvTotal: 0, comissaoTotal: 0, receitaTotal: 0, byCategoria: {} },
        updatedAt: new Date().toISOString(),
        warning: "Carteira vazia — preencha lib/carteiras.js ou rode scripts/sync-carteiras.js",
      });
    }

    const allCreators = await fetchAllCreators();
    const carteira = allCreators.filter((c) => handleSet.has(c.handle));

    // GMV — reusa o mesmo parser do /api/club-full
    let weeklySalesMap = {};
    try {
      const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || "1VeOK2-DTfnDbbRueHpKK-a5QkQtyP_Nj";
      const GDRIVE_KEY = process.env.GDRIVE_API_KEY || "";
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,modifiedTime)&key=${GDRIVE_KEY}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const { files = [] } = await listRes.json();
        const XLSX = await import("xlsx");
        for (const file of files) {
          try {
            const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_KEY}`);
            if (!dlRes.ok) continue;
            const buf = await dlRes.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            if (rows.length < 2) continue;
            const header = rows[0];
            const idx = (n) => header.findIndex((h) => String(h).toLowerCase().includes(n.toLowerCase()));
            const iNome = idx("nome do criador") !== -1 ? idx("nome do criador") : idx("criador");
            const iGmv = idx("valor bruto da mercadoria") !== -1 ? idx("valor bruto da mercadoria") : idx("gmv");
            const iCom = idx("comissão estimada") !== -1 ? idx("comissão estimada") : idx("comiss");
            const parseBRL = (v) => {
              if (!v) return 0;
              return parseFloat(String(v).replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").trim()) || 0;
            };
            const cleanHandle = (h) => {
              h = String(h || "").toLowerCase().trim();
              const m = h.match(/tiktok\.com\/@([^/?&\s]+)/);
              if (m) return m[1];
              return h.replace("@", "").split("?")[0].split("&")[0].trim();
            };
            for (const r of rows.slice(1)) {
              const nome = String(r[iNome] ?? "").trim();
              if (!nome || nome.toLowerCase() === "resumo") continue;
              const h = cleanHandle(nome);
              if (!handleSet.has(h)) continue;
              const gmv = parseBRL(r[iGmv]);
              const com = parseBRL(r[iCom]);
              if (!weeklySalesMap[h]) weeklySalesMap[h] = { gmv: 0, comissao: 0, lastWeek: file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/)?.[2] || null };
              weeklySalesMap[h].gmv += gmv;
              weeklySalesMap[h].comissao += com;
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error("[carteira] erro GMV:", e.message);
    }

    const enriched = carteira.map((c) => {
      const sale = weeklySalesMap[c.handle] || { gmv: 0, comissao: 0 };
      return {
        ...c,
        gmv: sale.gmv,
        comissao: sale.comissao,
        amplifyRevenue: sale.comissao * 0.1,
        lastUpdate: sale.lastWeek || null,
      };
    }).sort((a, b) => b.gmv - a.gmv);

    const summary = {
      total: enriched.length,
      ativos: enriched.filter((c) => c.gmv > 0).length,
      gmvTotal: enriched.reduce((s, c) => s + c.gmv, 0),
      comissaoTotal: enriched.reduce((s, c) => s + c.comissao, 0),
      receitaTotal: enriched.reduce((s, c) => s + c.amplifyRevenue, 0),
      byCategoria: enriched.reduce((acc, c) => {
        acc[c.categoria] = (acc[c.categoria] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      am: publicAmData(target),
      creators: enriched,
      summary,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[carteira]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}