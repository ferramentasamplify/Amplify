const CREATOR_FIXTURES = [
  ["_marigil", "Marigil", "Diamond", "Beleza", "2026-07-22", 348200, 286400, 31980],
  ["marcelafranciscato", "Marcela Franciscato", "Diamond", "Moda", "2026-08-04", 311900, 298500, 28740],
  ["jotamatiotti", "Jota Matiotti", "Diamond", "Tech", "2026-08-18", 289700, 244100, 25480],
  ["empoderyas", "Empoder Yas", "Diamond", "Lifestyle", "2026-07-31", 265300, 276400, 23890],
  ["byluizdanyell", "Luiz Danyell", "Diamond", "Casa e decor", "2026-09-06", 246800, 201700, 21920],
  ["realmente_thais", "Realmente Thais", "Diamond", "Achadinhos", "2026-07-27", 239500, 278900, 20830],
  ["byadrianams", "Adriana MS", "Diamond", "Moda", "2026-08-21", 225700, 197600, 20260],
  ["nai.lenhardt", "Nai Lenhardt", "Diamond", "Beleza", "2026-09-14", 211400, 232800, 19020],
  ["abner_mrios", "Abner M. Rios", "Diamond", "Eletronicos", "2026-08-29", 198600, 171300, 17870],
  ["carlaf.bitencourt", "Carla F. Bitencourt", "Diamond", "Fitness", "2026-10-02", 184900, 166000, 16640],
  ["mari.belezareal", "Mari Beleza Real", "Diamond", "Beleza", "2026-08-09", 242500, 214300, 22110],
  ["elenaratrindade", "Elena R. Trindade", "Diamond", "Moda", "2026-07-25", 229100, 236700, 20230],
  ["bandeira7616", "Bandeira 7616", "Diamond", "Achadinhos", "2026-09-03", 217800, 181200, 19600],
  ["jokimura", "Jo Kimura", "Diamond", "Casa e decor", "2026-08-15", 205600, 194900, 18090],
  ["exitus.shop", "Exitus Shop", "Diamond", "Eletronicos", "2026-08-30", 196400, 157800, 17160],
  ["samara_1580", "Samara 1580", "Diamond", "Lifestyle", "2026-09-18", 183200, 171100, 16080],
  ["rafaella.samara", "Rafaella Samara", "Diamond", "Skincare", "2026-07-29", 176900, 190400, 14920],
  ["bdgroupshop", "BD Group Shop", "Diamond", "Casa e decor", "2026-10-07", 165300, 139600, 14340],
  ["prifelipe.oficial", "Pri Felipe Oficial", "Diamond", "Fitness", "2026-08-26", 154700, 148800, 13390],
  ["luanna.gomide", "Luanna Gomide", "Diamond", "Moda", "2026-09-11", 142400, 131900, 12160],
  ["alexxcreator", "Alexx Creator", "Diamond", "Achadinhos", "2026-08-02", 168800, 121400, 14570],
  ["nathesteta", "Nath Esteta", "Diamond", "Beleza", "2026-07-24", 159600, 174100, 13280],
  ["samialimatiktokshop", "Samia Lima TikTok Shop", "Diamond", "Casa e decor", "2026-09-22", 148900, 116200, 12690],
  ["glowfit.club1", "Glowfit Club", "Diamond", "Fitness", "2026-08-12", 137300, 128000, 11140],
  ["eu.julioindica", "Julio Indica", "Diamond", "Eletronicos", "2026-10-01", 126800, 103500, 10190],
  ["mairaog", "Maira OG", "Diamond", "Lifestyle", "2026-08-19", 113900, 147300, 8970],
];

export const DEMO_CREATORS = CREATOR_FIXTURES.map(
  ([handle, nome, categoria, nicho, contractEnd, currentGmv, previousGmv, comissao]) => ({
    handle,
    nome,
    categoria,
    nicho,
    notionUrl: null,
    contractEnd,
    currentGmv,
    previousGmv,
    comissao,
    source: "demo",
    sourceLabel: "Dado demonstrativo para apresentação",
  }),
);

export const DEMO_CREATORS_BY_HANDLE = Object.fromEntries(
  DEMO_CREATORS.map((creator) => [creator.handle, creator]),
);

export function demoCreatorsForHandles(handles) {
  return handles
    .map((handle) => DEMO_CREATORS_BY_HANDLE[String(handle).toLowerCase().replace(/^@/, "").trim()])
    .filter(Boolean);
}

export function demoInsight(creator) {
  if (!creator) return "Sem historico suficiente.";
  const delta = creator.currentGmv - creator.previousGmv;
  const pct = creator.previousGmv > 0 ? (delta / creator.previousGmv) * 100 : 0;
  if (pct >= 12) return `Faturamento subindo ${pct.toFixed(1)}% vs. mes anterior. Priorizar expansao.`;
  if (pct <= -8) return `Faturamento caindo ${Math.abs(pct).toFixed(1)}% vs. mes anterior. Pede plano de retomada.`;
  return `Faturamento estavel (${pct.toFixed(1)}% vs. mes anterior). Manter cadencia.`;
}
