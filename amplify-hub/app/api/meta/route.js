/**
 * GET /api/meta
 * Busca dados do Meta Ads API para todas as campanhas ativas.
 * Query params:
 *   since  - YYYY-MM-DD (obrigatório)
 *   until  - YYYY-MM-DD (obrigatório)
 *   level  - "campaign" | "adset" | "ad" (default: "ad")
 */

const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const ACCESS_TOKEN  = process.env.META_ACCESS_TOKEN;

const cache = new Map();
const CACHE_TTL = 60_000;

function cacheKey(params) {
  return JSON.stringify(params);
}

async function fetchMeta(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  url.searchParams.set("access_token", ACCESS_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Meta API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getInsights(level, since, until) {
  const key = cacheKey({ level, since, until });
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const fields = [
    "campaign_name",
    "adset_name",
    "ad_name",
    "impressions",
    "reach",
    "frequency",
    "clicks",
    "ctr",
    "cpm",
    "cpc",
    "spend",
    "actions",
    "cost_per_action_type",
  ].join(",");

  const data = await fetchMeta(`act_${AD_ACCOUNT_ID}/insights`, {
    level,
    fields,
    time_range: JSON.stringify({ since, until }),
    limit: 500,
  });

  const rows = (data.data || []).map((row) => {
    const actions = row.actions || [];
    const costPerAction = row.cost_per_action_type || [];

    const leadsAction = actions.find((a) => a.action_type === "lead");
    const leads = leadsAction ? parseInt(leadsAction.value, 10) : 0;

    const cplAction = costPerAction.find((a) => a.action_type === "lead");
    const cpl = cplAction ? parseFloat(cplAction.value) : null;

    return {
      campaign_name: row.campaign_name || "—",
      adset_name:    row.adset_name    || "—",
      ad_name:       row.ad_name       || "—",
      impressions:   parseInt(row.impressions || "0", 10),
      reach:         parseInt(row.reach       || "0", 10),
      frequency:     parseFloat(row.frequency  || "0"),
      clicks:        parseInt(row.clicks      || "0", 10),
      ctr:           parseFloat(row.ctr        || "0"),
      cpm:           parseFloat(row.cpm        || "0"),
      cpc:           parseFloat(row.cpc        || "0"),
      spend:         parseFloat(row.spend      || "0"),
      leads,
      cpl,
    };
  });

  cache.set(key, { ts: Date.now(), data: rows });
  return rows;
}

export async function GET(request) {
  try {
    if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
      return Response.json(
        { error: "META_AD_ACCOUNT_ID e META_ACCESS_TOKEN não configurados no .env.local" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const until = searchParams.get("until");
    const level = searchParams.get("level") || "ad";

    if (!since || !until) {
      return Response.json({ error: "Parâmetros 'since' e 'until' são obrigatórios." }, { status: 400 });
    }

    const rows = await getInsights(level, since, until);

    const totals = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        reach:       acc.reach       + r.reach,
        clicks:      acc.clicks      + r.clicks,
        spend:       acc.spend       + r.spend,
        leads:       acc.leads       + r.leads,
      }),
      { impressions: 0, reach: 0, clicks: 0, spend: 0, leads: 0 }
    );

    totals.ctr       = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpm       = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    totals.cpc       = totals.clicks      > 0 ? totals.spend / totals.clicks : 0;
    totals.cpl       = totals.leads       > 0 ? totals.spend / totals.leads  : null;
    totals.frequency = totals.reach       > 0 ? totals.impressions / totals.reach : 0;

    return Response.json({ data: rows, totals, since, until, level });
  } catch (err) {
    console.error("[/api/meta]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
