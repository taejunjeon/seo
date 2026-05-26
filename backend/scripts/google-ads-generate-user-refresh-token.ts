#!/usr/bin/env tsx
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

const backendDir = path.resolve(__dirname, "..");
const envPath = path.join(backendDir, ".env");
dotenv.config({ path: envPath, quiet: true });

const args = new Set(process.argv.slice(2));
const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.split("=")[1] || process.env.GOOGLE_ADS_OAUTH_PORT || 8080);
const writeEnv = args.has("--write-env");
const printToken = args.has("--print-token");
const dryRun = args.has("--dry-run");

function firstNonEmpty(values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}...${value.slice(-3)}`;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function escapeEnvValue(value: string): string {
  return value.replace(/\n/g, "\\n");
}

function upsertEnvLine(filePath: string, key: string, value: string): void {
  const nextLine = `${key}=${escapeEnvValue(value)}`;
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = current.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));

  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push("# Google Ads user OAuth refresh token - generated locally; do not commit");
    lines.push("GOOGLE_ADS_AUTH_MODE=user_oauth");
    lines.push(nextLine);
  }

  fs.writeFileSync(filePath, lines.join("\n"));
}

async function main(): Promise<void> {
  const clientId = firstNonEmpty([
    process.env.GOOGLE_ADS_OAUTH_CLIENT_ID,
    process.env.GOOGLE_CONSOLE_Oauth_Clinet_ID,
    process.env.GOOGLE_CONSOLE_OAUTH_CLIENT_ID,
  ]);
  const clientSecret = firstNonEmpty([
    process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_CONSOLE_Oauth_Secret_KEY,
    process.env.GOOGLE_CONSOLE_OAUTH_CLIENT_SECRET,
  ]);

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing OAuth client credentials. Set GOOGLE_ADS_OAUTH_CLIENT_ID/GOOGLE_ADS_OAUTH_CLIENT_SECRET or the existing GOOGLE_CONSOLE_* aliases in backend/.env.",
    );
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${String(portArg || process.env.GOOGLE_ADS_OAUTH_PORT)}`);
  }

  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_ADS_SCOPE],
  });

  if (dryRun) {
    console.log("Google Ads OAuth local generator dry-run OK.");
    console.log(`clientId=${maskSecret(clientId)}`);
    console.log(`redirectUri=${redirectUri}`);
    console.log(`scope=${GOOGLE_ADS_SCOPE}`);
    console.log("serverStarted=no");
    return;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", redirectUri);
      if (requestUrl.pathname !== "/oauth2callback") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");
      if (error) {
        throw new Error(`OAuth callback error: ${error}`);
      }
      if (!code) {
        throw new Error("OAuth callback did not include a code.");
      }

      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error(
          "Google did not return a refresh token. Re-run with prompt=consent, or revoke the previous grant for this OAuth client and try again.",
        );
      }

      if (writeEnv) {
        upsertEnvLine(envPath, "GOOGLE_ADS_OAUTH_REFRESH_TOKEN", tokens.refresh_token);
        upsertEnvLine(envPath, "GOOGLE_ADS_AUTH_MODE", "user_oauth");
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<html><body><h1>Google Ads OAuth 완료</h1><p>터미널로 돌아가세요. 이 창은 닫아도 됩니다.</p></body></html>",
      );

      console.log("Google Ads OAuth refresh token generated.");
      console.log(`refreshToken=${printToken ? tokens.refresh_token : maskSecret(tokens.refresh_token)}`);
      console.log(`writeEnv=${writeEnv ? "yes" : "no"}`);
      if (writeEnv) {
        console.log(`updated=${envPath}`);
      } else {
        console.log("Run again with --write-env to store GOOGLE_ADS_OAUTH_REFRESH_TOKEN in backend/.env.");
      }

      server.close();
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : "OAuth token generation failed");
      console.error(error instanceof Error ? error.message : error);
      server.close();
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log("Open this URL in Chrome with the Google Ads admin account:");
    console.log(authUrl);
    console.log("");
    console.log(`Waiting for OAuth callback on ${redirectUri}`);
    console.log("Recommended command: npm exec tsx scripts/google-ads-generate-user-refresh-token.ts -- --write-env");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
