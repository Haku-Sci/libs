# claude-config

The Claude Code config of the Haku-Sci workspace (`D:\Haku-Sci\services`, the VS Code workspace that holds every service repository): project instructions and rules, hooks, slash commands, the developer and reviewer agents, the `/qa` push gate and the local MCP servers.

It is versioned here and installed into the workspace by `install.ps1`, so it cannot silently break again (it did when `services/.claude` pointed through junctions to a folder that had been deleted).

```
D:\Haku-Sci\services\.claude      → junction to libs\local-tools\claude-config\.claude
D:\Haku-Sci\CLAUDE.md             → one line: @libs/local-tools/claude-config/CLAUDE.md (parent of the workspace, loaded too)
D:\Haku-Sci\services\.mcp.json    → copy of libs\local-tools\claude-config\mcp-servers\mcp.json
```

## Files

| File | Role |
|------|------|
| `CLAUDE.md` | Project-wide instructions (hard rules, roles, services), imported by `D:\Haku-Sci\CLAUDE.md`; imports `rules/*.md` |
| `rules/` | `code.md`, `front.md`, `backend.md`, `contracts.md`: coding rules and design contracts (ids `CODE-n`, `FRONT-n`…), applied by the developers and checked by the reviewer. `review.md`: review calibration learned from the user's feedback |
| `mcp-servers/mcp.json` | MCP servers configuration (PC only, absolute paths) |
| `mcp-servers/mcp-launch.py` | Starts an MCP server with credentials read from `D:\Haku-Sci\libs\.env` (override with `HAKU_ENV_FILE`); `mcp-overrides.txt` pins its dependency overrides |
| `.claude/settings.json` | Permissions (Claude never commits, pushes or publishes), `MCP_TIMEOUT`, hook wiring |
| `.claude/hooks/` | Protected files, edit tracking, type-check on stop + graphify update; `record-review.js` records each `/qa` result |
| `.claude/agents/` | `front-dev`, `backend-dev`, `data-processing-dev` (write, each in its area) and `reviewer` (read-only, independent of the developers) |
| `.claude/commands/` | `/qa` (review of the feature), `/teach-reviewer` (feedback → rule), `/todo`, `/backup`, `/restore`, `/cleanDB` |
| `git-hooks/qa-gate.js` | Git `pre-push` gate: pushing `integration` needs a `/qa` with no blocking finding since the repository's last push (`--no-verify` bypasses it) |
| `install.ps1` | Installs or updates the config in the workspace |

`/backup`, `/restore` and `/cleanDB` call `D:\Haku-Sci\.local-scripts\mcp-db.sh`, which stays outside this repository.

## Install and update

```powershell
.\local-tools\claude-config\install.ps1      # from libs; defaults to D:\Haku-Sci\services
```

Rerun it after every pull and after editing `mcp-servers/mcp.json` (that file is copied, not linked). It also adds the `/qa` gate as the first line of `.git/hooks/pre-push` in every repository of the workspace and in `libs` (an existing `pre-push`, e.g. the DB dumps of vault, graph and test, is kept after it and saved as `pre-push.before-qa-gate`). It is idempotent and never deletes anything: whatever it replaces is moved to `D:\Haku-Sci\.claude-backup-<timestamp>\`. Then restart Claude Code and check `/mcp` and `/hooks`.

`services/.claude` is a junction: edits Claude Code makes to its config land in this folder and must be committed in libs.

## Relation with todo-agent

`/todo` calls `libs/local-tools/todo-agent/create-issue.py`, the same script as the phone agent, so both behave identically. It needs `GITLAB_TOKEN` in the user environment. The phone agent is deployed separately with `libs/local-tools/todo-agent/deploy.ps1 <ssh-host>`.

## Ignored files

Machine-local and runtime files live in the junctioned folder but are gitignored (see `libs/.gitignore`):

- `.claude/settings.local.json`: per-machine permissions and enabled MCP servers;
- `.claude/state/`: hook state (edited files per session, recorded reviews);
- `.claude/logs/`, `.claude/scheduled_tasks.lock`: Claude Code runtime files.
