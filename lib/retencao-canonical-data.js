import {
  aggregateTikTokDailyLedger,
  aggregateTikTokSnapshots,
  buildTikTokDailyGmvTimeline,
  cleanHandle,
  defaultSnapshotPeriod,
} from "@/lib/tiktok-shop-snapshots";

const AMPLIFY_COMMISSION_RATE = 0.10;

export { cleanHandle, defaultSnapshotPeriod };

const startsAtMonthBoundary = (from) => !from || from.endsWith("-01");

export function getRetencaoCanonicalPeriod({ from, to, handles } = {}) {
  const dailyLedger = aggregateTikTokDailyLedger({ from, to, handles });
  const useDailyLedger = dailyLedger.coverage?.mode === "daily_ledger_exact";
  const useCumulativeSnapshot = !useDailyLedger && startsAtMonthBoundary(from);
  const snapshot = useDailyLedger
    ? dailyLedger
    : useCumulativeSnapshot
      ? aggregateTikTokSnapshots({ from, to, handles })
      : dailyLedger;
  const creators = Object.entries(snapshot.byHandle || {})
    .map(([handle, metrics]) => {
      const gmv = Number(metrics.gmv || 0);
      const commission = Number(metrics.comissao || 0);
      return {
        creator_handle: cleanHandle(handle),
        gmv,
        commission_estimated: commission,
        amplify_commission: commission * AMPLIFY_COMMISSION_RATE,
        orders: Number(metrics.orders || 0),
        live_gmv: Number(metrics.liveGmv || 0),
        video_gmv: Number(metrics.videoGmv || 0),
        direct_gmv: Number(metrics.directGmv || 0),
        commission_base: Number(metrics.commissionBase || 0),
        last_update: metrics.lastUpdate || snapshot.coverage?.to || null,
        snapshots: metrics.snapshots || [],
      };
    })
    .sort((a, b) => b.gmv - a.gmv);

  const totals = creators.reduce(
    (acc, creator) => {
      acc.gmv += creator.gmv;
      acc.commission_estimated += creator.commission_estimated;
      acc.amplify_commission += creator.amplify_commission;
      acc.orders += creator.orders;
      acc.live_gmv += creator.live_gmv;
      acc.video_gmv += creator.video_gmv;
      acc.direct_gmv += creator.direct_gmv;
      acc.creators += 1;
      if (creator.gmv > 0) acc.creators_with_sales += 1;
      return acc;
    },
    {
      gmv: 0,
      commission_estimated: 0,
      amplify_commission: 0,
      orders: 0,
      live_gmv: 0,
      video_gmv: 0,
      direct_gmv: 0,
      creators: 0,
      creators_with_sales: 0,
    },
  );
  totals.average_commission_rate = totals.gmv ? totals.commission_estimated / totals.gmv : 0;
  totals.amplify_commission_rate = AMPLIFY_COMMISSION_RATE;

  return {
    kind: "retencao_tiktok_canonical_period",
    status: "OK",
    source: {
      primary: "TikTok Shop Partner Center",
      strategy: useDailyLedger
        ? "server_side_daily_creator_ledger"
        : "server_side_cumulative_creator_snapshots",
      rule: useDailyLedger
        ? "Periodos com ledger diario completo usam soma de dias fechados confiaveis do Partner Center. Snapshot acumulado fica como fallback mensal quando falta cobertura diaria."
        : "Snapshot acumulado oficial do Partner Center usado como fallback mensal porque o ledger diario nao cobre todo o periodo. Notion/contratos entram como dimensoes auxiliares, nao substituem dinheiro oficial.",
    },
    requested: snapshot.requested,
    coverage: snapshot.coverage,
    warnings: [...new Set([...(snapshot.warnings || []), ...(!useDailyLedger ? dailyLedger.warnings || [] : [])])],
    data_quality: {
      adjustments: snapshot.adjustments || {},
    },
    availablePeriods: snapshot.availablePeriods || [],
    byHandle: snapshot.byHandle || {},
    creators,
    totals,
  };
}

export function getRetencaoCanonicalGmvTimeline({ from, to, handles } = {}) {
  return buildTikTokDailyGmvTimeline({ from, to, handles });
}
