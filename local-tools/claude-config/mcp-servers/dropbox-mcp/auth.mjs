// One-time OAuth flow: obtains a long-lived Dropbox refresh token and stores it in libs/.env.
// Prerequisite: the redirect URI below is registered in the Dropbox app (App Console > Settings).
// Usage: node auth.mjs   (reads CLAUDE_DROPBOX_CLIENT / CLAUDE_DROPBOX_SECRET from libs/.env)
import { createServer } from "node:http";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnv, ENV_FILE } from "./env.mjs";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const env = loadEnv();
const clientId = env.CLAUDE_DROPBOX_CLIENT;
const clientSecret = env.CLAUDE_DROPBOX_SECRET;
if (!clientId || !clientSecret) {
  console.error(`Missing CLAUDE_DROPBOX_CLIENT / CLAUDE_DROPBOX_SECRET in ${ENV_FILE}`);
  process.exit(1);
}

const state = crypto.randomUUID();
const authorizeUrl =
  "https://www.dropbox.com/oauth2/authorize?" +
  new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: REDIRECT_URI,
    state,
  });

function storeRefreshToken(token) {
  const key = "CLAUDE_DROPBOX_REFRESH_TOKEN";
  const content = readFileSync(ENV_FILE, "utf8");
  if (new RegExp(`^${key}=`, "m").test(content)) {
    writeFileSync(ENV_FILE, content.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${token}`));
  } else {
    appendFileSync(ENV_FILE, `${content.endsWith("\n") ? "" : "\n"}${key}=${token}\n`);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  try {
    if (url.searchParams.get("state") !== state) throw new Error("state mismatch");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error_description") ?? "no code returned");
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.refresh_token) throw new Error(JSON.stringify(body));
    storeRefreshToken(body.refresh_token);
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Dropbox authorized. You can close this tab.");
    console.log(`Refresh token stored in ${ENV_FILE}. Granted scopes: ${body.scope}`);
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Authorization failed, see the terminal.");
    console.error("Authorization failed:", error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open this URL in your browser and approve access:\n\n${authorizeUrl}\n`);
});
