import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const MODULE_DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), "data", "tiktok-shop-reports"),
  path.join(MODULE_DIR, "..", "data", "tiktok-shop-reports"),
  path.join(MODULE_DIR, "..", "..", "data", "tiktok-shop-reports"),
];

const jsonCache = new Map();
let snapshotListCache = null;
let dailyLedgerCache = null;

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

function readJson(filePath) {
  const stat = fs.statSync(filePath);
  const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  const cached = jsonCache.get(cacheKey);
  if (cached) return cached;
  const buffer = fs.readFileSync(filePath);
  const content = filePath.endsWith(".gz") ? zlib.gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
  const parsed = JSON.parse(content);
  jsonCache.set(cacheKey, parsed);
  return parsed;
}

const monthStartISO = (month) => `${month}-01`;

const monthEndISO = (month) => addDaysISO(addMonthsISO(monthStartISO(month), 1), -1);

const addMonthsISO = (dateString, months) => {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const maxISO = (a, b) => (a > b ? a : b);

const minISO = (a, b) => (a < b ? a : b);

const todaySaoPauloISO = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const uniqueMonthsBetween = (from, to) => {
  const months = [];
  let cursor = monthStartISO(from.slice(0, 7));
  const last = monthStartISO(to.slice(0, 7));
  while (cursor <= last) {
    months.push(cursor.slice(0, 7));
    cursor = addMonthsISO(cursor, 1);
  }
  return months;
};

const compactSnapshot = ({ file, month, start, endInclusive, partial, rows, generatedAt }) => ({
  file,
  month,
  start,
  endInclusive,
  partial,
  rows,
  generatedAt,
});

function latestSnapshotAtOrBefore(snapshots, month, date) {
  return snapshots
    .filter((s) => s.month === month && s.start <= date && s.endInclusive <= date)
    .at(-1) || null;
}

function snapshotsFromSameBatch(a, b) {
  if (!a || !b) return true;
  const aTime = Date.parse(a.generatedAt || "");
  const bTime = Date.parse(b.generatedAt || "");
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 60 * 60 * 1000;
}

function latestExactSnapshot(snapshots, from, to) {
  return snapshots
    .filter((s) => s.start === from && s.endInclusive === to)
    .at(-1) || null;
}

function rowMetrics(row) {
  return {
    gmv: parseBRL(row?.sum_cl_pay_amt),
    comissao: parseBRL(row?.pre_estimated_commission),
    orders: parseIntMetric(row?.cl_pay_sub_order_cnt),
    liveGmv: parseBRL(row?.cl_live_pay_amt),
    videoGmv: parseBRL(row?.cl_video_pay_amt),
    directGmv: parseBRL(row?.cl_flow_con_pay_amt),
    commissionBase: parseBRL(row?.cl_pay_commission_base_amt),
  };
}

function rowMapForSnapshot(snapshot, handleSet) {
  if (!snapshot) return new Map();
  const data = readJson(snapshot.fullPath);
  const rows = new Map();
  for (const row of data.items || []) {
    const handle = cleanHandle(row.author_alias);
    if (!handle || (handleSet && !handleSet.has(handle))) continue;
    rows.set(handle, rowMetrics(row));
  }
  return rows;
}

function addMetrics(target, delta, snapshot) {
  target.gmv += delta.gmv;
  target.comissao += delta.comissao;
  target.orders += delta.orders;
  target.liveGmv += delta.liveGmv;
  target.videoGmv += delta.videoGmv;
  target.directGmv += delta.directGmv;
  target.commissionBase += delta.commissionBase;
  target.lastUpdate = snapshot.endInclusive;
  target.snapshots.push(snapshot.file);
}

function addMetricsForDay(target, delta, day, snapshot) {
  target.gmv += delta.gmv;
  target.comissao += delta.comissao;
  target.orders += delta.orders;
  target.liveGmv += delta.liveGmv;
  target.videoGmv += delta.videoGmv;
  target.directGmv += delta.directGmv;
  target.commissionBase += delta.commissionBase;
  target.lastUpdate = day;
  target.snapshots.push(snapshot.file);
}

function subtractMetrics(current, previous = {}) {
  return {
    gmv: current.gmv - Number(previous.gmv || 0),
    comissao: current.comissao - Number(previous.comissao || 0),
    orders: current.orders - Number(previous.orders || 0),
    liveGmv: current.liveGmv - Number(previous.liveGmv || 0),
    videoGmv: current.videoGmv - Number(previous.videoGmv || 0),
    directGmv: current.directGmv - Number(previous.directGmv || 0),
    commissionBase: current.commissionBase - Number(previous.commissionBase || 0),
  };
}

function hasAnyMetric(metrics = {}) {
  return (
    metrics.gmv !== 0 ||
    metrics.comissao !== 0 ||
    metrics.orders !== 0 ||
    metrics.liveGmv !== 0 ||
    metrics.videoGmv !== 0 ||
    metrics.directGmv !== 0 ||
    metrics.commissionBase !== 0
  );
}

function emptyAdjustmentSummary() {
  return {
    negative_cells: 0,
    affected_creators: 0,
    gmv_adjustment: 0,
    commission_adjustment: 0,
    orders_adjustment: 0,
    live_gmv_adjustment: 0,
    video_gmv_adjustment: 0,
    direct_gmv_adjustment: 0,
    examples: [],
  };
}

function registerNegativeAdjustments(summary, handle, delta) {
  const metrics = [
    ["gmv", "gmv_adjustment"],
    ["comissao", "commission_adjustment"],
    ["orders", "orders_adjustment"],
    ["liveGmv", "live_gmv_adjustment"],
    ["videoGmv", "video_gmv_adjustment"],
    ["directGmv", "direct_gmv_adjustment"],
  ];
  const negativeFields = metrics.filter(([key]) => Number(delta[key] || 0) < 0);
  if (negativeFields.length === 0) return;

  summary.negative_cells += negativeFields.length;
  summary._handles.add(handle);
  for (const [key, summaryKey] of negativeFields) {
    summary[summaryKey] += Number(delta[key] || 0);
  }
  if (summary.examples.length < 8) {
    summary.examples.push({
      handle,
      gmv: delta.gmv,
      commission: delta.comissao,
      orders: delta.orders,
      live_gmv: delta.liveGmv,
      video_gmv: delta.videoGmv,
      direct_gmv: delta.directGmv,
    });
  }
}

export function listTikTokSnapshots() {
  const downloadsDir = path.join(dataDir(), "downloads");
  if (!fs.existsSync(downloadsDir)) return [];
  const files = fs
    .readdirSync(downloadsDir)
    .filter((name) => name.startsWith("creator_gmv__") && (name.endsWith(".json") || name.endsWith(".json.gz")))
    .sort();
  const signature = files
    .map((file) => {
      const stat = fs.statSync(path.join(downloadsDir, file));
      return `${file}:${stat.mtimeMs}:${stat.size}`;
    })
    .join("|");
  if (snapshotListCache?.downloadsDir === downloadsDir && snapshotListCache.signature === signature) {
    return snapshotListCache.snapshots;
  }
  const snapshots = files
    .map((file) => {
      const match = file.match(/^creator_gmv__(\d{4}-\d{2})__(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.json(?:\.gz)?$/);
      if (match) {
        const [, month, start, endExclusive] = match;
        const fullPath = path.join(downloadsDir, file);
        let metadata = {};
        try {
          const data = readJson(fullPath);
          metadata = {
            rows: Array.isArray(data.items) ? data.items.length : null,
            totalCount: data.total_count ?? null,
            generatedAt: data.generated_at ?? null,
          };
        } catch {
          metadata = { rows: null, totalCount: null, generatedAt: null };
        }
        return {
          file,
          fullPath,
          month,
          start,
          endExclusive,
          endInclusive: addDaysISO(endExclusive, -1),
          partial: endExclusive !== addMonthsISO(monthStartISO(month), 1),
          rows: metadata.rows,
          totalCount: metadata.totalCount,
          generatedAt: metadata.generatedAt,
        };
      }
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
  snapshotListCache = { downloadsDir, signature, snapshots };
  return snapshots;
}

function snapshotSignature(snapshots) {
  return snapshots.map((snapshot) => `${snapshot.file}:${snapshot.generatedAt || ""}:${snapshot.rows ?? ""}`).join("|");
}

function buildDailyLedger() {
  const snapshots = listTikTokSnapshots();
  const signature = snapshotSignature(snapshots);
  if (dailyLedgerCache?.signature === signature) return dailyLedgerCache.ledger;

  const byDay = new Map();
  for (const month of [...new Set(snapshots.map((snapshot) => snapshot.month))]) {
    const monthSnapshots = snapshots.filter((snapshot) => snapshot.month === month);
    for (const snapshot of monthSnapshots) {
      const day = snapshot.endInclusive;
      if (!day || snapshot.start !== monthStartISO(month)) continue;

      const exactDailySnapshot = latestExactSnapshot(monthSnapshots, day, day);
      const sourceSnapshot = exactDailySnapshot || snapshot;
      const previousSnapshot = exactDailySnapshot ? null : latestSnapshotAtOrBefore(monthSnapshots, month, addDaysISO(day, -1));
      if (!exactDailySnapshot && previousSnapshot && !snapshotsFromSameBatch(sourceSnapshot, previousSnapshot)) {
        byDay.set(day, {
          date: day,
          status: "DEGRADED",
          source: "blocked_mixed_snapshot_batches",
          snapshot: sourceSnapshot,
          beforeSnapshot: previousSnapshot,
          rows: new Map(),
        });
        continue;
      }

      const currentRows = rowMapForSnapshot(sourceSnapshot);
      const previousRows = rowMapForSnapshot(previousSnapshot);
      const rows = new Map();
      for (const [handle, current] of currentRows.entries()) {
        const delta = exactDailySnapshot ? current : subtractMetrics(current, previousRows.get(handle));
        if (hasAnyMetric(delta)) rows.set(handle, delta);
      }
      byDay.set(day, {
        date: day,
        status: "OK",
        source: exactDailySnapshot ? "exact_daily_partner_center_export" : "month_to_date_delta_same_batch",
        snapshot: sourceSnapshot,
        beforeSnapshot: previousSnapshot,
        rows,
      });
    }
  }

  const ledger = {
    byDay,
    dates: [...byDay.keys()].sort(),
    snapshots,
  };
  dailyLedgerCache = { signature, ledger };
  return ledger;
}

function makeEmptyMetrics() {
  return {
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

export function aggregateTikTokDailyLedger({ from, to, handles } = {}) {
  const fallback = defaultSnapshotPeriod();
  const requestedFrom = from || fallback.from;
  const requestedTo = to || fallback.to;
  const handleSet = handles ? new Set([...handles].map(cleanHandle)) : null;
  const ledger = buildDailyLedger();
  const byHandle = {};
  const coverageParts = [];
  const selected = [];
  const warnings = [];

  let cursor = requestedFrom;
  while (cursor <= requestedTo) {
    const day = ledger.byDay.get(cursor);
    if (!day || day.status !== "OK") {
      coverageParts.push({
        date: cursor,
        status: "DEGRADED",
        source: day?.source || "missing_daily_ledger",
        snapshot: day?.snapshot || null,
        beforeSnapshot: day?.beforeSnapshot || null,
      });
      cursor = addDaysISO(cursor, 1);
      continue;
    }

    selected.push(day.snapshot);
    coverageParts.push({
      date: cursor,
      status: "OK",
      source: day.source,
      snapshot: day.snapshot,
      beforeSnapshot: day.beforeSnapshot,
    });
    for (const [handle, metrics] of day.rows.entries()) {
      if (handleSet && !handleSet.has(handle)) continue;
      if (!byHandle[handle]) byHandle[handle] = makeEmptyMetrics();
      addMetricsForDay(byHandle[handle], metrics, cursor, day.snapshot);
    }
    cursor = addDaysISO(cursor, 1);
  }

  if (coverageParts.some((part) => part.source === "missing_daily_ledger")) {
    warnings.push("Periodo com dias sem ledger diario confiavel do Partner Center.");
  }
  if (coverageParts.some((part) => part.source === "blocked_mixed_snapshot_batches")) {
    warnings.push("Um ou mais dias foram bloqueados porque o delta mistura snapshots acumulados de lotes diferentes.");
  }

  const okParts = coverageParts.filter((part) => part.status === "OK");
  const coverageMode = coverageParts.length > 0 && coverageParts.every((part) => part.status === "OK")
    ? "daily_ledger_exact"
    : "daily_ledger_partial";

  return {
    byHandle,
    requested: { from: requestedFrom, to: requestedTo },
    coverage: {
      from: okParts[0]?.date || null,
      to: okParts.at(-1)?.date || null,
      mode: coverageMode,
      snapshots: [...new Map(selected.map((snapshot) => [snapshot.file, snapshot])).values()].map(compactSnapshot),
      parts: coverageParts.map((part) => ({
        date: part.date,
        status: part.status,
        source: part.source,
        snapshot: part.snapshot ? compactSnapshot(part.snapshot) : null,
        beforeSnapshot: part.beforeSnapshot ? compactSnapshot(part.beforeSnapshot) : null,
      })),
    },
    availablePeriods: ledger.snapshots.map(compactSnapshot),
    warnings,
    adjustments: emptyAdjustmentSummary(),
  };
}

export function buildTikTokDailyGmvTimeline({ from, to, handles } = {}) {
  const handleSet = handles ? new Set([...handles].map(cleanHandle)) : null;
  if (from?.endsWith("-01")) {
    const snapshots = listTikTokSnapshots();
    const points = [];
    const warnings = [];
    let cursor = from;
    while (cursor <= to) {
      const month = cursor.slice(0, 7);
      const snapshot = latestSnapshotAtOrBefore(snapshots, month, cursor);
      const point = {
        date: cursor,
        total: 0,
        liveGmv: 0,
        videoGmv: 0,
        directGmv: 0,
        creators: {},
        creatorChannels: {},
        status: snapshot ? "OK" : "DEGRADED",
        source: snapshot ? "month_to_date_partner_center_snapshot" : "missing_cumulative_snapshot",
      };
      if (snapshot) {
        const rows = rowMapForSnapshot(snapshot, handleSet);
        for (const handle of handleSet || rows.keys()) {
          const metrics = rows.get(handle) || {};
          const value = Number(metrics.gmv || 0);
          point.creators[handle] = value;
          point.creatorChannels[handle] = {
            liveGmv: Number(metrics.liveGmv || 0),
            videoGmv: Number(metrics.videoGmv || 0),
            directGmv: Number(metrics.directGmv || 0),
          };
          point.total += value;
          point.liveGmv += Number(metrics.liveGmv || 0);
          point.videoGmv += Number(metrics.videoGmv || 0);
          point.directGmv += Number(metrics.directGmv || 0);
        }
      } else {
        warnings.push(`Dia ${cursor} sem snapshot acumulado confiavel.`);
      }
      points.push(point);
      cursor = addDaysISO(cursor, 1);
    }
    return {
      mode: "month_to_date_gmv_by_day",
      label: "GMV acumulado no mês por dia",
      points,
      warnings: [...new Set(warnings)],
    };
  }

  const ledger = buildDailyLedger();
  const points = [];
  const totalsByHandle = {};
  const channelsByHandle = {};
  const warnings = [];
  let cursor = from;
  while (cursor <= to) {
    const day = ledger.byDay.get(cursor);
    const point = {
      date: cursor,
      total: 0,
      liveGmv: 0,
      videoGmv: 0,
      directGmv: 0,
      creators: {},
      creatorChannels: {},
      status: day?.status || "DEGRADED",
      source: day?.source || "missing_daily_ledger",
    };
    if (day?.status === "OK") {
      for (const [handle, metrics] of day.rows.entries()) {
        if (handleSet && !handleSet.has(handle)) continue;
        totalsByHandle[handle] = Number(totalsByHandle[handle] || 0) + Number(metrics.gmv || 0);
        channelsByHandle[handle] = {
          liveGmv: Number(channelsByHandle[handle]?.liveGmv || 0) + Number(metrics.liveGmv || 0),
          videoGmv: Number(channelsByHandle[handle]?.videoGmv || 0) + Number(metrics.videoGmv || 0),
          directGmv: Number(channelsByHandle[handle]?.directGmv || 0) + Number(metrics.directGmv || 0),
        };
      }
      for (const handle of handleSet || Object.keys(totalsByHandle)) {
        const value = Number(totalsByHandle[handle] || 0);
        const channels = channelsByHandle[handle] || {};
        point.creators[handle] = value;
        point.creatorChannels[handle] = {
          liveGmv: Number(channels.liveGmv || 0),
          videoGmv: Number(channels.videoGmv || 0),
          directGmv: Number(channels.directGmv || 0),
        };
        point.total += value;
        point.liveGmv += Number(channels.liveGmv || 0);
        point.videoGmv += Number(channels.videoGmv || 0);
        point.directGmv += Number(channels.directGmv || 0);
      }
    } else if (day?.source === "blocked_mixed_snapshot_batches") {
      warnings.push(`Dia ${cursor} bloqueado por mistura de lotes de snapshots.`);
    } else {
      warnings.push(`Dia ${cursor} sem ledger diario confiavel.`);
    }
    points.push(point);
    cursor = addDaysISO(cursor, 1);
  }
  return {
    mode: "daily_ledger_cumulative_gmv_by_day",
    label: "GMV acumulado por soma de dias fechados",
    points,
    warnings: [...new Set(warnings)],
  };
}

export function defaultSnapshotPeriod() {
  const snapshots = listTikTokSnapshots();
  const latest = snapshots.at(-1);
  const today = todaySaoPauloISO();
  const currentMonthStart = `${today.slice(0, 7)}-01`;
  if (!latest) {
    return { from: currentMonthStart, to: today };
  }
  if (latest.month < today.slice(0, 7)) {
    return { from: currentMonthStart, to: today };
  }
  return { from: latest.start, to: latest.endInclusive };
}

export function aggregateTikTokSnapshots({ from, to, handles } = {}) {
  const snapshots = listTikTokSnapshots();
  const fallback = defaultSnapshotPeriod();
  const requestedFrom = from || fallback.from;
  const requestedTo = to || fallback.to;
  const handleSet = handles ? new Set([...handles].map(cleanHandle)) : null;

  const byHandle = {};
  const selected = [];
  const coverageParts = [];
  const adjustments = emptyAdjustmentSummary();
  adjustments._handles = new Set();

  for (const month of uniqueMonthsBetween(requestedFrom, requestedTo)) {
    const monthSnapshots = snapshots.filter((s) => s.month === month);
    if (monthSnapshots.length === 0) continue;

    const requestedMonthFrom = maxISO(requestedFrom, monthStartISO(month));
    const requestedMonthTo = minISO(requestedTo, monthEndISO(month));
    const exactSnapshot = latestExactSnapshot(monthSnapshots, requestedMonthFrom, requestedMonthTo);
    const endSnapshot = exactSnapshot || latestSnapshotAtOrBefore(monthSnapshots, month, requestedMonthTo);
    if (!endSnapshot) {
      coverageParts.push({
        from: null,
        to: null,
        requestedFrom: requestedMonthFrom,
        requestedTo: requestedMonthTo,
        snapshot: null,
        beforeSnapshot: null,
        missingExactRange: true,
      });
      continue;
    }

    const monthStartsAtBeginning = requestedMonthFrom === monthStartISO(month);
    const beforeSnapshot = exactSnapshot || monthStartsAtBeginning
      ? null
      : latestSnapshotAtOrBefore(monthSnapshots, month, addDaysISO(requestedMonthFrom, -1));

    if (!exactSnapshot && !monthStartsAtBeginning && !beforeSnapshot) {
      coverageParts.push({
        from: null,
        to: null,
        requestedFrom: requestedMonthFrom,
        requestedTo: requestedMonthTo,
        snapshot: null,
        beforeSnapshot: null,
        missingExactRange: true,
      });
      continue;
    }

    if (!exactSnapshot && beforeSnapshot && !snapshotsFromSameBatch(endSnapshot, beforeSnapshot)) {
      coverageParts.push({
        from: null,
        to: null,
        requestedFrom: requestedMonthFrom,
        requestedTo: requestedMonthTo,
        snapshot: endSnapshot,
        beforeSnapshot,
        staleBoundaryRange: true,
      });
      continue;
    }

    const effectiveFrom = exactSnapshot || monthStartsAtBeginning ? endSnapshot.start : requestedMonthFrom;
    const effectiveTo = endSnapshot.endInclusive;
    if (effectiveFrom > effectiveTo) continue;

    const endRows = rowMapForSnapshot(endSnapshot, handleSet);
    const beforeRows = rowMapForSnapshot(beforeSnapshot, handleSet);
    selected.push(endSnapshot);
    coverageParts.push({
      from: effectiveFrom,
      to: effectiveTo,
      requestedFrom: requestedMonthFrom,
      requestedTo: requestedMonthTo,
      snapshot: endSnapshot,
      beforeSnapshot,
      exactSnapshot: Boolean(exactSnapshot),
      sameBatchDelta: Boolean(beforeSnapshot),
    });

    for (const [handle, current] of endRows.entries()) {
      const previous = beforeRows.get(handle) || {};
      const delta = {
        gmv: current.gmv - Number(previous.gmv || 0),
        comissao: current.comissao - Number(previous.comissao || 0),
        orders: current.orders - Number(previous.orders || 0),
        liveGmv: current.liveGmv - Number(previous.liveGmv || 0),
        videoGmv: current.videoGmv - Number(previous.videoGmv || 0),
        directGmv: current.directGmv - Number(previous.directGmv || 0),
        commissionBase: current.commissionBase - Number(previous.commissionBase || 0),
      };
      registerNegativeAdjustments(adjustments, handle, delta);
      if (
        delta.gmv === 0 &&
        delta.comissao === 0 &&
        delta.orders === 0 &&
        delta.liveGmv === 0 &&
        delta.videoGmv === 0 &&
        delta.directGmv === 0
      ) {
        continue;
      }
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
      addMetrics(byHandle[handle], delta, endSnapshot);
    }
  }

  const coveredParts = coverageParts.filter((part) => part.snapshot);
  const coverageFrom = coveredParts[0]?.from || null;
  const coverageTo = coveredParts.at(-1)?.to || null;
  const coverageMode =
    coverageParts.length > 0 &&
    coverageParts.every((part) => part.snapshot) &&
    coveredParts[0]?.from === requestedFrom &&
    coveredParts.at(-1)?.to === requestedTo &&
    coveredParts.every((part) => part.from === part.requestedFrom && part.to === part.requestedTo)
      ? "exact_or_contained"
      : "coverage_adjusted";
  const warnings = [];
  if (selected.length === 0) {
    warnings.push("Nenhum snapshot TikTok Shop/Partner Center confiavel encontrado para o periodo selecionado.");
  } else if (coverageMode === "coverage_adjusted") {
    warnings.push(
      `Periodo ajustado para a cobertura validada disponivel: ${coverageFrom} a ${coverageTo}.`,
    );
  }
  if (coverageParts.some((part) => part.missingExactRange)) {
    warnings.push("Periodo personalizado exige export direto do Partner Center ou snapshots de borda do mesmo lote.");
  }
  if (coverageParts.some((part) => part.staleBoundaryRange)) {
    warnings.push("Periodo personalizado bloqueado porque mistura snapshots acumulados gerados em lotes diferentes.");
  }
  adjustments.affected_creators = adjustments._handles.size;
  delete adjustments._handles;

  return {
    byHandle,
    requested: { from: requestedFrom, to: requestedTo },
    coverage: {
      from: coverageFrom,
      to: coverageTo,
      mode: coverageMode,
      snapshots: selected.map(compactSnapshot),
      parts: coverageParts.map(({ from: partFrom, to: partTo, requestedFrom: partRequestedFrom, requestedTo: partRequestedTo, snapshot, beforeSnapshot, exactSnapshot, sameBatchDelta, missingExactRange, staleBoundaryRange }) => ({
        from: partFrom,
        to: partTo,
        requestedFrom: partRequestedFrom,
        requestedTo: partRequestedTo,
        snapshot: snapshot ? compactSnapshot(snapshot) : null,
        beforeSnapshot: beforeSnapshot ? compactSnapshot(beforeSnapshot) : null,
        exactSnapshot: Boolean(exactSnapshot),
        sameBatchDelta: Boolean(sameBatchDelta),
        missingExactRange: Boolean(missingExactRange),
        staleBoundaryRange: Boolean(staleBoundaryRange),
      })),
    },
    availablePeriods: snapshots.map(compactSnapshot),
    warnings,
    adjustments,
  };
}
