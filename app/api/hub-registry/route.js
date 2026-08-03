import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { HubRegistryError, mutateHubRegistry, readHubRegistry } from "@/lib/hub-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function response(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function configuredKey() {
  return process.env.HUB_REGISTRY_ADMIN_KEY || process.env.NEXT_PUBLIC_HUB_PASSWORD || "";
}

function sameSecret(received, expected) {
  if (!received || !expected) return false;
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function authorize(request) {
  const expected = configuredKey();
  if (!expected) throw new HubRegistryError("Edicao do Hub ainda nao foi configurada no servidor.", 503, "admin_key_missing");
  if (!sameSecret(request.headers.get("x-hub-admin-key") || "", expected)) {
    throw new HubRegistryError("Chave administrativa invalida.", 401, "unauthorized");
  }
}

function handleError(error) {
  if (error instanceof HubRegistryError) {
    return response({ ok: false, error: error.message, code: error.code }, error.status);
  }
  console.error("hub-registry", error instanceof Error ? error.message : "unknown_error");
  return response({ ok: false, error: "Falha interna ao atualizar o Hub.", code: "internal_error" }, 500);
}

export async function GET() {
  try {
    return response({ ok: true, registry: readHubRegistry() });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    authorize(request);
    const body = await request.json().catch(() => null);
    if (!body) throw new HubRegistryError("JSON invalido.");
    const registry = mutateHubRegistry({
      operation: "create",
      expectedRevision: body.expectedRevision,
      item: body.item,
    });
    return response({ ok: true, registry }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request) {
  try {
    authorize(request);
    const body = await request.json().catch(() => null);
    if (!body) throw new HubRegistryError("JSON invalido.");
    const registry = mutateHubRegistry({
      operation: "update",
      expectedRevision: body.expectedRevision,
      item: body.item,
    });
    return response({ ok: true, registry });
  } catch (error) {
    return handleError(error);
  }
}
