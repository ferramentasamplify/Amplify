import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import registrySeed from "../data/hub-registry.json" with { type: "json" };
import { HUB_AREAS } from "../lib/hub-areas.js";
import { HubRegistryError, itemsForArea, mutateHubRegistry, normalizeRegistry, normalizeRegistryItem } from "../lib/hub-registry.js";

const areaIds = new Set(HUB_AREAS.map((area) => area.id));

test("seed global tem IDs unicos e associacoes validas", () => {
  const registry = normalizeRegistry(registrySeed);
  assert.equal(new Set(registry.items.map((item) => item.id)).size, registry.items.length);
  assert.ok(registry.items.length >= 20);
  for (const item of registry.items) {
    assert.ok(item.areas.length >= 1);
    assert.ok(item.areas.every((area) => areaIds.has(area)));
    assert.deepEqual(Object.keys(item.orderByArea).sort(), [...item.areas].sort());
  }
});

test("ativos compartilhados aparecem uma unica vez no registro", () => {
  const registry = normalizeRegistry(registrySeed);
  for (const id of ["creator-cac-ltv", "funis-creators-marcas", "central-lps", "dashboard-criativos-meta", "calculadora-margem"]) {
    const matches = registry.items.filter((item) => item.id === id);
    assert.equal(matches.length, 1, id);
    assert.ok(matches[0].areas.length > 1, id);
  }
});

test("catalogo da area respeita ativo e orderByArea", () => {
  const registry = normalizeRegistry(registrySeed);
  const acquisition = itemsForArea(registry, "aquisicao");
  assert.deepEqual(acquisition.slice(0, 3).map((item) => item.id), ["amplifyos", "cockpit-aquisicao", "dashboard-aquisicao"]);
  assert.ok(acquisition.every((item) => item.active && item.areas.includes("aquisicao")));
});

test("normalizacao rejeita URL perigosa, ID e area invalidos", () => {
  const base = registrySeed.items[0];
  assert.throws(() => normalizeRegistryItem({ ...base, href: "javascript:alert(1)" }), HubRegistryError);
  assert.throws(() => normalizeRegistryItem({ ...base, href: "//evil.example/path" }), HubRegistryError);
  assert.throws(() => normalizeRegistryItem({ ...base, href: "/safe\\evil" }), HubRegistryError);
  assert.throws(() => normalizeRegistryItem({ ...base, id: "ID Invalido" }), HubRegistryError);
  assert.throws(() => normalizeRegistryItem({ ...base, id: "valido", areas: ["nao-existe"] }), HubRegistryError);
});

test("mutacao usa revisao otimista, persiste atomico e arquiva sem excluir", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hub-registry-"));
  const file = path.join(directory, "registry.json");
  fs.writeFileSync(file, JSON.stringify(registrySeed));
  const original = normalizeRegistry(registrySeed);
  const target = original.items[0];
  const updated = mutateHubRegistry({ operation: "update", expectedRevision: original.revision, item: { ...target, active: false } }, file);
  assert.equal(updated.revision, original.revision + 1);
  assert.equal(updated.items.length, original.items.length);
  assert.equal(updated.items.find((item) => item.id === target.id)?.active, false);
  assert.throws(() => mutateHubRegistry({ operation: "update", expectedRevision: original.revision, item: target }, file), (error) => error instanceof HubRegistryError && error.status === 409);
  assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp")).length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});
