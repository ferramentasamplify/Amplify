import fs from "node:fs";
import path from "node:path";

const MODULE_DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), "data", "tiktok-shop-reports"),
  path.join(MODULE_DIR, "..", "data", "tiktok-shop-reports"),
  path.join(MODULE_DIR, "..", "..", "data", "tiktok-shop-reports"),
];

function dataDir() {
  return DATA_DIR_CANDIDATES.find((dir) => fs.existsSync(path.join(dir, "downloads"))) || DATA_DIR_CANDIDATES[0];
}

export function cleanHandle(value) {
  const raw = String(value || "").toLowerCase().trim();
  const atMatch = raw.match(/tiktok\.com\/@([^/?&#\s]+)/);
  if (atMatch) return atMatch[1].trim();
  return raw.replace(/^@/, "").split("?")[0].split("&")[0].trim();
}

export function parseBRL(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Number.parseFloat(cleaned) || 0;
}

const parseIntMetric = (value) => {
  if (typeof value === "number") return value;
  return Number.parseInt(String(value || "").replace(/\D/g, ""), 10) || 0;
};

const addDaysISO = (dateString, days) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const overlaps = (snapshot, from, toExclusive) =>
  snapshot.start < toExclusive && snapshot.endExclusive > from;

const contains = (snapshot, from, toExclusive) =>
  snapshot.start >= from && snapshot.endExclusive <= toExclusive;

const dedupeSnapshots = (snapshots) => {
  const byMonth = new Map();
  for (const snapshot of snapshots) {
    const current = byMonth.get(snapshot.month);
    if (
      !current ||
      snapshot.endExclusive > current.endExclusive ||
      (snapshot.endExclusive === current.endExclusive && snapshot.generatedAt > current.generatedAt)
    ) {
      byMonth.set(snapshot.month, snapshot);
    }
  }
  return [...byMonth.values()].sort((a, b) => a.start.localeCompare(b.start));
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function listTikTokSnapshots() {
  const downloadsDir = path.join(dataDir(), "downloads");
  if (!fs.existsSync(downloadsDir)) return [];
  return fs
    .readdirSync(downloadsDir)
    .filter((name) => name.startsWith("creator_gmv__") && name.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(downloadsDir, file);
      const data = readJson(fullPath);
      return {
        file,
        fullPath,
        month: data.month,
        start: data.range?.start,
        endExclusive: data.range?.end_exclusive,
        endInclusive: data.range?.end_exclusive ? addDaysISO(data.range.end_exclusive, -1) : null,
        partial: Boolean(data.partial),
        rows: Array.isArray(data.items) ? data.items.length : 0,
        totalCount: data.total_count ?? null,
        generatedAt: data.generated_at ?? null,
      };
    })
    .filter((s) => s.start && s.endExclusive)
    .sort((a, b) => a.start.localeCompare(b.start) || a.endExclusive.localeCompare(b.endExclusive));
}

export function defaultSnapshotPeriod() {
  const snapshots = listTikTokSnapshots();
  const latest = snapshots.at(-1);
  if (!latest) {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today.slice(0, 8) + "01", to: today };
  }
  return { from: latest.start, to: latest.endInclusive };
}

export function aggregateTikTokSnapshots({ from, to, handles } = {}) {
  const snapshots = listTikTokSnapshots();
  const fallback = defaultSnapshotPeriod();
  const requestedFrom = from || fallback.from;
  const requestedTo = to || fallback.to;
  const requestedToExclusive = addDaysISO(requestedTo, 1);
  const handleSet = handles ? new Set([...handles].map(cleanHandle)) : null;

  let selected = dedupeSnapshots(snapshots.filter((s) => contains(s, requestedFrom, requestedToExclusive)));
  let coverageMode = "exact_or_contained";
  if (selected.length === 0) {
    selected = dedupeSnapshots(snapshots.filter((s) => overlaps(s, requestedFrom, requestedToExclusive)));
    coverageMode = "overlap_approximation";
  }

  const byHandle = {};
  for (const snapshot of selected) {
    const data = readJson(snapshot.fullPath);
    for (const row of data.items || []) {
      const handle = cleanHandle(row.author_alias);
      if (!handle || (handleSet && !handleSet.has(handle))) continue;
      if (!byHandle[handle]) {
        byHandle[handle] = {
          gmv: 0,
          comissao: 0,
          orders: 0,
          liveGmv: 0,
          videoGmv: 0,
          directGmv: 0,
          commissionBase: 0,
          snapshots: [],
          lastUpdate: null,
        };
      }
      byHandle[handle].gmv += parseBRL(row.sum_cl_pay_amt);
      byHandle[handle].comissao += parseBRL(row.pre_estimated_commission);
      byHandle[handle].orders += parseIntMetric(row.cl_pay_sku_order_cnt);
      byHandle[handle].liveGmv += parseBRL(row.cl_live_pay_amt);
      byHandle[handle].videoGmv += parseBRL(row.cl_video_pay_amt);
      byHandle[handle].directGmv += parseBRL(row.cl_flow_con_pay_amt);
      byHandle[handle].commissionBase += parseBRL(row.cl_pay_commission_base_amt);
      byHandle[handle].lastUpdate = snapshot.endInclusive;
      byHandle[handle].snapshots.push(snapshot.month);
    }
  }

  const coverageFrom = selected[0]?.start || null;
  const coverageTo = selected.at(-1)?.endInclusive || null;
  const warnings = [];
  if (selected.length === 0) {
    warnings.push("Nenhum snapshot TikTok Shop/Partner Center encontrado para o periodo selecionado.");
  } else if (coverageMode === "overlap_approximation") {
    warnings.push(
      `Periodo sem snapshot exato; usando cobertura disponivel ${coverageFrom} a ${coverageTo}.`,
    );
  }

  return {
    byHandle,
    requested: { from: requestedFrom, to: requestedTo },
    coverage: {
      from: coverageFrom,
      to: coverageTo,
      mode: coverageMode,
      snapshots: selected.map(({ file, month, start, endInclusive, partial, rows, generatedAt }) => ({
        file,
        month,
        start,
        endInclusive,
        partial,
        rows,
        generatedAt,
      })),
    },
    availablePeriods: snapshots.map(({ month, start, endInclusive, partial, rows, generatedAt }) => ({
      month,
      start,
      endInclusive,
      partial,
      rows,
      generatedAt,
    })),
    warnings,
  };
}
