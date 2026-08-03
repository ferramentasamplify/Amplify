"use client";

import { useMemo, useState } from "react";

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const clampISO = (iso, min, max) => {
  if (!iso) return iso;
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
};

const startOfWeekISO = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
};

const startOfMonthISO = (iso) => `${iso.slice(0, 7)}-01`;

const daysInMonth = (monthISO) => {
  const [year, month] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const monthStartOffset = (monthISO) => {
  if (!monthISO) return 0;
  const [year, month] = monthISO.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (jsDay + 6) % 7;
};

const fmtFullDate = (iso) => iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR") : "sem data";

const datesFromFreshness = (freshness) => {
  const direct = freshness?.available_dates || freshness?.availableDates || [];
  if (direct.length > 0) return direct;
  return (freshness?.availablePeriods || [])
    .flatMap((period) => [period.start, period.endInclusive, period.period_end])
    .filter(Boolean);
};

export default function PartnerCenterDateSelector({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onApply,
  loading = false,
  freshness,
  accent = "#25F4EE",
  align = "right",
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("custom");
  const [selector, setSelector] = useState(null);
  const availableDates = useMemo(
    () => [...new Set([...(datesFromFreshness(freshness) || []), ...((selector?.available_dates || []))])].sort(),
    [freshness, selector],
  );
  const minDate = availableDates[0] || freshness?.effectiveCoverage?.from || startDate;
  const maxDate = availableDates.at(-1) || freshness?.effectiveCoverage?.to || endDate;
  const activeMonth = (endDate || maxDate || startDate || "").slice(0, 7);
  const monthDays = activeMonth ? Array.from({ length: daysInMonth(activeMonth) }, (_, i) => `${activeMonth}-${String(i + 1).padStart(2, "0")}`) : [];
  const leadingBlankDays = activeMonth ? Array.from({ length: monthStartOffset(activeMonth) }) : [];
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

  async function loadSelector() {
    if (selector) return selector;
    const res = await fetch("/api/club-virada?periodSelector=1", { cache: "no-store" });
    const data = await res.json();
    setSelector(data);
    return data;
  }

  async function applyRange(from, to) {
    const loaded = selector || await loadSelector();
    const available = [...new Set([...(availableDates || []), ...((loaded?.available_dates || []))])].sort();
    const first = available[0] || minDate;
    const last = available.at(-1) || maxDate;
    const nextFrom = clampISO(from, first, last);
    const nextTo = clampISO(to, first, last);
    setStartDate(nextFrom);
    setEndDate(nextTo);
    await onApply(nextFrom, nextTo);
    setOpen(false);
  }

  function setDraftRange(from, to) {
    setStartDate(clampISO(from, minDate, maxDate));
    setEndDate(clampISO(to, minDate, maxDate));
  }

  function selectDay(day) {
    if (day < minDate || day > maxDate) return;
    setMode("day");
    setDraftRange(day, day);
  }

  function selectWeek(day) {
    if (day < minDate || day > maxDate) return;
    const from = clampISO(startOfWeekISO(day), minDate, maxDate);
    const to = clampISO(addDays(from, 6), minDate, maxDate);
    setMode("week");
    setDraftRange(from, to);
  }

  function selectMonth(monthISO = activeMonth) {
    if (!monthISO) return;
    const from = clampISO(`${monthISO}-01`, minDate, maxDate);
    const to = clampISO(`${monthISO}-${String(daysInMonth(monthISO)).padStart(2, "0")}`, minDate, maxDate);
    setMode("month");
    setDraftRange(from, to);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          setOpen((value) => !value);
          if (!selector) await loadSelector();
        }}
        className="min-w-[280px] rounded-lg border bg-[#10141E] px-3 py-2 text-left text-xs font-bold text-white shadow-sm focus:outline-none"
        style={{ borderColor: accent }}
      >
        <span className="text-white/50">Periodo:</span> {startDate || "--"} <span className="text-white/35">-</span> {endDate || "--"}
      </button>
      {open && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} top-11 z-30 w-[min(92vw,620px)] overflow-hidden rounded-lg border border-white/10 bg-[#111521] shadow-2xl`}>
          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr]">
            <div className="border-b border-white/10 bg-white/[0.02] p-3 md:border-b-0 md:border-r">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                <button type="button" onClick={() => applyRange(addDays(maxDate, -6), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Ultimos 7 dias
                </button>
                <button type="button" onClick={() => applyRange(addDays(maxDate, -27), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Ultimos 28 dias
                </button>
                <button type="button" onClick={() => applyRange(startOfMonthISO(maxDate), maxDate)} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/70 hover:text-white">
                  Mes atual
                </button>
              </div>
              <div className="mt-3 text-[10px] leading-relaxed text-white/35">
                {selector?.snapshot_count || availableDates.length || "..."} cortes disponiveis
                {maxDate ? ` · ate ${fmtFullDate(maxDate)}` : ""}
              </div>
            </div>
            <div className="p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {[["custom", "Personalizar"], ["day", "Dia"], ["week", "Semana"], ["month", "Mes"]].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMode(key);
                      if (key === "month") selectMonth();
                    }}
                    className={`rounded-md px-2.5 py-1.5 font-bold ${mode === key ? "text-black" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
                    style={mode === key ? { background: accent } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase tracking-widest text-white/35">
                  Inicio
                  <input type="date" value={startDate} min={minDate} max={maxDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0A0B12] px-2 py-2 text-xs text-white focus:outline-none" />
                </label>
                <label className="text-[10px] uppercase tracking-widest text-white/35">
                  Fim
                  <input type="date" value={endDate} min={minDate} max={maxDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#0A0B12] px-2 py-2 text-xs text-white focus:outline-none" />
                </label>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0A0B12] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <button type="button" onClick={() => selectMonth(addDays(`${activeMonth}-01`, -1).slice(0, 7))} className="rounded-md px-2 py-1 text-white/45 hover:bg-white/[0.04] hover:text-white">‹</button>
                  <div className="text-sm font-extrabold text-white">{activeMonth || "---- --"}</div>
                  <button type="button" onClick={() => selectMonth(addDays(`${activeMonth}-${String(daysInMonth(activeMonth)).padStart(2, "0")}`, 1).slice(0, 7))} className="rounded-md px-2 py-1 text-white/45 hover:bg-white/[0.04] hover:text-white">›</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekdays.map((day) => <div key={day} className="py-1 text-[10px] font-bold uppercase text-white/30">{day}</div>)}
                  {leadingBlankDays.map((_, index) => <div key={`blank-${activeMonth}-${index}`} className="h-8" aria-hidden="true" />)}
                  {monthDays.map((day) => {
                    const disabled = day < minDate || day > maxDate;
                    const selected = day >= startDate && day <= endDate;
                    const edge = day === startDate || day === endDate;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (mode === "week") selectWeek(day);
                          else if (mode === "month") selectMonth(day.slice(0, 7));
                          else if (mode === "day") selectDay(day);
                          else if (!startDate || startDate !== endDate) setDraftRange(day, day);
                          else setDraftRange(startDate < day ? startDate : day, startDate < day ? day : startDate);
                        }}
                        className={`h-8 rounded-md text-xs font-bold disabled:cursor-not-allowed disabled:text-white/15 ${
                          edge ? "text-black" : selected ? "text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                        }`}
                        style={edge ? { background: accent } : selected ? { background: `${accent}26` } : undefined}
                      >
                        {Number(day.slice(-2))}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={() => applyRange(startDate, endDate)} disabled={loading || !startDate || !endDate} className="rounded-lg px-4 py-2 text-xs font-extrabold text-black disabled:opacity-50" style={{ background: accent }}>
                  {loading ? "Carregando" : "Aplicar periodo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
