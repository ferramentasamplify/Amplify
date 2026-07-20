#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const REDIRECT_URI =
  process.env.CANVA_REDIRECT_URI ||
  "https://amplifyhub123.netlify.app/api/canva/oauth/callback";
const SCOPES = (
  process.env.CANVA_SCOPES ||
  [
    "openid",
    "profile:read",
    "email",
    "asset:read",
    "asset:write",
    "design:meta:read",
    "design:content:read",
    "design:content:write",
    "folder:read",
    "folder:write",
    "folder:permission:write",
    "comment:read",
    "comment:write",
    "brandtemplate:meta:read",
    "brandtemplate:content:read",
    "brandtemplate:content:write",
  ].join(" ")
).trim();

if (!CLIENT_ID) {
  console.error("Missing CANVA_CLIENT_ID");
  process.exit(1);
}

const codeVerifier = crypto.randomBytes(96).toString("base64url");
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");
const state = crypto.randomBytes(48).toString("base64url");

const statePath = path.join(process.cwd(), ".canva-oauth-state.json");
fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      state,
      codeVerifier,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
    },
    null,
    2,
  ),
);

const authUrl = new URL("https://www.canva.com/api/oauth/authorize");
authUrl.searchParams.set("code_challenge", codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("state", state);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);

console.log(authUrl.toString());
