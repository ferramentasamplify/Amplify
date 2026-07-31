/**
 * Mapeamento de carteira: cada creator (handle) → qual Account Manager cuida.
 *
 * Esta é uma config editável à mão. Estrutura sugerida:
 *
 *   "leonardo": [
 *     "creator_handle_1",
 *     "creator_handle_2",
 *     ...
 *   ],
 *
 * Para preencher em escala:
 * 1. Rode `node scripts/sync-carteiras.js` (criar) — ele usa a base canônica
 *    Retenção/TikTok Shop para pegar handles e distribuir como rascunho.
 * 2. Edite este arquivo pra ajustar manualmente.
 *
 * Fonte de verdade de dinheiro: retencao-canonical-data / Partner Center.
 * Fonte de verdade de carteira: idealmente um campo `Account Manager` no Notion.
 * Por enquanto, este JSON é a dimensão auxiliar de carteira.
 */

export const CARTEIRAS = {
  leonardo: [
    "_marigil",
    "jotamatiotti",
    "byluizdanyell",
    "empoderyas",
    "byadrianams",
    "glowfit.club1",
    "planosdaka",
    "exitus.shop",
    "elenaratrindade",
    "mari.belezareal",
    "bandeira7616",
    "rafaella.samara",
    "jokimura",
  ],
  camila: [
    "marcelafranciscato",
    "nai.lenhardt",
    "realmente_thais",
    "bdgroupshop",
    "luanna.gomide",
    "mairaog",
    "nathesteta",
    "alexxcreator",
    "carlaf.bitencourt",
    "aryane_creator",
    "viral.que.vende",
  ],
};

export const CREATOR_MEETING_ALIASES = {
  "exitus.shop": ["André Oliveira", "Andre Oliveira", "Raudisléia Silva Brito de Oliveira"],
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
