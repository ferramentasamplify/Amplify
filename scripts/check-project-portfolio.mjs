import fs from "node:fs";

const hub = fs.readFileSync("components/HubView.js", "utf8");
const portfolio = fs.readFileSync("components/HubPortfolio.js", "utf8");
const flows = fs.readFileSync("components/ProjectsFlowView.js", "utf8");
const flowPage = fs.readFileSync("app/hub/projetos/page.js", "utf8");

for (const marker of [
  "Hub da Amplify",
  "Numeros da operacao",
  "HubPortfolio",
  "Leituras ao vivo",
  "Resumo dos principais modulos",
]) {
  if (!hub.includes(marker)) throw new Error(`Home do Hub: faltou ${marker}`);
}
for (const forbidden of ["LoginScreen", "NEXT_PUBLIC_HUB_PASSWORD", "Senha de acesso"]) {
  if (hub.includes(forbidden)) throw new Error(`Home do Hub ainda contem auth antiga: ${forbidden}`);
}

const requiredAreas = ["Aquisicao", "Growth", "Marketing e Trafego", "Retencao", "Vendas e Parcerias", "Projetos e Produto"];
const requiredEntries = [
  "Cockpit de Aquisicao",
  "Dashboard de Aquisicao",
  "Creator CAC x LTV",
  "Growth Central",
  "Funis de Creators e Marcas",
  "Central de LPs",
  "Dashboard de Criativos Meta",
  "BAW TikTok Intelligence",
  "Amplify Club",
  "Indique e Ganhe",
  "Super Afiliado",
  "Gamificacoes",
  "Proposta Comercial Laiz",
  "Projetos e Fluxos",
  "Mission Control da Amplify",
  "Calculadora de Margem TikTok Shop",
];
for (const marker of [...requiredAreas, ...requiredEntries, "Buscar dashboard, LP, sistema..."]) {
  if (!portfolio.includes(marker)) throw new Error(`Navegacao do Hub: faltou ${marker}`);
}
const ids = [...portfolio.matchAll(/\n\s+\{ id: "([^"]+)", area: /g)].map((match) => match[1]);
if (ids.length < 27) throw new Error(`Navegacao do Hub: esperado ao menos 27 acessos, encontrado ${ids.length}`);
if (new Set(ids).size !== ids.length) throw new Error("Navegacao do Hub: IDs duplicados");

if (!flows.includes("Projetos e fluxos")) throw new Error("Pagina Projetos e Fluxos perdeu seu titulo original");
if (!flows.includes("Central visual dos projetos recorrentes")) throw new Error("Pagina Projetos e Fluxos perdeu sua descricao original");
for (const forbidden of ["Hub de projetos", "portfolioItems", "portfolioAreas", "portfolioQuery"]) {
  if (flows.includes(forbidden)) throw new Error(`Portfolio ainda contaminando Projetos e Fluxos: ${forbidden}`);
}
if (!flowPage.includes("Projetos e Fluxos — Amplify Hub")) throw new Error("Metadata original de Projetos e Fluxos nao foi restaurada");

console.log(`Hub principal: contrato ok (${ids.length} acessos, ${requiredAreas.length} areas, sem senha; Projetos e Fluxos restaurado)`);
