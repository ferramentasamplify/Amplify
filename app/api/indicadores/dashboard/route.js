import { NextResponse } from "next/server";
import { normalizeIndicadorHandle, readIndicadorSession } from "@/lib/indicador-auth";

export const dynamic = "force-dynamic";

const fmtDateKey = (lead) => lead.createdDate || String(lead.created || "").slice(0, 10);

function isAgenciado(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized === "agenciado" || normalized === "convite aceito";
}

async function fetchIndiqueData(req) {
  const internalOrigin = process.env.AMPLIFY_HUB_INTERNAL_URL || req.nextUrl.origin;
  const url = new URL("/api/indiqueeganhe-full", internalOrigin);
  const startDate = req.nextUrl.searchParams.get("startDate");
  const endDate = req.nextUrl.searchParams.get("endDate");
  if (startDate) url.searchParams.set("startDate", startDate);
  if (endDate) url.searchParams.set("endDate", endDate);

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Erro ao carregar Indique e Ganhe.");
  return data;
}

export async function GET(req) {
  try {
    const session = await readIndicadorSession();
    if (!session) return NextResponse.json({ error: "Sessão ausente. Faça login." }, { status: 401 });

    const data = await fetchIndiqueData(req);
    const isAdmin = session.handle === 'amplify';
    const leads = isAdmin
      ? (data.leads || [])
      : (data.leads || []).filter((lead) => normalizeIndicadorHandle(lead.utm) === session.handle);
    const displayHandle = isAdmin ? 'amplify' : String(leads[0]?.utm || session.handle).trim();

    const byStatus = leads.reduce((acc, lead) => {
      const status = lead.status || "Sem status";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const totalAgenciados = leads.filter((lead) => isAgenciado(lead.status)).length;
    const totalGeneratedCommission = leads.reduce((sum, lead) => {
      return isAgenciado(lead.status) ? sum + Number(lead.generatedCommission || 0) : sum;
    }, 0);
    const totalGmv = leads.reduce((sum, lead) => sum + Number(lead.gmv || 0), 0);
    const totalCom = leads.reduce((sum, lead) => sum + Number(lead.comissao || 0), 0);

    const byDay = Object.values(leads.reduce((acc, lead) => {
      const date = fmtDateKey(lead);
      if (!date) return acc;
      if (!acc[date]) acc[date] = { date, n: 0, converted: 0 };
      acc[date].n += 1;
      if (isAgenciado(lead.status)) acc[date].converted += 1;
      return acc;
    }, {})).sort((a, b) => a.date.localeCompare(b.date));

    const weeklyByDate = {};
    leads.forEach((lead) => {
      const points = data.weeklyDataByCreator?.[lead.handle] || [];
      points.forEach((point) => {
        if (!weeklyByDate[point.date]) weeklyByDate[point.date] = { date: point.date, gmv: 0, comissao: 0, indiqueEarn: 0 };
        weeklyByDate[point.date].gmv += Number(point.gmv || 0);
        weeklyByDate[point.date].comissao += Number(point.comissao || 0);
        weeklyByDate[point.date].indiqueEarn += Number(point.indiqueEarn || 0);
      });
    });

    return NextResponse.json({
      indicador: { handle: session.handle, displayHandle },
      summary: {
        total: leads.length,
        totalAgenciados,
        conversionRate: leads.length ? Math.round((totalAgenciados / leads.length) * 100) : 0,
        totalGeneratedCommission,
        totalGmv,
        totalCom,
        byStatus,
        updatedAt: new Date().toISOString(),
      },
      leads: leads.sort((a, b) => String(fmtDateKey(b)).localeCompare(String(fmtDateKey(a)))),
      byDay,
      weeklyData: Object.values(weeklyByDate).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
