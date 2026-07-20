import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { RACE_PARTICIPANTS, AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { queryNotionDatabase } from "@/lib/notion-query";
import { aggregateTikTokSnapshots, cleanHandle, defaultSnapshotPeriod } from "@/lib/tiktok-shop-snapshots";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";

const clampTrackPct = (progressPct) => Math.max(8, Math.min(92, (progressPct / 100) * 92));
const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
const handleFilter = (handles) => ({
  or: handles.map((handle) => ({
    property: "Qual seu @ do TikTok?",
    rich_text: { contains: handle },
  })),
});
const addMonthsISO = (dateString, months) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const insightFromSales = (currentGmv, previousGmv) => {
  if (!previousGmv) return "Sem base anterior no snapshot Partner Center.";
  const delta = currentGmv - previousGmv;
  const pct = (delta / previousGmv) * 100;
  if (pct >= 12) return `GMV subindo ${pct.toFixed(1)}% vs. periodo anterior.`;
  if (pct <= -8) return `GMV caindo ${Math.abs(pct).toFixed(1)}% vs. periodo anterior.`;
  return `GMV estavel (${pct.toFixed(1)}% vs. periodo anterior).`;
};

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
export async function GET(req) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Sessão ausente. Faça login." }, { status: 401 });
    }
    const url = new URL(req.url);
    const defaultPeriod = defaultSnapshotPeriod();
    const fromDate = url.searchParams.get("from") || defaultPeriod.from;
    const toDate = url.searchParams.get("to") || defaultPeriod.to;
    const previousFrom = addMonthsISO(fromDate, -1);
    const previousTo = addMonthsISO(toDate, -1);

    // 1) busca handles por AM
    const carteirasPorAm = {};
    for (const am of RACE_PARTICIPANTS) {
      carteirasPorAm[am.slug] = (CARTEIRAS[am.slug] || []).map(cleanHandle);
    }
    const allCarteiraHandles = new Set(Object.values(carteirasPorAm).flat());

    // 2) busca creators no Notion
    const allPages = [];
    const sourceStatus = {
      notion: { ok: true, message: "Notion carregado." },
      sales: { ok: true, message: "Snapshot de vendas carregado." },
      operationalSource: {
        ok: true,
        message: "Metricas operacionais vêm exclusivamente do snapshot TikTok Shop/Partner Center.",
      },
    };
    if (allCarteiraHandles.size > 0) try {
      for (const batch of chunk([...allCarteiraHandles], 20)) {
        let cursor;
        do {
          const res = await queryNotionDatabase(CREATORS_DB, {
            start_cursor: cursor,
            page_size: 100,
            filter: handleFilter(batch),
          });
          allPages.push(...res.results);
          cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
        } while (cursor);
      }
    } catch (e) {
      sourceStatus.notion = { ok: false, message: `Notion indisponivel: ${e.message}` };
      console.warn("[central] Notion indisponivel; cadastro auxiliar ficara limitado:", e.message);
    }

    const creatorsByHandle = {};
    for (const page of allPages) {
      const p = page.properties;
      const handle = cleanHandle(p["Qual seu @ do TikTok?"]?.rich_text?.[0]?.plain_text);
      if (!handle) continue;
      creatorsByHandle[handle] = {
        id: page.id,
        notionUrl: page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`,
        nome:
          p["Nome Completo"]?.rich_text?.[0]?.plain_text ??
          p["Nome"]?.title?.[0]?.plain_text ??
          p["Qual "]?.title?.[0]?.plain_text ??
          handle,
        handle,
        categoria: p["Categoria Amplify Club"]?.select?.name ?? "Start",
        nicho:
          p["Nicho"]?.select?.name ??
          p["Nicho"]?.multi_select?.[0]?.name ??
          p["Categoria"]?.select?.name ??
          "A definir",
      };
    }

    let salesSnapshot;
    let previousSalesSnapshot;
    try {
      salesSnapshot = aggregateTikTokSnapshots({ from: fromDate, to: toDate, handles: allCarteiraHandles });
      previousSalesSnapshot = aggregateTikTokSnapshots({
        from: previousFrom,
        to: previousTo,
        handles: allCarteiraHandles,
      });
    } catch (e) {
      sourceStatus.sales = { ok: false, message: `Snapshot TikTok Shop/GMV indisponivel: ${e.message}` };
      console.error("[central] erro GMV:", e.message);
      salesSnapshot = aggregateTikTokSnapshots({ handles: allCarteiraHandles });
      previousSalesSnapshot = { byHandle: {}, coverage: null };
    }

    // 4) agrega por AM
    const ranking = RACE_PARTICIPANTS.map((am) => {
      const handles = carteirasPorAm[am.slug] || [];
      const detalhes = handles.map((h) => {
        const liveCreator = creatorsByHandle[h];
        const c = liveCreator || {
          id: `partner-center-${h}`,
          nome: h,
          handle: h,
          categoria: "Sem cadastro",
          nicho: "A definir",
          notionUrl: null,
        };
        const s = salesSnapshot.byHandle[h] || { gmv: 0, comissao: 0 };
        const previousSale = previousSalesSnapshot.byHandle?.[h] || {};
        const gmv = s.gmv || 0;
        const comissao = s.comissao || 0;
        return {
          ...c,
          id: c.id || `partner-center-${h}`,
          nicho: c.nicho || "A definir",
          notionUrl: c.notionUrl || null,
          insight: insightFromSales(gmv, previousSale.gmv || 0),
          source: creatorsByHandle[h] ? "partner_center_with_notion_profile" : "partner_center_only",
          sourceLabel: creatorsByHandle[h]
            ? "Metricas do Partner Center + cadastro Notion"
            : "Metricas do Partner Center; cadastro Notion ausente",
          gmv,
          previousGmv: previousSale.gmv || 0,
          comissao,
          orders: s.orders || 0,
          liveGmv: s.liveGmv || 0,
          videoGmv: s.videoGmv || 0,
          directGmv: s.directGmv || 0,
          amplifyRevenue: comissao * 0.1,
        };
      }).sort((a, b) => b.gmv - a.gmv);

      const gmvTotal = detalhes.reduce((acc, c) => acc + c.gmv, 0);
      const previousGmvTotal = detalhes.reduce((acc, c) => acc + (c.previousGmv || 0), 0);
      const comTotal = detalhes.reduce((acc, c) => acc + c.comissao, 0);
      const recTotal = detalhes.reduce((acc, c) => acc + c.amplifyRevenue, 0);
      const ativos = detalhes.filter((c) => c.gmv > 0).length;

      return {
        am: publicAmData(am),
        gmvTotal,
        previousGmvTotal,
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

    // Calcula "pista" contra a propria base do mes anterior.
    const maxGmv = Math.max(...ranking.map((r) => r.gmvTotal), 1);
    const track = ranking.map((r) => ({
      am: r.am,
      position: r.position,
      gmvTotal: r.gmvTotal,
      previousGmvTotal: r.previousGmvTotal,
      progressVsPreviousPct:
        r.previousGmvTotal > 0 ? (r.gmvTotal / r.previousGmvTotal) * 100 : 0,
      comissaoTotal: r.comissaoTotal,
      receitaTotal: r.receitaTotal,
      carteiraSize: r.carteiraSize,
      ativos: r.ativos,
      // posição visual limitada a 92%; acima de 100% vira badge, nao estoura a regua.
      trackPositionPct: clampTrackPct(
        r.previousGmvTotal > 0 ? (r.gmvTotal / r.previousGmvTotal) * 100 : 0,
      ),
      // distancia do líder (em R$)
      gapFromLeader: Math.max(0, ranking[0].gmvTotal - r.gmvTotal),
      top5: r.top5,
    }));

    const warnings = [
      !sourceStatus.notion.ok ? sourceStatus.notion.message : null,
      !sourceStatus.sales.ok ? sourceStatus.sales.message : null,
      ...(salesSnapshot?.warnings || []),
    ].filter(Boolean);

    return NextResponse.json({
      ranking: track,
      total: ranking.length,
      maxGmv,
      sourceStatus,
      warnings,
      dataFreshness: {
        strategy: "daily_tiktok_shop_snapshot",
        filterMode: "partner_center_snapshot_cache",
        requestedPeriod: salesSnapshot.requested,
        effectiveCoverage: salesSnapshot.coverage,
        previousCoverage: previousSalesSnapshot.coverage,
        availablePeriods: salesSnapshot.availablePeriods,
        message:
          "GMV e comissao vêm dos JSONs coletados no TikTok Shop Partner Center. Notion e apenas cadastro auxiliar; vencimento de contrato nao e exibido porque o snapshot Partner Center atual nao traz esse campo.",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[central]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
