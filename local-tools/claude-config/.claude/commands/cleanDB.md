---
description: Delete every database behind an MCP server (usage - /cleanDB <neo4j|postgres>)
allowed-tools: Bash(bash /d/Haku-Sci/.local-scripts/mcp-db.sh clean *)
---

This command irreversibly deletes data. It never makes a backup by itself.

Format of the argument: `<mcp>`, the name of a server in `D:\Haku-Sci\services\.mcp.json`: `neo4j` or `postgres`.

Behavior:

1. If `$ARGUMENTS` is not exactly `neo4j` or `postgres`, print the expected format and stop.
2. Ask the user for confirmation with AskUserQuestion, stating what will be deleted and the date of the latest backup in `D:\Haku-Sci\.local-dumps\<mcp>\` (or that there is none):
   - `neo4j`: every node, relationship, constraint and index of the graph (Neo4j Community has a single user database, which is emptied rather than dropped).
   - `postgres`: every database except `postgres` and the templates, dropped with `WITH (FORCE)`, which disconnects running services.
   Stop unless the user confirms.
3. Run with the Bash tool, as a single command:
   ```bash
   bash /d/Haku-Sci/.local-scripts/mcp-db.sh clean <mcp>
   ```
4. If the script fails, report its output as-is. Never start or restart a container.
5. On success, report what was deleted.

Argument: $ARGUMENTS
