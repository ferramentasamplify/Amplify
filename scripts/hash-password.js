#!/usr/bin/env node
/**
 * scripts/hash-password.js
 *
 * Gera o hash bcrypt de uma senha pra colar em .env como AM_PASSWORD_<SLUG>.
 *
 * Uso:
 *   node scripts/hash-password.js "minha-senha-aqui"
 *
 * Saída: string bcrypt ($2a$10$...) pronta pra colar no Netlify env.
 */

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/hash-password.js <senha>");
  process.exit(1);
}

import("bcryptjs")
  .then(({ hashSync }) => {
    console.log(hashSync(password, 10));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
