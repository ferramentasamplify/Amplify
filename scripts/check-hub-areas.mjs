import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const required = [
  "components/HubAreasHome.js",
  "components/HubAreaView.js",
  "lib/hub-areas.js",
  "lib/hub-area-metrics.js",
  "app/api/hub-summary/route.js",
  "app/hub/area/[slug]/page.js",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`arquivo ausente: ${file}`);
}

const home = read("components/HubAreasHome.js");
const detail = read("components/HubAreaView.js");
const data = read("lib/hub-areas.js");
const metrics = read("lib/hub-area-metrics.js");
const summary = read("app/api/hub-summary/route.js");
const page = read("app/hub/page.js");
const ordered = [data.indexOf('id: "growth"'), data.indexOf('id: "marketing"'), data.indexOf('id: "social-media"')];
if (ordered.some((index) => index < 0) || !(ordered[0] < ordered[1] && ordered[1] < ordered[2])) throw new Error("ordem superior invalida");
if (!page.includes("HubAreasHome") || page.includes("HubPortfolio")) throw new Error("home nao usa mapa por areas");
if (!home.includes("KRs · Mission Control") || !home.includes("metricsForArea")) throw new Error("home nao exibe KR/KPI do Mission Control");
if (!summary.includes("127.0.0.1:3016/api/executive-overview") || !summary.includes("missionControl")) throw new Error("summary nao compartilha a fonte do Mission Control");
if (!metrics.includes("summary?.missionControl?.areas") || !metrics.includes("krProgress")) throw new Error("metricas nao usam contrato do Mission Control");
if (!detail.includes('title="Ferramentas"') || !detail.includes('title="Outros links"')) throw new Error("grupos de links ausentes");
if (!detail.includes("Biblioteca compartilhada") || !detail.includes("amplify-hub-area-library:v1") || !detail.includes("Gerenciar ferramentas e links")) throw new Error("selecao cruzada de links ausente");
if (!detail.includes("normalizeAreaSelection") || !detail.includes("hiddenIds") || !detail.includes("Remover ${app.title} desta area")) throw new Error("remocao e restauracao de acessos ausentes");
if (!data.includes("https://amplifyos.up.railway.app")) throw new Error("AmplifyOS nao esta na Aquisicao");
if (!data.includes('"Projetos e Fluxos"') || !data.includes('"/hub/projetos"')) throw new Error("Projetos e Fluxos nao foi preservado como destino");
if (!data.includes("Os sistemas desta area permanecem nos locais criados pelo Gabriel")) throw new Error("regra de preservacao ausente");
const ids = [...data.matchAll(/^\s{4}id: "([^"]+)",$/gm)].map((match) => match[1]);
if (ids.length !== 8) throw new Error(`esperava 8 areas, recebeu ${ids.length}`);
for (const marker of ["growth-creator-leads", "marketing-instagram", "social-instagram", "aquisicao-novos-creators", "vendas-revenue", "retencao-gmv-cap", "projetos-tsp-revenue"]) {
  if (!data.includes(marker)) throw new Error(`KR do Mission Control ausente: ${marker}`);
}
console.log(`Hub por areas: contrato KR/KPI + biblioteca ok (${ids.join(" -> ")})`);
