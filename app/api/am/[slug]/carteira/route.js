import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { queryNotionDatabase } from "@/lib/notion-query";
import { aggregateTikTokSnapshots, cleanHandle, defaultSnapshotPeriod } from "@/lib/tiktok-shop-snapshots";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";

const insightFromSales = (currentGmv, previousGmv) => {
  if (!previousGmv) return "Sem base anterior no snapshot Partner Center.";
  const delta = currentGmv - previousGmv;
  const pct = (delta / previousGmv) * 100;
  if (pct >= 12) return `GMV subindo ${pct.toFixed(1)}% vs. periodo anterior.`;
  if (pct <= -8) return `GMV caindo ${Math.abs(pct).toFixed(1)}% vs. periodo anterior.`;
  return `GMV estavel (${pct.toFixed(1)}% vs. periodo anterior).`;
};

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

async function fetchAllCreators(handles = []) {
  const out = [];
  const batches = handles.length > 0 ? chunk(handles, 20) : [[]];
  for (const batch of batches) {
    let cursor;
    do {
      const res = await queryNotionDatabase(CREATORS_DB, {
        start_cursor: cursor,
        page_size: 100,
        filter: batch.length > 0 ? handleFilter(batch) : undefined,
      });
      out.push(...res.results);
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);
  }

  return out.map((page) => {
    const p = page.properties;
    const nome =
      p["Nome Completo"]?.rich_text?.[0]?.plain_text ??
      p["Nome"]?.title?.[0]?.plain_text ??
      p["Qual "]?.title?.[0]?.plain_text ??
      "";
    const handle = cleanHandle(p["Qual seu @ do TikTok?"]?.rich_text?.[0]?.plain_text);
    const categoria = p["Categoria Amplify Club"]?.select?.name ?? "Start";
    const nicho =
      p["Nicho"]?.select?.name ??
      p["Nicho"]?.multi_select?.[0]?.name ??
      p["Categoria"]?.select?.name ??
      "A definir";
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
      notionUrl: page.url || `https://www.notion.so/${page.id.replace(/-/g, "")}`,
      nome,
      handle,
      categoria,
      nicho,
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
    const handleSet = new Set(handlesDaCarteira.map(cleanHandle));
    if (handleSet.size === 0) {
      return NextResponse.json({
        am: publicAmData(target),
        creators: [],
        summary: { total: 0, ativos: 0, gmvTotal: 0, comissaoTotal: 0, receitaTotal: 0, byCategoria: {} },
        updatedAt: new Date().toISOString(),
        warning: "Carteira vazia — preencha lib/carteiras.js ou rode scripts/sync-carteiras.js",
      });
    }

    const url = new URL(req.url);
    const defaultPeriod = defaultSnapshotPeriod();
    const fromDate = url.searchParams.get("from") || defaultPeriod.from;
    const toDate = url.searchParams.get("to") || defaultPeriod.to;

    let allCreators = [];
    const sourceStatus = {
      notion: { ok: true, message: "Notion carregado." },
      sales: { ok: true, message: "Snapshot de vendas carregado." },
      operationalSource: {
        ok: true,
        message: "Metricas operacionais vêm exclusivamente do snapshot TikTok Shop/Partner Center.",
      },
    };
    try {
      allCreators = await fetchAllCreators([...handleSet]);
    } catch (e) {
      sourceStatus.notion = { ok: false, message: `Notion indisponivel: ${e.message}` };
      console.warn("[carteira] Notion indisponivel; cadastro auxiliar ficara limitado:", e.message);
    }
    const notionCarteira = Object.values(
      allCreators
        .filter((c) => handleSet.has(c.handle))
        .reduce((acc, creator) => {
          acc[creator.handle] = creator;
          return acc;
        }, {}),
    );
    const creatorsByHandle = Object.fromEntries(notionCarteira.map((c) => [c.handle, c]));
    const carteira = [...handleSet].map((handle) => creatorsByHandle[handle] || {
      id: `partner-center-${handle}`,
      nome: handle,
      handle,
      categoria: "Sem cadastro",
      nicho: "A definir",
      notionUrl: null,
      whatsapp: null,
      email: null,
      fase: null,
    });

    let salesSnapshot;
    try {
      salesSnapshot = aggregateTikTokSnapshots({ from: fromDate, to: toDate, handles: handleSet });
    } catch (e) {
      sourceStatus.sales = { ok: false, message: `Snapshot TikTok Shop/GMV indisponivel: ${e.message}` };
      console.error("[carteira] erro GMV:", e.message);
      salesSnapshot = aggregateTikTokSnapshots({ handles: handleSet });
    }

    const enriched = carteira.map((c) => {
      const sale = salesSnapshot.byHandle[c.handle] || {};
      const gmv = sale.gmv || 0;
      const comissao = sale.comissao || 0;
      const commissionRate = gmv > 0 ? (comissao / gmv) * 100 : 0;
      return {
        ...c,
        id: c.id || `partner-center-${c.handle}`,
        categoria: c.categoria || "Sem cadastro",
        nicho: c.nicho || "A definir",
        notionUrl: c.notionUrl || null,
        source: c.notionUrl ? "partner_center_with_notion_profile" : "partner_center_only",
        sourceLabel: c.notionUrl
          ? "Metricas do Partner Center + cadastro Notion"
          : "Metricas do Partner Center; cadastro Notion ausente",
        gmv,
        comissao,
        commissionRate,
        orders: sale.orders || 0,
        liveGmv: sale.liveGmv || 0,
        videoGmv: sale.videoGmv || 0,
        directGmv: sale.directGmv || 0,
        commissionBase: sale.commissionBase || 0,
        amplifyRevenue: comissao * 0.1,
        insight: insightFromSales(gmv, c.previousGmv || 0),
        previousGmv: c.previousGmv || 0,
        lastUpdate: sale.lastUpdate || null,
      };
    }).sort((a, b) => b.gmv - a.gmv);

    const summary = {
      total: enriched.length,
      ativos: enriched.filter((c) => c.gmv > 0).length,
      gmvTotal: enriched.reduce((s, c) => s + c.gmv, 0),
      comissaoTotal: enriched.reduce((s, c) => s + c.comissao, 0),
      receitaTotal: enriched.reduce((s, c) => s + c.amplifyRevenue, 0),
      comissaoMediaCreator:
        enriched.length > 0
          ? enriched.reduce((s, c) => s + c.commissionRate, 0) / enriched.length
          : 0,
      byCategoria: enriched.reduce((acc, c) => {
        acc[c.categoria] = (acc[c.categoria] || 0) + 1;
        return acc;
      }, {}),
    };

    const warnings = [
      !sourceStatus.notion.ok ? sourceStatus.notion.message : null,
      !sourceStatus.sales.ok ? sourceStatus.sales.message : null,
      ...(salesSnapshot?.warnings || []),
    ].filter(Boolean);

    return NextResponse.json({
      am: publicAmData(target),
      creators: enriched,
      summary,
      sourceStatus,
      warnings,
      dataFreshness: {
        strategy: "daily_tiktok_shop_snapshot",
        filterMode: "partner_center_snapshot_cache",
        requestedPeriod: salesSnapshot.requested,
        effectiveCoverage: salesSnapshot.coverage,
        availablePeriods: salesSnapshot.availablePeriods,
        message:
          "GMV e comissao vêm dos JSONs coletados no TikTok Shop Partner Center. Notion e apenas cadastro auxiliar; vencimento de contrato nao e exibido porque o snapshot Partner Center atual nao traz esse campo.",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[carteira]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
