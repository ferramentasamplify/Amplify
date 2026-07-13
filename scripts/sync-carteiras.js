#!/usr/bin/env node
/**
 * scripts/sync-carteiras.js
 *
 * Lê todos os creators do Notion via /api/club-full e distribui ROUND-ROBIN
 * entre os AMs do lib/carteiras.js (Leonardo / Camila), escrevendo de volta
 * com handles limpos. É só um rascunho inicial — você ajusta manualmente.
 *
 * Uso:
 *   1) Garanta que o site tá rodando em http://localhost:3000
 *      (npm run dev)
 *   2) Rode: node scripts/sync-carteiras.js
 *   3) Abra lib/carteiras.js e ajuste conforme necessário.
 */

const fs = require("node:fs");
const path = require("node:path");
const SITE = process.env.SITE_URL || "http://localhost:3000";

(async () => {
  console.log("→ Buscando creators em", SITE + "/api/club-full");
  const res = await fetch(SITE + "/api/club-full");
  if (!res.ok) {
    console.error("Erro:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const creators = data.creators || [];
  console.log("✓ Creators encontrados:", creators.length);

  // Round-robin entre os AMs "operacionais"
  const slugs = ["leonardo", "camila"];
  const map = Object.fromEntries(slugs.map((s) => [s, []]));
  creators.forEach((c, i) => {
    const s = slugs[i % slugs.length];
    map[s].push(c.handle);
  });

  const conteudo = `/**
 * Mapeamento de carteira: cada creator (handle) → qual Account Manager cuida.
 * GERADO AUTOMATICAMENTE por scripts/sync-carteiras.js em ${new Date().toISOString()}
 * Ajuste manualmente conforme necessário.
 */

export const CARTEIRAS = {
${slugs.map((s) => `  ${s}: [\n${map[s].map((h) => `    "${h}",`).join("\n")}\n  ],`).join("\n")}
};

/** Inverte o mapa: handle → slug do AM */
export const HANDLE_TO_AM = (() => {
  const out = {};
  for (const [slug, handles] of Object.entries(CARTEIRAS)) {
    for (const h of handles) {
      if (h) out[String(h).toLowerCase().replace(/^@/, "").trim()] = slug;
    }
  }
  return out;
})();

/** Retorna o slug do AM dono de um creator, ou null se não tem carteira definida */
export function getAmForHandle(handle) {
  if (!handle) return null;
  const norm = String(handle).toLowerCase().replace(/^@/, "").trim();
  return HANDLE_TO_AM[norm] || null;
}

/** Quantos creators cada AM tem na carteira */
export function carteiraSizes() {
  return Object.fromEntries(
    Object.entries(CARTEIRAS).map(([slug, list]) => [slug, list.length]),
  );
}
`;

  const outPath = path.resolve(__dirname, "..", "lib", "carteiras.js");
  fs.writeFileSync(outPath, conteudo, "utf8");
  console.log("✓ lib/carteiras.js atualizado:", outPath);
  console.log("  Leonardo:", map.leonardo.length, "creators");
  console.log("  Camila:  ", map.camila.length, "creators");
})();