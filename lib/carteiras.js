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
 * 1. Rode `node scripts/sync-carteiras.js` (criar) — ele lê o /api/club-full,
 *    pega todos os handles e distribui round-robin entre os AMs como rascunho.
 * 2. Edite este arquivo pra ajustar manualmente.
 *
 * Fonte de verdade em produção: idealmente um campo `Account Manager` no Notion.
 * Por enquanto, este JSON é o source of truth e o /api/am/[slug]/carteira consome daqui.
 */

export const CARTEIRAS = {
  leonardo: [
    "_marigil",
    "mari.belezareal",
    "elenaratrindade",
    "bandeira7616",
    "jokimura",
    "empoderyas",
    "byluizdanyell",
    "rafaella.samara",
    "exitus.shop",
    "glowfit.club1",
  ],
  camila: [
    "mairaog",
    "carlaf.bitencourt",
    "nai.lenhardt",
    "luanna.gomide",
    "samara_1580",
    "alexxcreator",
    "nathesteta",
    "bdgroupshop",
    "realmente_thais",
    "marcelafranciscato",
  ],
  reserva_novo_am: [
    "byadrianams",
    "abner_mrios",
    "eu.julioindica",
    "planosdaka",
    "jotamatiotti",
  ],
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
