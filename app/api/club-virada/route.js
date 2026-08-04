export const dynamic = "force-dynamic";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRetencaoCanonicalPeriod } from "@/lib/retencao-canonical-data";
import { aggregateTikTokSnapshots, listTikTokSnapshots } from "@/lib/tiktok-shop-snapshots";

const TIKTOK_DASHBOARD_DATA = path.join(process.cwd(), "data/tiktok-shop-dashboard/current.json");
const CATEGORY_ORDER = ["Start", "Silver", "Gold", "Diamond", "Safira", "Royal"];

const categoryForGmv = (gmv) => {
  const value = Number(gmv || 0);
  if (value >= 1000000) return "Royal";
  if (value >= 500000) return "Safira";
  if (value >= 100000) return "Diamond";
  if (value >= 30000) return "Gold";
  if (value >= 5000) return "Silver";
  return "Start";
};

const compactSelector = () => {
  const snapshots = listTikTokSnapshots();
  return {
    mode: "server_side_cumulative_creator_snapshots",
    granularity: "daily",
    status: snapshots.length ? "OK" : "DEGRADED",
    range_rule: "GMV por dia e periodos personalizados usam ledger diario validado quando disponivel; snapshot acumulado fica como fallback mensal.",
    available_dates: snapshots.map((snapshot) => snapshot.endInclusive),
    snapshot_count: snapshots.length,
    snapshots_lazy: true,
    snapshots: [],
  };
};

const adjustmentInsight = (adjustments = {}) => {
  const negativeCells = Number(adjustments.negative_cells || 0);
  if (!negativeCells) {
    return {
      status: "OK",
      title: "Sem ajuste negativo relevante no periodo.",
      explanation: "Os cortes acumulados do Partner Center nao trouxeram reducoes entre snapshots para o intervalo selecionado.",
    };
  }
  return {
    status: "WARN",
    title: `${negativeCells} ajuste(s) negativo(s) detectado(s) no periodo.`,
    explanation: "Isso normalmente vem de cancelamento, devolucao ou reprocessamento do Partner Center. O dashboard usa a diferenca entre snapshots acumulados, entao o numero oficial do periodo ja considera esse recalculo.",
  };
};

const summarizeCreators = (creators) => {
  const sorted = creators
    .sort((a, b) => b.gmv - a.gmv)
    .map((creator, index) => ({ ...creator, rank: index + 1, gmv_rank: index + 1 }));
  const totals = sorted.reduce((acc, creator) => {
    acc.latest_gmv += creator.gmv;
    acc.latest_commission += creator.commission_estimated;
    acc.latest_amplify_commission += creator.amplify_commission;
    acc.latest_orders += creator.orders;
    acc.live_gmv += creator.live_gmv;
    acc.video_gmv += creator.video_gmv;
    acc.direct_gmv += creator.direct_gmv;
    if (creator.gmv > 0) acc.latest_partners_with_sales += 1;
    return acc;
  }, {
    latest_gmv: 0,
    latest_commission: 0,
    latest_amplify_commission: 0,
    latest_orders: 0,
    live_gmv: 0,
    video_gmv: 0,
    direct_gmv: 0,
    latest_partners_with_sales: 0,
  });
  totals.latest_creators = sorted.length;
  totals.latest_average_commission_rate = totals.latest_gmv > 0 ? totals.latest_commission / totals.latest_gmv : 0;

  const categories = CATEGORY_ORDER.map((name) => {
    const rows = sorted.filter((creator) => creator.category === name);
    const gmv = rows.reduce((sum, creator) => sum + creator.gmv, 0);
    const commission = rows.reduce((sum, creator) => sum + creator.commission_estimated, 0);
    const orders = rows.reduce((sum, creator) => sum + creator.orders, 0);
    const top5Gmv = rows.slice(0, 5).reduce((sum, creator) => sum + creator.gmv, 0);
    return {
      name,
      creator_count: rows.length,
      active_count: rows.filter((creator) => creator.gmv > 0).length,
      gmv,
      commission_estimated: commission,
      amplify_commission: commission * 0.1,
      orders,
      avg_commission_rate: gmv > 0 ? commission / gmv : 0,
      share: totals.latest_gmv > 0 ? gmv / totals.latest_gmv : 0,
      top5_share: gmv > 0 ? top5Gmv / gmv : 0,
    };
  });

  return { creators: sorted, totals, categories };
};

