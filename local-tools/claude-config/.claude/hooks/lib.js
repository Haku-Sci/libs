// Shared helpers for the Haku-Sci Claude Code hooks.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// The workspace the hooks run for (services/), not where the files physically live:
// .claude is a junction into libs/local-tools/claude-config, and Node resolves junctions.
const ROOT = path.resolve(process.env.CLAUDE_PROJECT_DIR || 'D:/Haku-Sci/services');
const STATE_DIR = path.join(__dirname, '..', 'state');

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function readState(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeState(name, value) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, name), JSON.stringify(value, null, 2));
}

function removeState(name) {
  fs.rmSync(path.join(STATE_DIR, name), { force: true });
}

// PreToolUse: refuse the call and tell Claude why.
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function normalize(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

module.exports = { ROOT, readInput, readState, writeState, removeState, deny, git, normalize };
