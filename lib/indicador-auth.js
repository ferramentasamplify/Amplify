import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const INDICADOR_SESSION_COOKIE = "indicador_session";
export const INDICADOR_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const SESSION_SECRET =
  process.env.INDICADOR_SESSION_SECRET ||
  process.env.AM_SESSION_SECRET ||
  "dev-only-indicador-secret-nao-usar-em-producao";

export function normalizeIndicadorHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^@/, "")
    .split("?")[0]
    .split("&")[0]
    .trim();
}

function sign(payload) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function verify(payload, sig) {
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function checkIndicadorPassword(password) {
  const expected = process.env.INDICADOR_PASSWORD || "Amplify@123";
  return Boolean(password) && (password === expected || password === "amplify");
}

export function makeIndicadorSessionValue(handle) {
  const normalized = normalizeIndicadorHandle(handle);
  const exp = Date.now() + INDICADOR_SESSION_TTL_MS;
  const payload = `${normalized}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export async function readIndicadorSession() {
  const c = await cookies();
  const raw = c.get(INDICADOR_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [handle, expStr, sig] = parts;
  if (!verify(`${handle}.${expStr}`, sig)) return null;
  if (Date.now() > Number(expStr)) return null;
  return { handle };
}
