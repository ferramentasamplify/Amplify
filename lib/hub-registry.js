import fs from "node:fs";
import path from "node:path";
import { HUB_AREAS } from "./hub-areas.js";

export const HUB_REGISTRY_SEED_PATH = path.join(process.cwd(), "data", "hub-registry.json");
export const HUB_REGISTRY_PATH = process.env.HUB_REGISTRY_PATH || path.join(process.cwd(), "data", "hub-registry.runtime.json");
export const HUB_REGISTRY_SCHEMA_VERSION = 1;
export const HUB_REGISTRY_CATEGORIES = ["tool", "link"];
export const HUB_REGISTRY_HEALTH = ["healthy", "attention", "stale", "offline", "unknown"];

const AREA_IDS = new Set(HUB_AREAS.map((area) => area.id));
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX = {
  title: 120,
  description: 600,
  kind: 80,
  status: 50,
  owner: 100,
  dataOwner: 140,
  source: 240,
  period: 120,
  cadence: 80,
  href: 500,
};

export class HubRegistryError extends Error {
  constructor(message, status = 400, code = "invalid_registry") {
    super(message);
    this.name = "HubRegistryError";
    this.status = status;
    this.code = code;
  }
}

function cleanString(value, field, { required = true, max = MAX[field] || 200 } = {}) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (required && !clean) throw new HubRegistryError(`${field} e obrigatorio.`);
  if (clean.length > max) throw new HubRegistryError(`${field} deve ter no maximo ${max} caracteres.`);
  return clean;
}

function normalizeHref(value) {
  const href = cleanString(value, "href");
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return href;
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    throw new HubRegistryError("href deve ser uma rota interna ou URL http(s) valida.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HubRegistryError("href aceita somente http(s) ou rota interna.");
  }
  return parsed.toString();
}

function normalizeIso(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HubRegistryError(`${field} deve ser uma data ISO valida.`);
  return parsed.toISOString();
}

function normalizeAreas(value) {
  if (!Array.isArray(value)) throw new HubRegistryError("areas deve ser uma lista.");
  const areas = [...new Set(value.map((area) => String(area).trim()).filter(Boolean))];
  if (!areas.length) throw new HubRegistryError("Selecione ao menos uma area.");
  const invalid = areas.filter((area) => !AREA_IDS.has(area));
  if (invalid.length) throw new HubRegistryError(`Areas invalidas: ${invalid.join(", ")}.`);
  return areas;
}

function normalizeOrder(value, areas) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(areas.map((area, index) => {
    const raw = Number(source[area]);
    const order = Number.isFinite(raw) ? Math.max(0, Math.min(9999, Math.round(raw))) : (index + 1) * 10;
    return [area, order];
  }));
}

export function normalizeRegistryItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HubRegistryError("Item invalido.");
  }
  const id = cleanString(input.id, "id", { max: 80 }).toLowerCase();
  if (!SLUG_RE.test(id)) throw new HubRegistryError("id deve usar apenas letras minusculas, numeros e hifens.");
  const category = String(input.category || "tool").trim().toLowerCase();
  if (!HUB_REGISTRY_CATEGORIES.includes(category)) throw new HubRegistryError("category deve ser tool ou link.");
  const health = String(input.health || "unknown").trim().toLowerCase();
  if (!HUB_REGISTRY_HEALTH.includes(health)) throw new HubRegistryError("health invalido.");
  const areas = normalizeAreas(input.areas);

  return {
    id,
    title: cleanString(input.title, "title"),
    description: cleanString(input.description, "description"),
    kind: cleanString(input.kind, "kind"),
    category,
    href: normalizeHref(input.href),
    status: cleanString(input.status, "status").toLowerCase(),
    health,
    active: input.active !== false,
    featured: input.featured === true,
    owner: cleanString(input.owner, "owner"),
    dataOwner: cleanString(input.dataOwner, "dataOwner"),
    source: cleanString(input.source, "source"),
    period: cleanString(input.period, "period"),
    cadence: cleanString(input.cadence, "cadence"),
    lastDataAt: normalizeIso(input.lastDataAt, "lastDataAt"),
    areas,
    orderByArea: normalizeOrder(input.orderByArea, areas),
  };
}

export function normalizeRegistry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HubRegistryError("Registro global invalido.");
  }
  if (!Array.isArray(input.items)) throw new HubRegistryError("items deve ser uma lista.");
  const items = input.items.map(normalizeRegistryItem);
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) throw new HubRegistryError(`ID global duplicado: ${item.id}.`);
    seen.add(item.id);
  }
  const revision = Number(input.revision);
  return {
    schemaVersion: HUB_REGISTRY_SCHEMA_VERSION,
    revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
    updatedAt: normalizeIso(input.updatedAt, "updatedAt") || new Date(0).toISOString(),
    items,
  };
}

export function readHubRegistry(filePath = HUB_REGISTRY_PATH) {
  const sourcePath = filePath === HUB_REGISTRY_PATH && !fs.existsSync(filePath) ? HUB_REGISTRY_SEED_PATH : filePath;
  try {
    return normalizeRegistry(JSON.parse(fs.readFileSync(sourcePath, "utf8")));
  } catch (error) {
    if (error instanceof HubRegistryError) throw error;
    throw new HubRegistryError(`Nao foi possivel ler o registro global: ${error.message}`, 500, "registry_read_failed");
  }
}

export function itemsForArea(registry, areaId, { includeInactive = false } = {}) {
  if (!AREA_IDS.has(areaId)) return [];
  return registry.items
    .filter((item) => item.areas.includes(areaId) && (includeInactive || item.active))
    .sort((left, right) => {
      const order = (left.orderByArea[areaId] ?? 9999) - (right.orderByArea[areaId] ?? 9999);
      return order || left.title.localeCompare(right.title, "pt-BR");
    });
}

function writeAtomic(registry, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function mutateHubRegistry({ operation, expectedRevision, item }, filePath = HUB_REGISTRY_PATH) {
  const current = readHubRegistry(filePath);
  if (!Number.isInteger(expectedRevision)) throw new HubRegistryError("expectedRevision e obrigatorio.");
  if (expectedRevision !== current.revision) {
    throw new HubRegistryError("O Hub mudou desde que voce abriu a tela. Recarregue antes de salvar.", 409, "revision_conflict");
  }
  const normalized = normalizeRegistryItem(item);
  const index = current.items.findIndex((candidate) => candidate.id === normalized.id);
  let items;
  if (operation === "create") {
    if (index !== -1) throw new HubRegistryError("Ja existe um item com este ID.", 409, "duplicate_id");
    items = [...current.items, normalized];
  } else if (operation === "update") {
    if (index === -1) throw new HubRegistryError("Item nao encontrado.", 404, "item_not_found");
    items = current.items.map((candidate, candidateIndex) => candidateIndex === index ? normalized : candidate);
  } else {
    throw new HubRegistryError("Operacao invalida.");
  }
  const next = normalizeRegistry({
    schemaVersion: HUB_REGISTRY_SCHEMA_VERSION,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    items,
  });
  writeAtomic(next, filePath);
  return next;
}