const periodData = (data, from, to) => {
  const aggregate = getRetencaoCanonicalPeriod({ from, to });
  const latestByHandle = new Map(
    (data.creator_list || data.top_creators || []).map((creator) => [
      String(creator.handle || creator.creator_name || "").replace(/^@/, "").toLowerCase(),
      creator,
    ]),
  );
  const creators = Object.entries(aggregate.byHandle || {}).map(([handle, metrics], index) => {
    const latest = latestByHandle.get(handle) || {};
    const gmv = Number(metrics.gmv || 0);
    const commission = Number(metrics.comissao || 0);
    const commissionBase = Number(metrics.commissionBase || gmv || 0);
    return {
      creator_id: latest.creator_id || handle,
      creator_name: latest.creator_name || handle,
      handle,
      gmv,
      commission_estimated: commission,
      amplify_commission: commission * 0.1,
      orders: Number(metrics.orders || 0),
      live_gmv: Number(metrics.liveGmv || 0),
      video_gmv: Number(metrics.videoGmv || 0),
      direct_gmv: Number(metrics.directGmv || 0),
      avg_commission_rate: commissionBase > 0 ? commission / commissionBase : 0,
      notion_url: latest.notion_url || "",
      category: categoryForGmv(gmv),
      rank: index + 1,
    };
  }).filter((creator) => (
    creator.gmv !== 0 ||
    creator.commission_estimated !== 0 ||
    creator.orders !== 0 ||
    creator.live_gmv !== 0 ||
    creator.video_gmv !== 0 ||
    creator.direct_gmv !== 0
  ));
  const summary = summarizeCreators(creators);
  const coverage = aggregate.coverage || {};
  return {
    ...data,
    totals: { ...data.totals, ...summary.totals },
    categories: summary.categories,
    creator_list: summary.creators,
    top_creators: summary.creators.slice(0, 15),
    period_selector: compactSelector(),
    period_view: {
      requested: aggregate.requested,
      effective: { from: coverage.from, to: coverage.to },
      exact: coverage.mode === "exact_or_contained" || coverage.mode === "daily_ledger_exact",
      warning: (aggregate.warnings || [])[0] || "",
      snapshots_used: (coverage.snapshots || []).length,
      source_strategy: aggregate.source?.strategy || null,
    },
    data_quality: {
      adjustments: aggregate.adjustments || {},
      adjustment_insight: adjustmentInsight(aggregate.adjustments),
    },
  };
};

export async function GET(request) {
  try {
    const data = JSON.parse(await readFile(TIKTOK_DASHBOARD_DATA, "utf8"));
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from || to) {
      return Response.json(periodData(data, from, to));
    }
    if (url.searchParams.get("periodSelector") === "1") {
      return Response.json(compactSelector());
    }
    if (data.period_selector?.snapshots) {
      data.period_selector = {
        ...data.period_selector,
        snapshots: [],
        snapshots_lazy: true,
      };
    }
    const referenceFrom = data.reference?.period_start;
    const referenceTo = data.reference?.period_end;
    if (referenceFrom && referenceTo) {
      const aggregate = aggregateTikTokSnapshots({ from: referenceFrom, to: referenceTo });
      data.data_quality = {
        adjustments: aggregate.adjustments || {},
        adjustment_insight: adjustmentInsight(aggregate.adjustments),
      };
    }
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error?.message || "Erro ao carregar dashboard TikTok Shop." },
      { status: 500 }
    );
  }
}
