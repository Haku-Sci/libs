// Read-only view of the UNCOMMITTED changes across the Haku-Sci repositories (index and working tree
// against HEAD, plus untracked files). Commits, pushed or not, are never part of it.
// No argument: summary of every repo with uncommitted changes, printed. With targets: the diffs are
// written to .claude/state/review/<repo>.diff and only their paths and sizes are printed, to be read
// with the Read tool. A target is `repo` (all its uncommitted changes) or `repo:path1,path2`.
// With --delta: only what changed since the last staging (working tree vs index), i.e. since the last review.
// Usage: node D:/Haku-Sci/services/.claude/scripts/changeset.js [--delta] [repo[:path,...] ...]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKSPACE = path.resolve(process.env.CLAUDE_PROJECT_DIR || 'D:/Haku-Sci/services');
const SIBLINGS = ['libs', 'Gateway'].map((name) => path.join(path.dirname(WORKSPACE), name));
const OUT_DIR = path.join(WORKSPACE, '.claude', 'state', 'review');
const MAX_UNTRACKED_BYTES = 200000;

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return '';
  }
}

const repos = [
  ...fs.readdirSync(WORKSPACE).map((name) => path.join(WORKSPACE, name)),
  ...SIBLINGS,
].filter((dir) => fs.existsSync(path.join(dir, '.git')));

const args = process.argv.slice(2);
const delta = args.includes('--delta');
// repo name (lower case) -> paths to keep, [] meaning all its uncommitted changes.
const targets = new Map();
for (const arg of args.filter((a) => a !== '--delta')) {
  const [name, list] = arg.split(/:(.*)/s);
  targets.set(name.toLowerCase(), list ? list.split(',').map((p) => p.trim()).filter(Boolean) : []);
}
const selected = targets.size ? repos.filter((dir) => targets.has(path.basename(dir).toLowerCase())) : repos;

function uncommittedDiff(repo, paths) {
  const scope = paths.length ? ['--', ...paths] : [];
  const parts = [];
  if (delta) {
    parts.push(`--- staged (already reviewed)\n${git(repo, ['diff', '--cached', '--stat', ...scope]) || '(nothing staged)'}`);
    parts.push(`--- delta since last review (working tree vs index)\n${git(repo, ['diff', ...scope]) || '(none)'}`);
  } else {
    parts.push(`--- uncommitted (index + working tree vs HEAD)\n${git(repo, ['diff', 'HEAD', ...scope]) || '(none)'}`);
  }
  for (const file of git(repo, ['ls-files', '--others', '--exclude-standard', ...scope]).split('\n').filter(Boolean)) {
    const size = fs.statSync(path.join(repo, file)).size;
    const content = size > MAX_UNTRACKED_BYTES ? '(too large, read it directly)' : fs.readFileSync(path.join(repo, file), 'utf8');
    parts.push(`--- untracked ${file} (${size} bytes)\n${content}`);
  }
  return parts;
}

for (const repo of selected) {
  const status = git(repo, ['status', '--porcelain']);
  if (!status) {
    if (targets.size) console.log(`${path.basename(repo)}: no uncommitted changes`);
    continue;
  }
  const header = [`===== ${path.basename(repo)}  (${repo.replace(/\\/g, '/')})`, `--- uncommitted files\n${status}`];

  if (!targets.size) {
    console.log(`\n${[...header, `--- stat\n${git(repo, ['diff', '--stat', 'HEAD']) || '(untracked files only)'}`].join('\n')}`);
    continue;
  }

  const diff = uncommittedDiff(repo, targets.get(path.basename(repo).toLowerCase()));
  const content = [...header, ...diff].join('\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${path.basename(repo)}${delta ? '.delta' : ''}.diff`);
  fs.writeFileSync(out, content);
  const changedLines = diff.join('\n').split('\n').filter((line) => /^[+-](?![+-])/.test(line)).length;
  console.log(`${path.basename(repo)}: ${changedLines} changed lines -> ${out.replace(/\\/g, '/')}  (read it with the Read tool)`);
}
