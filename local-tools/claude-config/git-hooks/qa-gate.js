// Git pre-push gate: a push to `integration` needs a /qa run with no blocking finding and no
// failed test after this repository's last allowed push. Called by each repository's .git/hooks/pre-push.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const STATE_DIR = path.join(__dirname, '..', '.claude', 'state');
const REVIEWS = path.join(STATE_DIR, 'reviews.json');
const PUSHES = path.join(STATE_DIR, 'pushes.json');
const ZERO = /^0+$/;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function commitTime(sha) {
  try {
    return Number(execFileSync('git', ['log', '-1', '--format=%ct', sha], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()) || 0;
  } catch {
    return 0;
  }
}

function refuse(reason) {
  console.error(`Push to integration refused: ${reason}`);
  console.error('Bypass deliberately with: git push --no-verify');
  process.exit(1);
}

const repo = path.resolve(process.cwd()).replace(/\\/g, '/').toLowerCase();
const qa = readJson(REVIEWS).qa;
const pushes = readJson(PUSHES);

// stdin: "<local ref> <local sha> <remote ref> <remote sha>" per pushed ref.
const lines = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
const gated = lines.some((line) => {
  const [, localSha, remoteRef, remoteSha] = line.split(' ');
  if (remoteRef !== 'refs/heads/integration' || ZERO.test(localSha)) return false;
  // Before this gate ever allowed a push here, the remote head's commit time is the best bound.
  const since = pushes[repo] || (ZERO.test(remoteSha) ? 0 : commitTime(remoteSha));
  if (!qa || qa.at <= since) refuse('run /qa in Claude Code on these changes first (no /qa since the last push).');
  if (qa.blocking > 0) refuse(`the last /qa reported ${qa.blocking} blocking finding(s). Fix them and run /qa again.`);
  if (qa.failed !== 0) refuse(`the last /qa ended with ${qa.failed ?? 'unrecorded'} failed or blocked test(s). Fix them and run /qa again.`);
  return true;
});

if (gated) {
  pushes[repo] = Math.floor(Date.now() / 1000);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(PUSHES, JSON.stringify(pushes, null, 2));
}
