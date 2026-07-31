import fs from "node:fs";

const source = fs.readFileSync("components/ProjectsFlowView.js", "utf8");
const page = fs.readFileSync("app/hub/projetos/page.js", "utf8");

const requiredAreas = [
  "Aquisicao",
  "Growth",
  "Marketing e Trafego",
  "Retencao",
  "Vendas e Parcerias",
  "Projetos e Produto",
];

const requiredProjects = [
  "Cockpit de Aquisicao",
  "Creator CAC x LTV",
  "Growth Central",
  "Funis de Creators e Marcas",
  "Central de LPs",
  "Dashboard de Criativos Meta",
  "BAW TikTok Intelligence",
  "Amplify Club",
  "Indique e Ganhe",
  "Super Afiliado",
  "Mission Control da Amplify",
  "Calculadora de Margem TikTok Shop",
];

for (const marker of [
  "Hub de projetos",
  "portfolioItems",
  "portfolioAreas",
  "portfolioQuery",
  "visiblePortfolio",
  "Filtrar por area",
  "Fluxos detalhados",
]) {
  if (!source.includes(marker)) throw new Error(`Hub de projetos: faltou ${marker}`);
}
for (const area of requiredAreas) {
  if (!source.includes(area)) throw new Error(`Hub de projetos: area ausente: ${area}`);
}
for (const project of requiredProjects) {
  if (!source.includes(project)) throw new Error(`Hub de projetos: entrega ausente: ${project}`);
}
const ids = [...source.matchAll(/\n\s+id: "([^"]+)",\n\s+area: /g)].map((match) => match[1]);
if (ids.length < 22) throw new Error(`Hub de projetos: esperado ao menos 22 entregas, encontrado ${ids.length}`);
if (new Set(ids).size !== ids.length) throw new Error("Hub de projetos: IDs duplicados");
if (!page.includes("Hub de Projetos — Amplify Hub")) throw new Error("Metadata da rota nao foi atualizada");
console.log(`Hub de projetos: contrato ok (${ids.length} entregas, ${requiredAreas.length} areas)`);
