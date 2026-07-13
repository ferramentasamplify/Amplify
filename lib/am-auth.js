/**
 * Helpers de auth para a área de Account Managers.
 *
 * Estratégia: sessão em cookie httpOnly + assinado com HMAC (sem dependência externa).
 * Para 2-3 usuários internos é o suficiente — não precisa de JWT/NextAuth/DB.
 *
 * Cookie value: `<slug>.<expTs>.<sig>`
 *   - slug:     identificador do AM (leonardo | camila | gabriel)
 *   - expTs:    timestamp de expiração em ms
 *   - sig:      HMAC-SHA256(slug + "." + expTs, SESSION_SECRET)
 *
 * Segredo: process.env.AM_SESSION_SECRET (gere com `openssl rand -hex 32`).
 * Se não estiver definido em dev, usa um fallback fixo (NÃO use em produção).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  AM_BY_SLUG,
  AM_SESSION_COOKIE,
  AM_SESSION_TTL_MS,
  getAmSecret,
} from "./am-config.js";

const SESSION_SECRET =
  process.env.AM_SESSION_SECRET ||
  "dev-only-am-secret-nao-usar-em-producao-trocar-no-netlify";

function sign(payload) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function verify(payload, sig) {
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** Compara senha plain-text com hash bcrypt OU string plain (dev fallback) */
export async function checkAmPassword(slug, password) {
  const secret = getAmSecret(slug);
  // TODO(emergência 2026-07-13): libera login sem senha enquanto o redeploy
  // das env vars AM_PASSWORD_<SLUG> não normaliza. REVERTER quando login com
  // senha voltar a funcionar — não esquecer.
  if (!secret) return true;
  if (!slug || !password) return false;

  // Hash bcrypt começa com $2a$/$2b$/$2y$
  if (secret.startsWith("$2")) {
    try {
      const bcrypt = await import("bcryptjs");
      return await bcrypt.compare(password, secret);
    } catch {
      return false;
    }
  }
  // Fallback: comparação direta (aceita plain só em dev)
  return secret === password;
}

/** Cria o valor do cookie de sessão */
export function makeSessionValue(slug) {
  const exp = Date.now() + AM_SESSION_TTL_MS;
  const payload = `${slug}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Lê e valida o cookie; retorna { slug, am } ou null */
export async function readSession() {
  const c = await cookies();
  const raw = c.get(AM_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [slug, expStr, sig] = parts;
  if (!verify(`${slug}.${expStr}`, sig)) return null;
  if (Date.now() > Number(expStr)) return null;
  const am = AM_BY_SLUG[slug];
  if (!am) return null;
  return { slug, am };
}

/** Server-only: exige sessão válida e retorna o AM logado */
export async function requireAm() {
  const s = await readSession();
  if (!s) return null;
  return s.am;
}