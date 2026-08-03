import { NextResponse } from "next/server";
import { readSession } from "@/lib/am-auth";
import { AM_BY_SLUG, publicAmData } from "@/lib/am-config";
import { CARTEIRAS, CREATOR_MEETING_ALIASES } from "@/lib/carteiras";
import { listGamifications, notionRequest, propText } from "@/lib/gamifications";
import { queryNotionDatabase } from "@/lib/notion-query";
import {
  cleanHandle,
  defaultSnapshotPeriod,
  getRetencaoCanonicalGmvTimeline,
  getRetencaoCanonicalPeriod,
} from "@/lib/retencao-canonical-data";

export const dynamic = "force-dynamic";

const CREATORS_DB = "2efb0bbef153811b946ddf8f0fff81a3";
const MEETINGS_DATA_SOURCE_ID = process.env.RETENCAO_MEETINGS_DATA_SOURCE_ID || "";
const STOP_NAME_TOKENS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

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
const daysBetweenISO = (from, to) => {
  if (!from || !to) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 86400000));
};

const handleFilter = (handle) => ({
  property: "Qual seu @ do TikTok?",
  rich_text: { contains: handle },
});

const textFromRichText = (items = []) => (items || []).map((item) => item?.plain_text || item?.text?.content || "").join("").trim();

const creatorName = (props) =>
  props["Nome Completo"]?.rich_text?.[0]?.plain_text ||
  props["Nome"]?.title?.[0]?.plain_text ||
  props["Qual "]?.title?.[0]?.plain_text ||
  "";
const propDateValue = (prop) => prop?.date?.start || prop?.created_time || null;
const firstDateProp = (props, names) => {
  for (const name of names) {
    const value = propDateValue(props[name]);
    if (value) return String(value).slice(0, 10);
  }
  return null;
};
const firstTextProp = (props, names) => {
  for (const name of names) {
    const value = textFromRichText(props[name]?.rich_text) || props[name]?.select?.name || props[name]?.status?.name || props[name]?.title?.[0]?.plain_text;
    if (value) return value;
  }
  return null;
};

