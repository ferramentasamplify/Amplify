function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatAreaMetric(value, format = "number") {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  const parsed = number(value);
  if (parsed === null) return "—";
  if (format === "percent") return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed)}%`;
  if (format === "money") {
    if (Math.abs(parsed) >= 1_000_000) return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed / 1_000_000)} mi`;
    if (Math.abs(parsed) >= 1_000) return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed / 1_000)} mil`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parsed);
  }
  if (Math.abs(parsed) >= 1_000_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed / 1_000_000)} mi`;
  if (Math.abs(parsed) >= 100_000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed / 1_000)} mil`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed);
}

export function missionAreaFor(area, summary) {
  return summary?.missionControl?.areas?.[area.missionId || area.id] || null;
}

export function metricsForArea(area, summary) {
  const missionArea = missionAreaFor(area, summary);
  if (Array.isArray(missionArea?.kpis) && missionArea.kpis.length) {
    return missionArea.kpis.slice(0, 3);
  }
  return (area.pendingKpis || []).slice(0, 3).map((label) => ({ label, value: null, format: "number", source: "Pendente no Mission Control" }));
}

export function krProgressFor(area, kr, summary) {
  if (!kr?.id) return null;
  return missionAreaFor(area, summary)?.krProgress?.[kr.id] || null;
}

export function formatKrCurrent(progress, targetLabel) {
  if (!progress || progress.current === null || progress.current === undefined) return targetLabel;
  return `${formatAreaMetric(progress.current, progress.format)}/${formatAreaMetric(progress.target, progress.format)}`;
}

export function totalKrs(area) {
  return (area.objectives || []).reduce((total, objective) => total + (objective.krs || []).length, 0);
}
