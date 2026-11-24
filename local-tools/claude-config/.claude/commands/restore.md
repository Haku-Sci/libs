---
description: Restore the latest backup of an MCP server's local database (usage - /restore <neo4j|postgres>)
allowed-tools: Bash(bash /d/Haku-Sci/.local-scripts/mcp-db.sh restore *)
---

This command replaces the current content of the database with the latest backup made by `/backup`.

Format of the argument: `<mcp>`, the name of a server in `D:\Haku-Sci\services\.mcp.json`: `neo4j` or `postgres`.

Behavior:

1. If `$ARGUMENTS` is not exactly `neo4j` or `postgres`, print the expected format and stop.
2. Find the latest backup (most recent file) in `D:\Haku-Sci\.local-dumps\<mcp>\`: `neo4j-*.cypher` for `neo4j`, `postgres-*.sql` for `postgres`. If there is none, say so and stop.
3. Ask the user for confirmation with AskUserQuestion, naming the file and its date, and what will be wiped first:
   - `neo4j`: every node, relationship, constraint and index of the graph.
   - `postgres`: every database except `postgres` (vault, third-party, test…), dropped with `WITH (FORCE)`, which disconnects running services.
   Stop unless the user confirms.
4. Run with the Bash tool, as a single command:
   ```bash
   bash /d/Haku-Sci/.local-scripts/mcp-db.sh restore <mcp>
   ```
5. If the script fails, report its output as-is. Never start or restart a container and never retry with another file.
6. On success, report the restored file.

Argument: $ARGUMENTS
