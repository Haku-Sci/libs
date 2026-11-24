# todo-agent

Create GitLab issues from the Claude mobile app with `/todo <service> <description>`.

A Claude Code session runs in [Remote Control](https://code.claude.com/docs/en/remote-control) server mode on the host. The phone talks to Anthropic, and the session polls Anthropic over outbound HTTPS only, so no port is opened. The session translates the description to English, writes a title and calls `create-issue.py`, which posts to the GitLab API inside the private network.

```
Claude app (phone) ──▶ Anthropic ◀── claude remote-control (outbound only)
                                        └─ /todo → create-issue.py → GitLab API → issue URL
```

## Files

| File | Installed at | Role |
|------|--------------|------|
| `.claude/commands/todo.md` | `/opt/haku-todo/.claude/commands/` | The `/todo` command: parsing, translation, title |
| `.claude/settings.json` | `/opt/haku-todo/.claude/` | Locked permissions: `dontAsk` mode, only `create-issue.py` allowed |
| `CLAUDE.md` | `/opt/haku-todo/` | Restricts the session to `/todo` |
| `create-issue.py` | `/opt/haku-todo/` | Posts the issue, prints its URL |
| `haku-todo.service` | `/etc/systemd/system/` | Keeps the server running and restarts it |
| `deploy.ps1` | — (runs locally) | Copies the folder over SSH and starts `install.sh` on the host |
| `install.sh` | — (runs on the host) | Installs or updates everything in one run |

## Requirements

- A Claude Pro/Max subscription (Remote Control does not work with API keys).
- A GitLab **group access token** on `haku-sci`, role **Reporter**, scope `api`. Reporter can create issues but cannot push code.
- `python3`, `curl` and `script` (util-linux) on the host.

## Install

From your machine, pass the SSH host to the deploy script:

```powershell
.\tools\todo-agent\deploy.ps1 <ssh-host>
```

`deploy.ps1` copies this folder to `/tmp/todo-agent` on the host, runs `install.sh` there as root in an interactive SSH terminal, then removes the copy. Rerun it to update. `install.sh`:

1. Creates the unprivileged `haku-todo` user (no Docker, no sudo).
2. Copies the files to `/opt/haku-todo`, owned by root, so the session cannot change its own permissions.
3. Asks for the GitLab token, checks it against the API and stores it in `/etc/haku-todo/env` (root only; systemd loads it before dropping privileges). An existing token is kept unless you choose to replace it.
4. Installs Claude Code for `haku-todo`, unless already installed (it then updates itself).
5. Runs the one-time interactive setup: trust the folder and `/login`, then accept Remote Control and press Ctrl+C once the session URL shows.
6. Installs, enables and starts the systemd service, then checks that it runs.

Step 5 needs a terminal: without one, `claude remote-control` cannot ask for workspace trust and exits with `Workspace not trusted`. `install.sh` refuses to run without one, which is why `deploy.ps1` uses `ssh -t`.

## Usage

Claude app → **Code** → session `haku-todo` (green dot when online) → `/todo front the dropdown flickers on mobile`.

## Security

- `dontAsk` mode denies every call that is not pre-approved. The only allowed command is `python3 /opt/haku-todo/create-issue.py`. Edits, web access and subagents are denied, and bypass/auto modes are disabled.
- Read-only actions (file reads in the working directory, read-only shell commands such as `cat` or `printenv`) still run without approval. Anyone controlling your claude.ai account could therefore read `GITLAB_TOKEN` from the session environment. The Reporter role limits the damage to creating or commenting on issues. Revoke the token in GitLab if your account is compromised.
- The session runs as `haku-todo`, which has no Docker or sudo access. Its uid/gid is picked at 20000 or above, never in the system range: system ids collide with users inside containers (GitLab's Postgres runs as uid 996), which would give the session access to their processes and bind-mounted data. The installer migrates an account created with a lower id.

## Troubleshooting

```bash
systemctl status haku-todo
journalctl -u haku-todo -f
```

- **Session offline in the app**: the server exits after about 10 minutes without network; systemd restarts it after 30 s. Sessions come back for about four hours after a stop, after that a new session appears.
- **Logged out** or **`Workspace not trusted`**: rerun `deploy.ps1` and answer `y` to the one-time setup.
