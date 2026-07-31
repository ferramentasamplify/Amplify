import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { RACE_PARTICIPANTS, publicAmData } from "@/lib/am-config";
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

const clampTrackPct = (progressPct) => Math.max(8, Math.min(92, (progressPct / 100) * 92));
const TARGET_MULTIPLIER = 1.5;
const HEALTH_RULES = {
  redNoActivityDays: 7,
  orangeNoActivityDays: 4,
  redGmvDropPct: -45,
  orangeGmvDropPct: -20,
  blueGmvRisePct: 18,
};
const AUGUST_GOAL_FROM = "2026-08-01";
const AUGUST_GOAL_TO = "2026-08-31";
const AUGUST_TARGETS = {
  camila: 3562000,
  leonardo: 4177187,
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
const addMonthsISO = (dateString, months) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const addDaysISO = (dateString, days) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const minISO = (...dates) => dates.filter(Boolean).sort()[0] || "";
const insightFromSales = (currentGmv, previousGmv) => {
  if (!previousGmv) return "Sem base anterior no snapshot Partner Center.";
  const delta = currentGmv - previousGmv;
  const pct = (delta / previousGmv) * 100;
  if (pct >= 12) return `GMV subindo ${pct.toFixed(1)}% vs. periodo anterior.`;
  if (pct <= -8) return `GMV caindo ${Math.abs(pct).toFixed(1)}% vs. periodo anterior.`;
  return `GMV estavel (${pct.toFixed(1)}% vs. periodo anterior).`;
};

const sum = (items) => items.reduce((acc, value) => acc + Number(value || 0), 0);
const pctDelta = (current, previous) => {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
};
const dailyCreatorValues = (points, handle) => {
  let previous = 0;
  return (points || []).map((point) => {
    const cumulative = Number(point.creators?.[handle] || 0);
    const daily = Math.max(0, cumulative - previous);
    previous = cumulative;
    return { date: point.date, cumulative, daily };
  });
};
const lastActivityDate = (dailyValues) => [...dailyValues].reverse().find((point) => point.daily > 0)?.date || null;
const daysBetweenISO = (from, to) => {
  if (!from || !to) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
};
const buildCreatorHealth = ({ creator, amSlug, currentTimeline, previousTimeline, toDate }) => {
  const currentDaily = dailyCreatorValues(currentTimeline.points, creator.handle);
  const previousDaily = dailyCreatorValues(previousTimeline.points, creator.handle);
  const last7 = sum(currentDaily.slice(-7).map((point) => point.daily));
  const prior7 = sum(currentDaily.slice(-14, -7).map((point) => point.daily));
  const previousComparable = sum(previousDaily.slice(-7).map((point) => point.daily));
  const activityDate = lastActivityDate(currentDaily);
  const daysWithoutActivity = daysBetweenISO(activityDate, toDate);
  const gmvTrendPct = pctDelta(last7, prior7 || previousComparable);
  const postingProxyGmv = Number(creator.liveGmv || 0) + Number(creator.videoGmv || 0);
  const reasons = [];

  let tone = "blue";
  if (daysWithoutActivity !== null && daysWithoutActivity >= HEALTH_RULES.redNoActivityDays) {
    tone = "red";
    reasons.push(`${daysWithoutActivity} dias sem GMV registrado`);
  } else if (gmvTrendPct <= HEALTH_RULES.redGmvDropPct) {
    tone = "red";
    reasons.push(`queda de ${Math.abs(gmvTrendPct).toFixed(0)}% no GMV recente`);
  } else if (daysWithoutActivity !== null && daysWithoutActivity >= HEALTH_RULES.orangeNoActivityDays) {
    tone = "orange";
    reasons.push(`${daysWithoutActivity} dias sem GMV registrado`);
  } else if (gmvTrendPct <= HEALTH_RULES.orangeGmvDropPct) {
    tone = "orange";
    reasons.push(`queda de ${Math.abs(gmvTrendPct).toFixed(0)}% no GMV recente`);
  } else if (gmvTrendPct >= HEALTH_RULES.blueGmvRisePct) {
    reasons.push(`subida de ${gmvTrendPct.toFixed(0)}% no GMV recente`);
  }
  if (postingProxyGmv <= 0) reasons.push("sem GMV de live/vídeo no período");
  if (!activityDate) reasons.push("sem atividade detectada no período");

  return {
    handle: creator.handle,
    nome: creator.nome,
    amSlug,
    tone,
    status: tone === "red" ? "Atenção alta" : tone === "orange" ? "Atenção" : "Saudável",
    reasons: reasons.slice(0, 3),
    gmv: creator.gmv,
    previousGmv: creator.previousGmv,
    gmvTrendPct,
    last7Gmv: last7,
    prior7Gmv: prior7,
    liveGmv: creator.liveGmv,
    videoGmv: creator.videoGmv,
    engagementProxyGmv: postingProxyGmv,
    lastActivityDate: activityDate,
    daysWithoutActivity,
    whatsappActivity: {
      status: "pending_source",
      label: "WhatsApp ainda sem fonte conectada",
    },
  };
};

function buildGmvTimeline({ from, to, carteirasPorAm, creatorsByHandle }) {
  const allHandles = new Set(Object.values(carteirasPorAm).flat());
  const creatorOptions = Object.entries(carteirasPorAm).flatMap(([amSlug, handles]) =>
    handles.map((handle) => ({
      handle,
      amSlug,
      nome: creatorsByHandle[handle]?.nome || handle,
    })),
  );
  const timeline = getRetencaoCanonicalGmvTimeline({ from, to, handles: allHandles });
  const points = timeline.points.map((point) => ({
    ...point,
    am: Object.fromEntries(
      Object.entries(carteirasPorAm).map(([amSlug, handles]) => [
        amSlug,
        handles.reduce((sum, handle) => sum + Number(point.creators?.[handle] || 0), 0),
      ]),
    ),
  }));
  return {
    mode: timeline.mode,
    label: timeline.label,
    points,
    creatorOptions,
    warnings: timeline.warnings || [],
  };
}

function buildGoalTimeline({ ranking, gmvTimeline }) {
  const points = (gmvTimeline.points || []).map((point) => {
    const row = { date: point.date };
    let totalGmv = 0;
    let totalTarget = 0;
    for (const item of ranking) {
      const target = AUGUST_TARGETS[item.am.slug] || item.targetGmv || 0;
      const gmv = Number(point.am?.[item.am.slug] || 0);
      row[`${item.am.slug}Gmv`] = gmv;
      row[`${item.am.slug}Pct`] = target > 0 ? (gmv / target) * 100 : 0;
      totalGmv += gmv;
      totalTarget += target;
    }
    row.totalGmv = totalGmv;
    row.totalPct = totalTarget > 0 ? (totalGmv / totalTarget) * 100 : 0;
    return row;
  });
  const creators = Object.fromEntries(
    ranking.map((item) => [
      item.am.slug,
      (gmvTimeline.points || []).map((point) => {
        const creatorRows = {};
        for (const creator of item.creators || []) {
          creatorRows[creator.handle] = Number(point.creators?.[creator.handle] || 0);
        }
        return { date: point.date, creators: creatorRows };
      }),
    ]),
  );

  return {
    metric: "gmv_and_goal_pct",
    points,
    creators,
    targets: AUGUST_TARGETS,
  };
}

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
    let augustSalesSnapshot = { byHandle: {}, coverage: null };
    try {
      salesSnapshot = getRetencaoCanonicalPeriod({ from: fromDate, to: toDate, handles: allCarteiraHandles });
      previousSalesSnapshot = getRetencaoCanonicalPeriod({
        from: previousFrom,
        to: previousTo,
        handles: allCarteiraHandles,
      });
      if (todayISO() >= AUGUST_GOAL_FROM) {
        augustSalesSnapshot = getRetencaoCanonicalPeriod({
          from: AUGUST_GOAL_FROM,
          to: minISO(todayISO(), defaultPeriod.to, AUGUST_GOAL_TO),
          handles: allCarteiraHandles,
        });
      }
    } catch (e) {
      sourceStatus.sales = { ok: false, message: `Snapshot TikTok Shop/GMV indisponivel: ${e.message}` };
      console.error("[central] erro GMV:", e.message);
      salesSnapshot = getRetencaoCanonicalPeriod({ handles: allCarteiraHandles });
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
        creators: detalhes,
        top5: detalhes.slice(0, 5),
      };
    }).sort((a, b) => b.gmvTotal - a.gmvTotal);

    // Adiciona posição (1º, 2º, 3º)
    ranking.forEach((r, i) => {
      r.position = i + 1;
    });

    // Calcula "pista" contra a propria base do mes anterior.
    const maxGmv = Math.max(...ranking.map((r) => r.gmvTotal), 1);
    const track = ranking.map((r) => {
      const targetGmv = r.previousGmvTotal * TARGET_MULTIPLIER;
      const progressVsPreviousPct = r.previousGmvTotal > 0 ? (r.gmvTotal / r.previousGmvTotal) * 100 : 0;
      const targetProgressPct = targetGmv > 0 ? (r.gmvTotal / targetGmv) * 100 : 0;
      const augustTargetGmv = AUGUST_TARGETS[r.am.slug] || targetGmv;
      const augustGmvTotal = (carteirasPorAm[r.am.slug] || []).reduce(
        (sum, handle) => sum + Number(augustSalesSnapshot.byHandle?.[handle]?.gmv || 0),
        0,
      );
      const augustProgressPct = augustTargetGmv > 0 ? (augustGmvTotal / augustTargetGmv) * 100 : 0;
      return {
        am: r.am,
        position: r.position,
        gmvTotal: r.gmvTotal,
        previousGmvTotal: r.previousGmvTotal,
        targetGmv,
        targetProgressPct,
        targetGap: Math.max(0, targetGmv - r.gmvTotal),
        bonusStatus: targetProgressPct >= 100 ? "Meta batida" : "Em progresso",
        augustGoal: {
          period: { from: AUGUST_GOAL_FROM, to: AUGUST_GOAL_TO },
          realizedGmv: todayISO() < AUGUST_GOAL_FROM ? 0 : augustGmvTotal,
          targetGmv: augustTargetGmv,
          progressPct: todayISO() < AUGUST_GOAL_FROM ? 0 : augustProgressPct,
          gap: Math.max(0, augustTargetGmv - (todayISO() < AUGUST_GOAL_FROM ? 0 : augustGmvTotal)),
          status: todayISO() < AUGUST_GOAL_FROM ? "Não iniciada" : augustProgressPct >= 100 ? "Meta batida" : "Em progresso",
        },
        progressVsPreviousPct,
        comissaoTotal: r.comissaoTotal,
        receitaTotal: r.receitaTotal,
        carteiraSize: r.carteiraSize,
        ativos: r.ativos,
        // posição visual limitada a 92%; acima de 100% vira badge, nao estoura a regua.
        trackPositionPct: clampTrackPct(progressVsPreviousPct),
        // distancia do líder (em R$)
        gapFromLeader: Math.max(0, ranking[0].gmvTotal - r.gmvTotal),
        creators: r.creators,
        top5: r.top5,
      };
    });
    const goals = {
      period: { from: AUGUST_GOAL_FROM, to: AUGUST_GOAL_TO },
      targets: AUGUST_TARGETS,
    };
    const gmvTimeline = buildGmvTimeline({
      from: salesSnapshot.coverage?.from || fromDate,
      to: salesSnapshot.coverage?.to || toDate,
      carteirasPorAm,
      creatorsByHandle,
    });
    const previousGmvTimeline = buildGmvTimeline({
      from: previousSalesSnapshot.coverage?.from || previousFrom,
      to: previousSalesSnapshot.coverage?.to || previousTo,
      carteirasPorAm,
      creatorsByHandle,
    });
    const goalTimeline = buildGoalTimeline({ ranking: track, gmvTimeline });
    const creatorHealth = track
      .flatMap((item) =>
        (item.creators || []).map((creator) =>
          buildCreatorHealth({
            creator,
            amSlug: item.am.slug,
            currentTimeline: gmvTimeline,
            previousTimeline: previousGmvTimeline,
            toDate: salesSnapshot.coverage?.to || toDate,
          }),
        ),
      )
      .sort((a, b) => {
        const toneWeight = { red: 0, orange: 1, blue: 2 };
        return toneWeight[a.tone] - toneWeight[b.tone] || a.gmv - b.gmv;
      });

    const warnings = [
      !sourceStatus.notion.ok ? sourceStatus.notion.message : null,
      !sourceStatus.sales.ok ? sourceStatus.sales.message : null,
      ...(salesSnapshot?.warnings || []),
      ...(gmvTimeline?.warnings || []),
    ].filter(Boolean);

    return NextResponse.json({
      ranking: track,
      goals,
      gmvTimeline,
      goalTimeline,
      creatorHealth,
      healthRules: HEALTH_RULES,
      total: ranking.length,
      maxGmv,
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
    console.error("[central]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
