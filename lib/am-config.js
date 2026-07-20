/**
 * Configuração dos Account Managers do Amplify Club.
 *
 * - slug:        identificador curto usado em URLs (/club/am/[slug])
 * - displayName: nome exibido nas telas
 * - passwordHash: hash bcrypt da senha do AM (gere com `node scripts/hash-password.js "senha"`)
 * - photo:       URL pública da foto (avatar) — usada no cavalinho da corrida
 * - accentColor: cor temática do AM na central
 * - emoji:       emoji fallback caso a foto não carregue
 * - notionProfileUrl: link pro perfil/hub do AM (opcional)
 *
 * Para ADICIONAR um AM novo: copie um bloco, troque slug/nome, gere um hash novo,
 * salve em AM_PASSWORD_<SLUG> no .env do Netlify (ex: AM_PASSWORD_LEONARDO=hash).
 *
 * Para TROCAR a senha: gere novo hash e atualize a env var correspondente.
 *
 * NOTA: a `passwordHash` aqui é só fallback. O login real checa primeiro a env var
 * `AM_PASSWORD_<SLUG>` (mais seguro: não vai pro git) e, se não existir, usa este hash.
 */

export const ACCOUNT_MANAGERS = [
  {
    slug: "leonardo",
    displayName: "Leonardo Ávila",
    shortName: "Leonardo",
    role: "Account Manager · Amplify Club",
    photo: "", // ex: "/avatars/leonardo.jpg" — subir em /public
    accentColor: "#3b82f6",
    emoji: "🦊",
    notionProfileUrl: "",
    passwordHash: "$2b$10$otvY.i3WCNaqRyh3Wlju0.4jJEDtc5c5JSA.j7VrJtn/ZZRU33IPS", // fallback se env AM_PASSWORD_LEONARDO nao estiver disponivel
  },
  {
    slug: "camila",
    displayName: "Camila Souza",
    shortName: "Camila",
    role: "Account Manager · Amplify Club",
    photo: "",
    accentColor: "#ec4899",
    emoji: "🌸",
    notionProfileUrl: "",
    passwordHash: "$2b$10$ZWqTtuYHDNSQxpb5nOhJxO4v8Fgav6f4vCmPOQRVfG3Zy8odJBsNi",
  },
  {
    slug: "gabriel",
    displayName: "Gabriel (Admin)",
    shortName: "Gabriel",
    role: "Lider · Retenção",
    photo: "",
    accentColor: "#a855f7",
    emoji: "🛡️",
    notionProfileUrl: "",
    passwordHash: "$2b$10$Kk0ymNBR6ovb.obQGDDnWOXOLzzyzsq2PvBnm44z3dVpjuWU6eChe", // admin — pode ver tudo, inclusive central sem precisar de AM específico
    isAdmin: true,
  },
  {
    slug: "reserva_novo_am",
    displayName: "Novo AM (Reserva)",
    shortName: "Reserva",
    role: "Account Manager · Carteira em transição",
    photo: "",
    accentColor: "#10b981",
    emoji: "🧭",
    notionProfileUrl: "",
    passwordHash: "$2b$10$ShhOgIotsTenNjH1RS57QuyYbJFyFRuHZD6cyui8C726XNQywIVEu", // fallback temporario; preferir env em producao
    isPlaceholder: true,
    supervisedBy: "leonardo",
  },
];

/** Lookup rápido por slug */
export const AM_BY_SLUG = Object.fromEntries(
  ACCOUNT_MANAGERS.map((am) => [am.slug, am]),
);

/** Lista apenas AMs "operacionais" (não-admin) — usada na corrida */
export const RACE_PARTICIPANTS = ACCOUNT_MANAGERS.filter((am) => !am.isAdmin);

/** Cookie name da sessão AM */
export const AM_SESSION_COOKIE = "am_session";

/** TTL da sessão (8h) */
export const AM_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Retorna a senha esperada para o slug (env primeiro, fallback pro hash estático) */
export function getAmSecret(slug) {
  const envKey = `AM_PASSWORD_${slug.toUpperCase()}`;
  return process.env[envKey] || AM_BY_SLUG[slug]?.passwordHash || "";
}

/** Retorna dados públicos do AM (sem hash) */
export function publicAmData(am) {
  if (!am) return null;
  const { passwordHash, ...pub } = am;
  return pub;
}