const normalizeLoose = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/@/g, "")
    .replace(/https?:\/\/(www\.)?tiktok\.com\//g, "")
    .replace(/[^a-z0-9._\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactLoose = (value) => normalizeLoose(value).replace(/[\s._-]+/g, "");

const nameTokens = (value) =>
  normalizeLoose(value)
    .split(/[\s._-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_NAME_TOKENS.has(token));

function profileAliases(handle, creator) {
  return [
    handle,
    creator?.handle,
    creator?.nome,
    ...(CREATOR_MEETING_ALIASES[handle] || []),
  ].filter(Boolean);
}

function textMatchesProfile(value, aliases) {
  const normalizedValue = normalizeLoose(value);
  const compactValue = compactLoose(value);
  if (!normalizedValue) return false;

  for (const alias of aliases) {
    const normalizedAlias = normalizeLoose(alias);
    const compactAlias = compactLoose(alias);
    if (!normalizedAlias) continue;
    if (compactValue && compactAlias && (compactValue.includes(compactAlias) || compactAlias.includes(compactValue))) return true;

    const valueTokens = nameTokens(normalizedValue);
    const aliasTokens = nameTokens(normalizedAlias);
    if (!valueTokens.length || !aliasTokens.length) continue;
    const shared = valueTokens.filter((token) => aliasTokens.includes(token)).length;
    const shorter = Math.min(valueTokens.length, aliasTokens.length);
    if (shared >= Math.min(2, shorter) && shared / shorter >= 0.67) return true;
  }

  return false;
}

async function fetchCreatorProfile(handle) {
  const res = await queryNotionDatabase(CREATORS_DB, {
    page_size: 20,
    filter: handleFilter(handle),
  });
  const match = (res.results || []).find((page) => cleanHandle(page.properties?.["Qual seu @ do TikTok?"]?.rich_text?.[0]?.plain_text) === handle);
  if (!match) return null;

  const p = match.properties || {};
  return {
    id: match.id,
    notionUrl: match.url || `https://www.notion.so/${match.id.replace(/-/g, "")}`,
    nome: creatorName(p) || handle,
    handle,
    categoria: p["Categoria Amplify Club"]?.select?.name || "Start",
    nicho:
      p["Nicho"]?.select?.name ||
      p["Nicho"]?.multi_select?.[0]?.name ||
      p["Categoria"]?.select?.name ||
      "A definir",
    whatsapp: p["WhatsApp"]?.phone_number || p["WhatsApp"]?.rich_text?.[0]?.plain_text || null,
    email: p["E-mail"]?.email || p["Email"]?.email || p["E-mail"]?.rich_text?.[0]?.plain_text || null,
    fase: p["Fase"]?.status?.name || p["Fase"]?.select?.name || p["Status"]?.status?.name || null,
    lifecycle: {
      joinedAt: firstDateProp(p, ["Data de entrada", "Entrada Amplify", "Entrada", "Data de vínculo", "Data de Vinculo", "Início", "Inicio"]),
      leftAt: firstDateProp(p, ["Data de saída", "Data de Saida", "Saída Amplify", "Saida Amplify", "Saída", "Saida", "Churn"]),
      returnedAt: firstDateProp(p, ["Data de retorno", "Retorno Amplify", "Retorno", "Reativação", "Reativacao"]),
      status: firstTextProp(p, ["Status do vínculo", "Status do Vinculo", "Status", "Fase"]),
    },
  };
}

const meetingDate = (page) => propText(page.properties?.Data) || page.created_time;

function normalizeMeeting(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    title: propText(p.Nome) || "Acompanhamento",
    creator: propText(p.Creator),
    type: propText(p.Tipo) || propText(p.Origem) || "Reunião",
    category: propText(p.Categoria),
    date: meetingDate(page),
    summary: propText(p["Resumo da call"]),
    nextStep: propText(p["Próximo passo"]),
    followUpStatus: propText(p["Status do follow-up"]),
    url: propText(p["Link da Reunião"]) || page.url,
  };
}

async function fetchMeetings({ handle, creator }) {
  if (!MEETINGS_DATA_SOURCE_ID) return { ok: false, items: [], message: "RETENCAO_MEETINGS_DATA_SOURCE_ID ausente." };

  const aliases = profileAliases(handle, creator);
  try {
    const results = [];
    let start_cursor;
    do {
      const data = await notionRequest(`data_sources/${MEETINGS_DATA_SOURCE_ID}/query`, {
        method: "POST",
        body: {
          page_size: 100,
          ...(start_cursor ? { start_cursor } : {}),
          sorts: [{ property: "Data", direction: "descending" }],
        },
      });
      results.push(...(data.results || []));
      start_cursor = data.has_more ? data.next_cursor : null;
    } while (start_cursor);

    const items = results
      .filter((page) => {
        const p = page.properties || {};
        const relationIds = propText(p["Creator (perfil)"]);
        if (creator?.id && Array.isArray(relationIds) && relationIds.includes(creator.id)) return true;
        return [
          propText(p.Handle),
          propText(p.Creator),
          propText(p.Nome),
        ].some((value) => textMatchesProfile(value, aliases));
      })
      .map(normalizeMeeting)
      .slice(0, 30);

    return { ok: true, items, message: "Reuniões carregadas por relação, handle, alias e nome do creator." };
  } catch (error) {
    return { ok: false, items: [], message: error.message };
  }
}

function relatedGamifications(items, handle) {
  return (items || [])
    .filter((item) => {
      const hay = `${item.name} ${item.brand} ${item.objective} ${item.target} ${item.incentive}`.toLowerCase();
      const participantText = String(item.handlesParticipantes || "").toLowerCase();
      return participantText.includes(handle) || hay.includes(handle) || item.access === "Aberta ao clube inteiro";
    })
    .slice(0, 12);
}

function buildCreatorTimeline({ from, to, previousFrom, previousTo, handle }) {
  const currentTimeline = getRetencaoCanonicalGmvTimeline({ from, to, handles: new Set([handle]) });
  const previousTimeline = getRetencaoCanonicalGmvTimeline({ from: previousFrom, to: previousTo, handles: new Set([handle]) });
  const previousPoints = previousTimeline.points || [];
  const points = (currentTimeline.points || []).map((point, index) => {
    const previousPoint = previousPoints[index] || {};
    return {
      date: point.date,
      previousDate: previousPoint.date || null,
      gmv: Number(point.creators?.[handle] || 0),
      previousGmv: Number(previousPoint.creators?.[handle] || 0),
      orders: 0,
      liveGmv: Number(point.creatorChannels?.[handle]?.liveGmv || 0),
      videoGmv: Number(point.creatorChannels?.[handle]?.videoGmv || 0),
      directGmv: Number(point.creatorChannels?.[handle]?.directGmv || 0),
      status: point.status,
      source: point.source,
    };
  });
  return {
    mode: currentTimeline.mode,
    label: currentTimeline.label,
    previousPeriod: { from: previousFrom, to: previousTo },
    points,
    warnings: [...new Set([...(currentTimeline.warnings || []), ...(previousTimeline.warnings || [])])],
  };
}

function buildRolling30Timeline({ from, to, handle }) {
  const rollingFrom = addDaysISO(from, -29);
  const dailyTimeline = getRetencaoCanonicalGmvTimeline({ from: rollingFrom, to, handles: new Set([handle]) });
  const dailyValues = [];
  let previous = 0;
  for (const point of dailyTimeline.points || []) {
    const cumulative = Number(point.creators?.[handle] || 0);
    dailyValues.push({ date: point.date, daily: Math.max(0, cumulative - previous), status: point.status, source: point.source });
    previous = cumulative;
  }
  const points = dailyValues
    .map((point, index) => ({
      date: point.date,
      rolling30Gmv: dailyValues
        .slice(Math.max(0, index - 29), index + 1)
        .reduce((acc, item) => acc + Number(item.daily || 0), 0),
      status: point.status,
      source: point.source,
    }))
    .filter((point) => point.date >= from);

  return {
    mode: "rolling_30_day_gmv",
    label: "GMV dos últimos 30 dias por dia",
    points,
    warnings: dailyTimeline.warnings || [],
  };
}

function buildLifecycle(creator, coverage) {
  const raw = creator?.lifecycle || {};
  const inferredJoinedAt = !raw.joinedAt && coverage?.from ? coverage.from : null;
  const joinedAt = raw.joinedAt || inferredJoinedAt;
  const leftAt = raw.leftAt || null;
  const returnedAt = raw.returnedAt || null;
  const linkedUntil = leftAt || coverage?.to || new Date().toISOString().slice(0, 10);
  return {
    joinedAt,
    joinedAtInferred: Boolean(inferredJoinedAt),
    leftAt,
    returnedAt,
    status: raw.status || null,
    hasChurned: Boolean(leftAt),
    hasReturned: Boolean(leftAt && returnedAt),
    linkedDays: joinedAt ? daysBetweenISO(joinedAt, linkedUntil) + 1 : null,
    inactiveDaysBeforeReturn: leftAt && returnedAt ? daysBetweenISO(leftAt, returnedAt) : null,
    source: raw.joinedAt || leftAt || returnedAt
      ? "notion_creator_profile"
      : inferredJoinedAt
        ? "partner_center_first_valid_coverage"
        : "notion_fields_missing",
  };
}

export async function GET(req, { params }) {
  try {
    const { slug, handle: rawHandle } = await params;
    const target = AM_BY_SLUG[slug];
    if (!target) return NextResponse.json({ error: "AM inválido." }, { status: 404 });

    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Sessão ausente. Faça login." }, { status: 401 });
    if (session.slug !== slug && !session.am.isAdmin) return NextResponse.json({ error: "Sem permissão pra ver esse perfil." }, { status: 403 });

    const handle = cleanHandle(decodeURIComponent(rawHandle || ""));
    const carteira = new Set((CARTEIRAS[slug] || []).map(cleanHandle));
    if (!handle || (!carteira.has(handle) && !session.am.isAdmin)) {
      return NextResponse.json({ error: "Creator fora da carteira." }, { status: 403 });
    }

    const url = new URL(req.url);
    const defaultPeriod = defaultSnapshotPeriod();
    const fromDate = url.searchParams.get("from") || defaultPeriod.from;
    const toDate = url.searchParams.get("to") || defaultPeriod.to;
    const previousFrom = addMonthsISO(fromDate, -1);
    const previousTo = addMonthsISO(toDate, -1);

    const [creatorResult, salesSnapshot, gamificationPayload] = await Promise.all([
      fetchCreatorProfile(handle).then((profile) => ({ ok: true, profile })).catch((error) => ({ ok: false, profile: null, error })),
      Promise.resolve(getRetencaoCanonicalPeriod({ from: fromDate, to: toDate, handles: new Set([handle]) })),
      listGamifications().catch((error) => ({ items: [], error: error.message })),
    ]);
    const creator = creatorResult.profile;
    const sale = salesSnapshot.byHandle[handle] || {};
    const gmv = Number(sale.gmv || 0);
    const comissao = Number(sale.comissao || 0);
    const meetings = await fetchMeetings({ handle, creator });
    const timeline = buildCreatorTimeline({
      from: salesSnapshot.coverage?.from || fromDate,
      to: salesSnapshot.coverage?.to || toDate,
      previousFrom,
      previousTo,
      handle,
    });
    const rolling30Timeline = buildRolling30Timeline({
      from: salesSnapshot.coverage?.from || fromDate,
      to: salesSnapshot.coverage?.to || toDate,
      handle,
    });
    const lifecycle = buildLifecycle(creator, salesSnapshot.coverage || { from: fromDate, to: toDate });
    const timelineWarnings = [...new Set([
      ...(timeline.warnings || []),
      ...(rolling30Timeline.warnings || []),
    ])];
    const primaryWarnings = [...new Set([
      ...(salesSnapshot.warnings || []),
    ])];
    const auxiliaryWarnings = [...new Set([
      ...(creatorResult.ok ? [] : [`Notion indisponivel: ${creatorResult.error.message}`]),
    ])];

    return NextResponse.json({
      am: publicAmData(target),
      creator: creator || {
        id: `partner-center-${handle}`,
        nome: handle,
        handle,
        categoria: "Sem cadastro",
        nicho: "A definir",
        notionUrl: null,
      },
      metrics: {
        gmv,
        comissao,
        commissionRate: gmv > 0 ? (comissao / gmv) * 100 : 0,
        orders: Number(sale.orders || 0),
        liveGmv: Number(sale.liveGmv || 0),
        videoGmv: Number(sale.videoGmv || 0),
        directGmv: Number(sale.directGmv || 0),
        commissionBase: Number(sale.commissionBase || 0),
        amplifyRevenue: comissao * 0.1,
        lastUpdate: sale.lastUpdate || null,
      },
      channelBreakdown: [
        { label: "Live", value: Number(sale.liveGmv || 0) },
        { label: "Vídeo", value: Number(sale.videoGmv || 0) },
        { label: "Direto", value: Number(sale.directGmv || 0) },
      ],
      timeline,
      rolling30Timeline,
      lifecycle,
      meetings,
      gamifications: {
        ok: !gamificationPayload.error,
        message: gamificationPayload.error || "Gamificações carregadas.",
        items: relatedGamifications(gamificationPayload.items || [], handle),
      },
      dataFreshness: {
        canonicalLayer: "retencao-canonical-data",
        requestedPeriod: salesSnapshot.requested,
        effectiveCoverage: salesSnapshot.coverage,
        availablePeriods: salesSnapshot.availablePeriods,
        warnings: primaryWarnings,
        auxiliaryWarnings,
        secondaryWarnings: {
          timeline: timelineWarnings,
          rolling30: rolling30Timeline.warnings || [],
        },
        status: primaryWarnings.length ? "DEGRADED" : "OK",
        message: "GMV, comissão e pedidos vêm do Partner Center/base canônica. Notion entra como dimensão auxiliar.",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[creator-profile]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
