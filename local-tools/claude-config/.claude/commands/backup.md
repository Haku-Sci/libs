---
description: Back up the local database behind an MCP server (usage - /backup <neo4j|postgres>)
allowed-tools: Bash(bash /d/Haku-Sci/.local-scripts/mcp-db.sh backup *)
---

This command only creates a backup. It never deletes or modifies a database.

Format of the argument: `<mcp>`, the name of a server in `D:\Haku-Sci\services\.mcp.json`: `neo4j` or `postgres`.

Behavior:

1. If `$ARGUMENTS` is not exactly `neo4j` or `postgres`, print the expected format and stop.
2. Run with the Bash tool, as a single command:
   ```bash
   bash /d/Haku-Sci/.local-scripts/mcp-db.sh backup <mcp>
   ```
   - `neo4j`: full graph (data + constraints + indexes) as a cypher-shell script in `D:\Haku-Sci\.local-dumps\neo4j\neo4j-<timestamp>.cypher`.
   - `postgres`: every non-template database except `postgres` (each with its `CREATE DATABASE`) in `D:\Haku-Sci\.local-dumps\postgres\postgres-<timestamp>.sql`.
3. If the script fails (container stopped, auth error…), report its output as-is. Never start or restart a container.
4. On success, report the dump file path and its size.

Argument: $ARGUMENTS
