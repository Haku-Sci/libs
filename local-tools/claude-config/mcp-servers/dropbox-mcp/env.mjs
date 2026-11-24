import { existsSync, readFileSync } from "node:fs";

// Same convention as services/.claude/scripts/mcp-launch.py: credentials come from libs/.env.
export const ENV_FILE = process.env.HAKU_ENV_FILE ?? "D:/Haku-Sci/libs/.env";

export function loadEnv() {
  const values = {};
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
      if (match) values[match[1]] = match[2];
    }
  }
  return { ...values, ...process.env };
}
