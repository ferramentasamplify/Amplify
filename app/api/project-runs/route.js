export const dynamic = "force-dynamic";

const VIRADA_PAYLOAD = {
  dry_run: false,
  reference_mode: "last_closed_month",
  approvals: [
    "APROVAR_NOTION_CLUB",
    "APROVAR_CIRCLE_CLUB",
    "APROVAR_TAGS_CIRCLE",
    "APROVAR_ALERTA_GABRIEL",
  ],
  circle_dm_mode: "off",
  enable_group_tag_sync: true,
  scheduled_run: false,
  manual_run_label: "hub_projetos_rodar_agora",
  source: "hub_projects_manual_button",
  safety_scope: "Virada manual via Hub: Notion + Circle access groups + tags. Sem e-mail e sem DM Circle.",
};

const timeoutSignal = (ms) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: timeoutSignal(15000),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {}
  return { ok: response.ok, status: response.status, body };
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const projectId = String(payload?.projectId || "").trim();
    const confirmation = String(payload?.confirmation || "").trim();

    if (confirmation !== "irreversible-confirmed") {
      return Response.json({ error: "confirmacao_obrigatoria" }, { status: 400 });
    }

    if (projectId === "virada-club") {
      const webhookUrl = process.env.RETCLUB_VIRADA_RUN_WEBHOOK_URL;
      if (!webhookUrl) {
        return Response.json({ error: "webhook_virada_nao_configurado" }, { status: 503 });
      }
      const result = await postWebhook(webhookUrl, {
        ...VIRADA_PAYLOAD,
        requested_at: new Date().toISOString(),
      });
      return Response.json({
        projectId,
        triggered: result.ok,
        webhook_status: result.status,
        result: result.body,
      }, { status: result.ok ? 202 : 502 });
    }

    if (projectId === "dashboard-retencao") {
      const webhookUrl = process.env.RETENCAO_DATABASE_REFRESH_WEBHOOK_URL;
      if (!webhookUrl) {
        return Response.json({
          error: "webhook_database_nao_configurado",
          detail: "O cron existe no host, mas ainda falta um webhook seguro para o Hub disparar o script local.",
        }, { status: 503 });
      }
      const result = await postWebhook(webhookUrl, {
        source: "hub_projects_manual_button",
        action: "refresh_retencao_database_now",
        requested_at: new Date().toISOString(),
      });
      return Response.json({
        projectId,
        triggered: result.ok,
        webhook_status: result.status,
        result: result.body,
      }, { status: result.ok ? 202 : 502 });
    }

    return Response.json({ error: "projeto_nao_suportado" }, { status: 404 });
  } catch (error) {
    return Response.json(
      { error: error?.message || "erro_ao_disparar_projeto" },
      { status: 500 }
    );
  }
}
