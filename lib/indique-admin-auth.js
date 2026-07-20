import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const INDIQUE_ADMIN_SESSION_COOKIE = "indique_admin_session";
export const INDIQUE_ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const SESSION_SECRET =
  process.env.INDIQUE_ADMIN_SESSION_SECRET ||
  process.env.AM_SESSION_SECRET ||
  "dev-only-indique-admin-secret-nao-usar-em-producao";

function sign(payload) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function verify(payload, sig) {
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function checkIndiqueAdminPassword(password) {
  const expected =
    process.env.INDIQUE_ADMIN_PASSWORD ||
    process.env.NEXT_PUBLIC_HUB_PASSWORD ||
    "amplify2025";
  return Boolean(password) && password === expected;
}

export function makeIndiqueAdminSessionValue() {
  const exp = Date.now() + INDIQUE_ADMIN_SESSION_TTL_MS;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export async function readIndiqueAdminSession() {
  const c = await cookies();
  const raw = c.get(INDIQUE_ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [role, expStr, sig] = parts;
  if (role !== "admin") return null;
  if (!verify(`${role}.${expStr}`, sig)) return null;
  if (Date.now() > Number(expStr)) return null;
  return { role };
}
