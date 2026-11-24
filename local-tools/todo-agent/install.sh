#!/usr/bin/env bash
# Remote half of the installer, started by deploy.ps1 on the target host (as root, in a terminal).
# Safe to rerun: existing token, Claude Code install and login are kept unless you choose otherwise.
set -euo pipefail

SERVICE_USER=haku-todo
SERVICE_HOME=/var/lib/haku-todo
MIN_SERVICE_ID=20000
INSTALL_DIR=/opt/haku-todo
CONFIG_DIR=/etc/haku-todo
ENV_FILE=$CONFIG_DIR/env
UNIT_FILE=/etc/systemd/system/haku-todo.service
CLAUDE_BIN=$SERVICE_HOME/.local/bin/claude
GITLAB_URL=${GITLAB_URL:-https://git.haku-sci.com}
SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

step() { printf '\n==> %s\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
ask_yes() { local answer; read -rp "$1 " answer; [[ $answer =~ ^[Yy] ]]; }
as_service_user() { sudo -u "$SERVICE_USER" -H bash -c "cd $INSTALL_DIR && $1"; }

[[ $EUID -eq 0 ]] || fail "run as root (sudo bash install.sh)"
[[ -t 0 && -t 1 ]] || fail "run from an interactive terminal (login and trust prompts need one)"
for bin in python3 curl script sudo systemctl; do
  command -v "$bin" >/dev/null || fail "missing dependency: $bin"
done

pick_free_id() {
  local id=$MIN_SERVICE_ID
  while getent passwd "$id" >/dev/null || getent group "$id" >/dev/null || ps -e -o uid= | grep -qx " *$id"; do
    id=$((id + 1))
  done
  echo "$id"
}

create_service_user() {
  local id
  id=$(pick_free_id)
  groupadd --system --gid "$id" "$SERVICE_USER"
  useradd --system --uid "$id" --gid "$id" --home-dir "$SERVICE_HOME" --shell /bin/bash "$@" "$SERVICE_USER"
  echo "created with uid/gid $id"
}

step "Service user $SERVICE_USER"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  create_service_user --create-home
elif (( $(id -u "$SERVICE_USER") < MIN_SERVICE_ID )); then
  echo "uid $(id -u "$SERVICE_USER") may be shared with container users, migrating"
  if systemctl is-active --quiet haku-todo; then systemctl stop haku-todo; fi
  if pgrep -f "^$SERVICE_HOME/" >/dev/null; then pkill -f "^$SERVICE_HOME/"; sleep 2; fi
  mv "$SERVICE_HOME" "$SERVICE_HOME.migrating"
  userdel --force "$SERVICE_USER"
  if getent group "$SERVICE_USER" >/dev/null; then groupdel "$SERVICE_USER"; fi
  create_service_user --no-create-home
  mv "$SERVICE_HOME.migrating" "$SERVICE_HOME"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME"
else
  echo "already exists (uid $(id -u "$SERVICE_USER"))"
fi

step "Files in $INSTALL_DIR (owned by root, read-only for $SERVICE_USER)"
install -d -m 755 "$INSTALL_DIR" "$INSTALL_DIR/.claude" "$INSTALL_DIR/.claude/commands"
install -m 644 "$SOURCE_DIR/CLAUDE.md" "$INSTALL_DIR/CLAUDE.md"
install -m 755 "$SOURCE_DIR/create-issue.py" "$INSTALL_DIR/create-issue.py"
install -m 644 "$SOURCE_DIR/.claude/settings.json" "$INSTALL_DIR/.claude/settings.json"
install -m 644 "$SOURCE_DIR/.claude/commands/todo.md" "$INSTALL_DIR/.claude/commands/todo.md"

step "GitLab token in $ENV_FILE"
install -d -m 700 "$CONFIG_DIR"
if [[ ! -s $ENV_FILE ]] || ask_yes "A token is already configured. Replace it? [y/N]"; then
  read -rsp "Group access token (haku-sci, Reporter, scope api): " token; echo
  [[ -n $token ]] || fail "empty token"
  status=$(curl -sS -o /dev/null -w '%{http_code}' -H @<(printf 'PRIVATE-TOKEN: %s' "$token") "$GITLAB_URL/api/v4/user")
  [[ $status == 200 ]] || fail "GitLab rejected the token (HTTP $status)"
  (umask 077; printf 'GITLAB_TOKEN=%s\nGITLAB_URL=%s\n' "$token" "$GITLAB_URL" > "$ENV_FILE")
  unset token
  echo "token verified and saved"
else
  echo "keeping existing token"
fi

step "Claude Code for $SERVICE_USER"
if [[ -x $CLAUDE_BIN ]]; then
  echo "already installed ($(as_service_user "$CLAUDE_BIN --version"))"
else
  sudo -u "$SERVICE_USER" -H bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
fi

step "One-time setup: login, workspace trust, Remote Control consent"
default_hint="[Y/n]"
[[ -f $SERVICE_HOME/.claude.json ]] && default_hint="[y/N]"
answer=""
read -rp "Run it now? $default_hint " answer
if [[ $answer =~ ^[Yy] || ( -z $answer && $default_hint == "[Y/n]" ) ]]; then
  if systemctl is-active --quiet haku-todo; then systemctl stop haku-todo; fi
  echo
  echo "1/2 Claude Code opens: trust the folder, run /login, then /exit."
  read -rp "Press Enter to continue..."
  as_service_user "$CLAUDE_BIN"
  echo
  echo "2/2 Remote Control starts: answer y, wait for the session URL, then press Ctrl+C."
  read -rp "Press Enter to continue..."
  # A handler (not an ignore) so Ctrl+C stops claude but not this installer.
  trap ':' INT
  rc=0
  as_service_user "$CLAUDE_BIN remote-control" || rc=$?
  trap - INT
  # 130 is the expected exit code after Ctrl+C.
  [[ $rc -eq 0 || $rc -eq 130 ]] || echo "Warning: remote-control exited with code $rc, check its output above." >&2
fi

step "systemd service"
install -m 644 "$SOURCE_DIR/haku-todo.service" "$UNIT_FILE"
systemctl daemon-reload
systemctl enable haku-todo >/dev/null
systemctl restart haku-todo
sleep 5
systemctl is-active --quiet haku-todo || fail "service failed to start, see: journalctl -u haku-todo -n 50"

step "Done"
echo "Claude app -> Code -> session 'haku-todo' -> /todo <service> <description>"
echo "Logs: journalctl -u haku-todo -f"
