import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { RACE_PARTICIPANTS, AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { queryNotionDatabase } from "@/lib/notion-query";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";

/**
 * GET /api/am/central
 * Retorna a "corrida" entre os AMs:
 *  - carteira de cada um
 *  - GMV total do mês / geral
 *  - % da meta (se houver)
 *  - top creators
 *  - posição na corrida (1º, 2º, 3º...)
 *
 * Acesso: precisa estar logado (qualquer AM).
 */
export async function GET() {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Sessão ausente. Faça login." }, { status: 401 });
    }

    // 1) busca handles por AM
    const carteirasPorAm = {};
    for (const am of RACE_PARTICIPANTS) {
      carteirasPorAm[am.slug] = (CARTEIRAS[am.slug] || []).map((h) =>
        String(h).toLowerCase().replace(/^@/, "").trim(),
      );
    }

    // 2) busca creators no Notion
    const allPages = [];
    let cursor;
    do {
      const res = await queryNotionDatabase(CREATORS_DB, { start_cursor: cursor, page_size: 100 });
      allPages.push(...res.results);
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    const creatorsByHandle = {};
    for (const page of allPages) {
      const p = page.properties;
      const handle = (
        p["Qual seu @ do TikTok?"]?.rich_text?.[0]?.plain_text ?? ""
      )
        .replace(/^@/, "")
        .trim()
        .toLowerCase();
      if (!handle) continue;
      creatorsByHandle[handle] = {
        id: page.id,
        nome:
          p["Nome Completo"]?.rich_text?.[0]?.plain_text ??
          p["Nome"]?.title?.[0]?.plain_text ??
          p["Qual "]?.title?.[0]?.plain_text ??
          handle,
        handle,
        categoria: p["Categoria Amplify Club"]?.select?.name ?? "Start",
      };
    }

    // 3) GMV por handle (Drive XLSX)
    const salesByHandle = {};
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
              if (!salesByHandle[h]) salesByHandle[h] = { gmv: 0, comissao: 0 };
              salesByHandle[h].gmv += parseBRL(r[iGmv]);
              salesByHandle[h].comissao += parseBRL(r[iCom]);
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error("[central] erro GMV:", e.message);
    }

    // 4) agrega por AM
    const ranking = RACE_PARTICIPANTS.map((am) => {
      const handles = carteirasPorAm[am.slug] || [];
      const detalhes = handles.map((h) => {
        const c = creatorsByHandle[h] || { id: null, nome: h, handle: h, categoria: "Start" };
        const s = salesByHandle[h] || { gmv: 0, comissao: 0 };
        return { ...c, gmv: s.gmv, comissao: s.comissao, amplifyRevenue: s.comissao * 0.1 };
      }).sort((a, b) => b.gmv - a.gmv);

      const gmvTotal = detalhes.reduce((acc, c) => acc + c.gmv, 0);
      const comTotal = detalhes.reduce((acc, c) => acc + c.comissao, 0);
      const recTotal = detalhes.reduce((acc, c) => acc + c.amplifyRevenue, 0);
      const ativos = detalhes.filter((c) => c.gmv > 0).length;

      return {
        am: publicAmData(am),
        gmvTotal,
        comissaoTotal: comTotal,
        receitaTotal: recTotal,
        carteiraSize: handles.length,
        ativos,
        top5: detalhes.slice(0, 5),
      };
    }).sort((a, b) => b.gmvTotal - a.gmvTotal);

    // Adiciona posição (1º, 2º, 3º)
    ranking.forEach((r, i) => {
      r.position = i + 1;
    });

    // Calcula "pista" — cada AM comanda de 0% a 100% baseado na maior GMV
    const maxGmv = Math.max(...ranking.map((r) => r.gmvTotal), 1);
    const track = ranking.map((r) => ({
      am: publicAmData(r.am),
      position: r.position,
      gmvTotal: r.gmvTotal,
      comissaoTotal: r.comissaoTotal,
      receitaTotal: r.receitaTotal,
      carteiraSize: r.carteiraSize,
      ativos: r.ativos,
      // posição na pista (0-100)
      trackPositionPct: (r.gmvTotal / maxGmv) * 100,
      // distancia do líder (em R$)
      gapFromLeader: i => Math.max(0, ranking[0].gmvTotal - r.gmvTotal),
      top5: r.top5,
    }));

    return NextResponse.json({
      ranking: track,
      total: ranking.length,
      maxGmv,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[central]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}