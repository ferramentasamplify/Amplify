import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS } from "@/lib/carteiras";
import { queryNotionDatabase } from "@/lib/notion-query";
import {
  cleanHandle,
  defaultSnapshotPeriod,
  getRetencaoCanonicalGmvTimeline,
  getRetencaoCanonicalPeriod,
} from "@/lib/retencao-canonical-data";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";
const TARGET_MULTIPLIER = 1.5;
const AUGUST_GOAL_FROM = "2026-08-01";
const AUGUST_GOAL_TO = "2026-08-31";
const AUGUST_TARGETS = {
  camila: 3562000,
  leonardo: 4177187,
};

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
const addDaysISO = (dateString, days) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonthsISO = (dateString, months) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const minISO = (...dates) => dates.filter(Boolean).sort()[0] || "";

function buildCarteiraTimeline({ from, to, handles, creatorsByHandle }) {
  const timeline = getRetencaoCanonicalGmvTimeline({ from, to, handles });

  return {
    mode: timeline.mode,
    label: timeline.label,
    creatorOptions: [...handles].map((handle) => ({
      handle,
      nome: creatorsByHandle[handle]?.nome || handle,
    })),
    points: timeline.points,
    warnings: timeline.warnings || [],
  };
}

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
    const previousFrom = addMonthsISO(fromDate, -1);
    const previousTo = addMonthsISO(toDate, -1);

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
    let previousSalesSnapshot;
    let augustSalesSnapshot = { byHandle: {}, coverage: null };
    try {
      salesSnapshot = getRetencaoCanonicalPeriod({ from: fromDate, to: toDate, handles: handleSet });
      previousSalesSnapshot = getRetencaoCanonicalPeriod({
        from: previousFrom,
        to: previousTo,
        handles: handleSet,
      });
      if (todayISO() >= AUGUST_GOAL_FROM) {
        augustSalesSnapshot = getRetencaoCanonicalPeriod({
          from: AUGUST_GOAL_FROM,
          to: minISO(todayISO(), defaultPeriod.to, AUGUST_GOAL_TO),
          handles: handleSet,
        });
      }
    } catch (e) {
      sourceStatus.sales = { ok: false, message: `Snapshot TikTok Shop/GMV indisponivel: ${e.message}` };
      console.error("[carteira] erro GMV:", e.message);
      salesSnapshot = getRetencaoCanonicalPeriod({ handles: handleSet });
      previousSalesSnapshot = { byHandle: {}, coverage: null };
    }

    const enriched = carteira.map((c) => {
      const sale = salesSnapshot.byHandle[c.handle] || {};
      const previousSale = previousSalesSnapshot.byHandle?.[c.handle] || {};
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
        insight: insightFromSales(gmv, previousSale.gmv || 0),
        previousGmv: previousSale.gmv || 0,
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
    const previousGmvTotal = enriched.reduce((s, c) => s + (c.previousGmv || 0), 0);
    const targetGmv = previousGmvTotal * TARGET_MULTIPLIER;
    const targetProgressPct = targetGmv > 0 ? (summary.gmvTotal / targetGmv) * 100 : 0;
    const augustTargetGmv = AUGUST_TARGETS[target.slug] || targetGmv;
    const augustRealizedGmv = todayISO() < AUGUST_GOAL_FROM
      ? 0
      : [...handleSet].reduce((sum, handle) => sum + Number(augustSalesSnapshot.byHandle?.[handle]?.gmv || 0), 0);
    const augustProgressPct = augustTargetGmv > 0 ? (augustRealizedGmv / augustTargetGmv) * 100 : 0;
    const goals = {
      period: {
        label: "Meta do período",
        rule: `150% do GMV do periodo anterior (${previousFrom} a ${previousTo})`,
        period: { from: fromDate, to: toDate },
        previousPeriod: { from: previousFrom, to: previousTo },
        previousGmv: previousGmvTotal,
        targetGmv,
        realizedGmv: summary.gmvTotal,
        progressPct: targetProgressPct,
        gap: Math.max(0, targetGmv - summary.gmvTotal),
        status: targetGmv <= 0 ? "Sem base anterior" : targetProgressPct >= 100 ? "Meta batida" : "Em progresso",
      },
      august: {
        label: "Meta Agosto",
        period: { from: AUGUST_GOAL_FROM, to: AUGUST_GOAL_TO },
        targetGmv: augustTargetGmv,
        realizedGmv: augustRealizedGmv,
        progressPct: todayISO() < AUGUST_GOAL_FROM ? 0 : augustProgressPct,
        gap: Math.max(0, augustTargetGmv - augustRealizedGmv),
        status: todayISO() < AUGUST_GOAL_FROM ? "Não iniciada" : augustProgressPct >= 100 ? "Meta batida" : "Em progresso",
        configured: Boolean(AUGUST_TARGETS[target.slug]),
      },
    };

    const timeline = buildCarteiraTimeline({
      from: salesSnapshot.coverage?.from || fromDate,
      to: salesSnapshot.coverage?.to || toDate,
      handles: handleSet,
      creatorsByHandle,
    });

    const warnings = [
      !sourceStatus.notion.ok ? sourceStatus.notion.message : null,
      !sourceStatus.sales.ok ? sourceStatus.sales.message : null,
      ...(salesSnapshot?.warnings || []),
      ...(timeline?.warnings || []),
    ].filter(Boolean);

    return NextResponse.json({
      am: publicAmData(target),
      creators: enriched,
      summary,
      goals,
      timeline,
      sourceStatus,
      warnings,
      dataFreshness: {
        strategy: "daily_tiktok_shop_ledger",
        filterMode: "partner_center_snapshot_cache",
        canonicalLayer: "retencao-canonical-data",
        canonicalDatabase: "retencao_tiktok_canonical.sqlite",
        requestedPeriod: salesSnapshot.requested,
        effectiveCoverage: salesSnapshot.coverage,
        previousCoverage: previousSalesSnapshot.coverage,
        availablePeriods: salesSnapshot.availablePeriods,
        dataQuality: salesSnapshot.data_quality || {},
        message:
          "GMV, pedidos e comissao vêm da camada canonica Retencao/TikTok Shop baseada no Partner Center. Notion e apenas cadastro auxiliar; vencimento de contrato entra como dimensao anexa quando a base de contratos for conectada.",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[carteira]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
