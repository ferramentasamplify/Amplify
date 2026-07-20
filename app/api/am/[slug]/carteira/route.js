import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { demoCreatorsForHandles, demoInsight } from "@/lib/am-demo-data";
import { queryNotionDatabase } from "@/lib/notion-query";
import { aggregateTikTokSnapshots, cleanHandle, defaultSnapshotPeriod } from "@/lib/tiktok-shop-snapshots";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";

const daysUntil = (dateString) => {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
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
    const contractEnd =
      p["Data de Expiração"]?.date?.start ??
      p["Fim do contrato"]?.date?.start ??
      p["Contrato vence em"]?.date?.start ??
      null;
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
      contractEnd,
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
      demo: { used: false, message: "" },
    };
    try {
      allCreators = await fetchAllCreators([...handleSet]);
    } catch (e) {
      sourceStatus.notion = { ok: false, message: `Notion indisponivel: ${e.message}` };
      sourceStatus.demo.used = true;
      console.warn("[carteira] Notion indisponivel; dados faltantes serao marcados como demo:", e.message);
    }
    const notionCarteira = Object.values(
      allCreators
        .filter((c) => handleSet.has(c.handle))
        .reduce((acc, creator) => {
          acc[creator.handle] = creator;
          return acc;
        }, {}),
    );
    const foundHandles = new Set(notionCarteira.map((c) => c.handle));
    const demoCarteira = demoCreatorsForHandles(handlesDaCarteira).filter((c) => !foundHandles.has(c.handle));
    const demoByHandle = Object.fromEntries(demoCreatorsForHandles(handlesDaCarteira).map((c) => [c.handle, c]));
    if (demoCarteira.length > 0) sourceStatus.demo.used = true;
    const carteira = [...notionCarteira, ...demoCarteira];

    let salesSnapshot;
    try {
      salesSnapshot = aggregateTikTokSnapshots({ from: fromDate, to: toDate, handles: handleSet });
      if (salesSnapshot.warnings.length > 0) sourceStatus.demo.used = true;
    } catch (e) {
      sourceStatus.sales = { ok: false, message: `Snapshot TikTok Shop/GMV indisponivel: ${e.message}` };
      sourceStatus.demo.used = true;
      console.error("[carteira] erro GMV:", e.message);
      salesSnapshot = aggregateTikTokSnapshots({ handles: handleSet });
    }

    const enriched = carteira.map((c) => {
      const sale = salesSnapshot.byHandle[c.handle] || {};
      const demo = demoByHandle[c.handle] || {};
      const gmv = sale.gmv || c.currentGmv || 0;
      const comissao = sale.comissao || c.comissao || 0;
      const commissionRate = gmv > 0 ? (comissao / gmv) * 100 : 0;
      const isLiveCreator = c.source !== "demo" && !String(c.id || "").startsWith("demo-");
      const contractEnd = isLiveCreator ? c.contractEnd || null : null;
      return {
        ...c,
        id: c.id || `demo-${c.handle}`,
        categoria: c.categoria || demo.categoria || "Start",
        nicho: c.nicho === "A definir" ? demo.nicho || c.nicho : c.nicho || demo.nicho || "A definir",
        contractEnd,
        notionUrl: c.notionUrl || null,
        source: c.source || "live",
        sourceLabel: c.sourceLabel || "Notion",
        gmv,
        comissao,
        commissionRate,
        orders: sale.orders || 0,
        liveGmv: sale.liveGmv || 0,
        videoGmv: sale.videoGmv || 0,
        directGmv: sale.directGmv || 0,
        commissionBase: sale.commissionBase || 0,
        amplifyRevenue: comissao * 0.1,
        insight: c.insight || demoInsight(c),
        previousGmv: c.previousGmv || 0,
        contractDaysRemaining: daysUntil(contractEnd),
        lastUpdate: sale.lastUpdate || null,
      };
    }).sort((a, b) => b.gmv - a.gmv);

    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const contratosVencendo = enriched
      .filter((c) => c.contractEnd && c.contractEnd >= today && c.contractEnd <= in30)
      .sort((a, b) => (a.contractDaysRemaining ?? 999) - (b.contractDaysRemaining ?? 999));

    const summary = {
      total: enriched.length,
      ativos: enriched.filter((c) => c.gmv > 0).length,
      gmvTotal: enriched.reduce((s, c) => s + c.gmv, 0),
      comissaoTotal: enriched.reduce((s, c) => s + c.comissao, 0),
      receitaTotal: enriched.reduce((s, c) => s + c.amplifyRevenue, 0),
      contratosVencendo: contratosVencendo.length,
      contratosVencendoLista: contratosVencendo.map((c) => ({
        id: c.id,
        nome: c.nome,
        handle: c.handle,
        contractEnd: c.contractEnd,
        daysRemaining: c.contractDaysRemaining,
        notionUrl: c.notionUrl || null,
      })),
      comissaoMediaCreator:
        enriched.length > 0
          ? enriched.reduce((s, c) => s + c.commissionRate, 0) / enriched.length
          : 0,
      byCategoria: enriched.reduce((acc, c) => {
        acc[c.categoria] = (acc[c.categoria] || 0) + 1;
        return acc;
      }, {}),
    };

    sourceStatus.demo.message = sourceStatus.demo.used
      ? "Parte dos dados exibidos esta rotulada como demonstrativa porque Notion ou snapshot TikTok Shop nao retornou fonte real."
      : "Sem uso de dados demonstrativos.";
    const warnings = [
      !sourceStatus.notion.ok ? sourceStatus.notion.message : null,
      !sourceStatus.sales.ok ? sourceStatus.sales.message : null,
      ...(salesSnapshot?.warnings || []),
      sourceStatus.demo.used ? sourceStatus.demo.message : null,
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
          "GMV e comissao vêm dos JSONs coletados no TikTok Shop Partner Center. A seleção usa snapshots já coletados; se não existir snapshot exato, a API informa a cobertura efetiva.",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[carteira]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
