import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const launcher = readFileSync(new URL("../app/agenciamento/WhatsAppLauncher.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/agenciamento/page.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/agenciamento/agenciamento.module.css", import.meta.url), "utf8");

test("uses the correct WhatsApp destination and message", () => {
  assert.match(launcher, /const PHONE = "554791024456"/);
  assert.match(launcher, /Oi! Vi o perfil da Amplify e quero fazer parte!/);
  assert.match(launcher, /whatsapp:\/\/send\?phone=/);
});

test("does not send a failed app open to WhatsApp download", () => {
  assert.doesNotMatch(launcher, /whatsapp\.com\/download/);
  assert.match(launcher, /setPhase\("blocked"\)/);
  assert.match(launcher, /sessionStorage\.setItem\(ATTEMPT_KEY/);
  assert.match(launcher, /ATTEMPT_WINDOW_MS/);
  assert.match(launcher, /Abrir no navegador/);
});

test("keeps the page public-facing and isolated", () => {
  assert.match(page, /WhatsAppLauncher/);
  assert.match(page, /index: false/);
  assert.match(css, /100svh/);
  assert.match(css, /prefers-reduced-motion/);
});
