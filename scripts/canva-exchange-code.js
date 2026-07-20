#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const CODE = process.env.CANVA_AUTH_CODE;
const statePath = path.join(process.cwd(), ".canva-oauth-state.json");

if (!CLIENT_ID || !CLIENT_SECRET || !CODE) {
  console.error("Missing CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, or CANVA_AUTH_CODE");
  process.exit(1);
}
if (!fs.existsSync(statePath)) {
  console.error("Missing .canva-oauth-state.json. Run scripts/canva-auth-url.js first.");
  process.exit(1);
}

const oauthState = JSON.parse(fs.readFileSync(statePath, "utf8"));
const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code: CODE,
  code_verifier: oauthState.codeVerifier,
  redirect_uri: oauthState.redirectUri,
});

const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
  method: "POST",
  headers: {
    authorization: `Basic ${credentials}`,
    "content-type": "application/x-www-form-urlencoded",
  },
  body,
});

const data = await response.json();
if (!response.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

fs.writeFileSync(
  path.join(process.cwd(), ".canva-token.json"),
  JSON.stringify({ savedAt: new Date().toISOString(), ...data }, null, 2),
);
console.log("Canva token saved to .canva-token.json");
