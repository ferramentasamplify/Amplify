import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Canva OAuth</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0b12; color: #f8fafc; margin: 0; padding: 32px; }
      main { max-width: 760px; margin: 0 auto; background: #14161f; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      p { color: rgba(248,250,252,.72); line-height: 1.5; }
      code, textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      textarea { width: 100%; min-height: 96px; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: #07080d; color: #f8fafc; padding: 12px; box-sizing: border-box; }
      .ok { color: #5eead4; }
      .err { color: #fca5a5; }
      .muted { color: rgba(248,250,252,.45); font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${error ? "Canva retornou erro" : "Canva autorizado"}</h1>
      ${
        error
          ? `<p class="err">${escapeHtml(error)}${errorDescription ? `: ${escapeHtml(errorDescription)}` : ""}</p>`
          : `<p class="ok">Autorização recebida. Envie o conteúdo abaixo para o agente em canal privado/seguro.</p>
             <label class="muted">OAuth code</label>
             <textarea readonly>${escapeHtml(code || "")}</textarea>
             <p class="muted">State: <code>${escapeHtml(state || "")}</code></p>`
      }
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
