// stdio MCP server exposing Dropbox. Read-only unless CLAUDE_DROPBOX_WRITE=1 is set.
// Credentials: CLAUDE_DROPBOX_CLIENT, CLAUDE_DROPBOX_SECRET, CLAUDE_DROPBOX_REFRESH_TOKEN (libs/.env, see auth.mjs).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const WRITE = env.CLAUDE_DROPBOX_WRITE === "1";
const MAX_TEXT_BYTES = 1_000_000;

for (const key of ["CLAUDE_DROPBOX_CLIENT", "CLAUDE_DROPBOX_SECRET", "CLAUDE_DROPBOX_REFRESH_TOKEN"]) {
  if (!env[key]) {
    console.error(`[dropbox-mcp] missing ${key} (run: node auth.mjs for the refresh token)`);
    process.exit(1);
  }
}

let accessToken = null;
let accessTokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) return accessToken;
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.CLAUDE_DROPBOX_REFRESH_TOKEN,
      client_id: env.CLAUDE_DROPBOX_CLIENT,
      client_secret: env.CLAUDE_DROPBOX_SECRET,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Dropbox token refresh failed: ${JSON.stringify(body)}`);
  accessToken = body.access_token;
  accessTokenExpiresAt = Date.now() + body.expires_in * 1000;
  return accessToken;
}

async function rpc(endpoint, args) {
  const response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
    body: args === undefined ? undefined : JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Dropbox ${endpoint} -> ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Dropbox expects a root-relative path, "" for the root and a leading slash otherwise.
const normalizePath = (path) => (path === "/" ? "" : path);

const ok = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (error) => ({ isError: true, content: [{ type: "text", text: String(error.message ?? error) }] });
const handle = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (error) {
    return fail(error);
  }
};

const summarize = (entry) => ({
  type: entry[".tag"],
  name: entry.name,
  path: entry.path_display,
  size: entry.size,
  modified: entry.server_modified,
});

const server = new McpServer({ name: "dropbox", version: "1.0.0" });
const readOnly = { readOnlyHint: true };

server.registerTool(
  "list_folder",
  {
    description: "List the entries of a Dropbox folder (use \"\" or \"/\" for the root).",
    inputSchema: { path: z.string(), recursive: z.boolean().optional(), limit: z.number().int().min(1).max(2000).optional() },
    annotations: readOnly,
  },
  handle(async ({ path, recursive, limit }) => {
    let result = await rpc("files/list_folder", { path: normalizePath(path), recursive: !!recursive, limit: limit ?? 200 });
    const entries = [...result.entries];
    while (result.has_more && entries.length < (limit ?? 200)) {
      result = await rpc("files/list_folder/continue", { cursor: result.cursor });
      entries.push(...result.entries);
    }
    return entries.map(summarize);
  }),
);

server.registerTool(
  "search",
  {
    description: "Search files and folders by name or content.",
    inputSchema: { query: z.string().min(1), path: z.string().optional(), max_results: z.number().int().min(1).max(100).optional() },
    annotations: readOnly,
  },
  handle(async ({ query, path, max_results }) => {
    const result = await rpc("files/search_v2", {
      query,
      options: { path: path ? normalizePath(path) : undefined, max_results: max_results ?? 20 },
    });
    return result.matches.map((match) => summarize(match.metadata.metadata));
  }),
);

server.registerTool(
  "get_metadata",
  { description: "Get the metadata of a file or folder.", inputSchema: { path: z.string() }, annotations: readOnly },
  handle(async ({ path }) => summarize(await rpc("files/get_metadata", { path: normalizePath(path) }))),
);

server.registerTool(
  "read_file",
  {
    description: `Download a file and return it as UTF-8 text (max ${MAX_TEXT_BYTES} bytes; binary files are refused).`,
    inputSchema: { path: z.string() },
    annotations: readOnly,
  },
  handle(async ({ path }) => {
    const response = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: { Authorization: `Bearer ${await getAccessToken()}`, "Dropbox-API-Arg": JSON.stringify({ path }) },
    });
    if (!response.ok) throw new Error(`Dropbox files/download -> ${response.status}: ${await response.text()}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_TEXT_BYTES) throw new Error(`File too large (${bytes.length} bytes)`);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("File is not valid UTF-8 text");
    }
  }),
);

server.registerTool(
  "create_shared_link",
  { description: "Create (or return the existing) shared link of a file or folder.", inputSchema: { path: z.string() } },
  handle(async ({ path }) => {
    try {
      return (await rpc("sharing/create_shared_link_with_settings", { path })).url;
    } catch (error) {
      const existing = await rpc("sharing/list_shared_links", { path, direct_only: true });
      if (existing.links?.length) return existing.links[0].url;
      throw error;
    }
  }),
);

if (WRITE) {
  server.registerTool(
    "upload_file",
    {
      description: "Upload UTF-8 text to a path. Fails if the file exists unless overwrite is true.",
      inputSchema: { path: z.string(), content: z.string(), overwrite: z.boolean().optional() },
    },
    handle(async ({ path, content, overwrite }) => {
      const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          "Dropbox-API-Arg": JSON.stringify({ path, mode: overwrite ? "overwrite" : "add", autorename: false, mute: true }),
          "Content-Type": "application/octet-stream",
        },
        body: content,
      });
      if (!response.ok) throw new Error(`Dropbox files/upload -> ${response.status}: ${await response.text()}`);
      return summarize(await response.json());
    }),
  );

  server.registerTool(
    "create_folder",
    { description: "Create a folder.", inputSchema: { path: z.string() } },
    handle(async ({ path }) => summarize((await rpc("files/create_folder_v2", { path })).metadata)),
  );

  server.registerTool(
    "move",
    { description: "Move or rename a file or folder.", inputSchema: { from_path: z.string(), to_path: z.string() } },
    handle(async ({ from_path, to_path }) => summarize((await rpc("files/move_v2", { from_path, to_path })).metadata)),
  );

  server.registerTool(
    "delete",
    { description: "Delete a file or folder (recoverable from the Dropbox trash).", inputSchema: { path: z.string() }, annotations: { destructiveHint: true } },
    handle(async ({ path }) => summarize((await rpc("files/delete_v2", { path })).metadata)),
  );
}

await server.connect(new StdioServerTransport());
