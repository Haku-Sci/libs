// Stop: type-check the services this session edited (errors in edited files only,
// pre-existing errors elsewhere are ignored), then refresh the graphify graph in the background.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT, readInput, readState, removeState, normalize } = require('./lib');

const input = readInput();
const stateName = `edits-${input.session_id}.json`;
const files = readState(stateName, []);
if (!files.length) process.exit(0);

// Closest ancestor of the file that has its own tsconfig.json and tsc.
function projectOf(file) {
  let dir = path.dirname(path.resolve(file));
  while (path.dirname(dir) !== dir) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json')) && fs.existsSync(path.join(dir, 'node_modules', '.bin')))
      return dir;
    dir = path.dirname(dir);
  }
  return null;
}

const projects = new Map();
for (const file of files) {
  if (!/\.(ts|tsx)$/.test(file) || !fs.existsSync(file)) continue;
  const project = projectOf(file);
  if (project) (projects.get(project) || projects.set(project, new Set()).get(project)).add(normalize(file));
}

const report = [];
for (const [project, edited] of projects) {
  const result = spawnSync(path.join(project, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc'),
    ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'],
    { cwd: project, encoding: 'utf8', timeout: 180000, shell: process.platform === 'win32' });
  const errors = `${result.stdout || ''}`.split(/\r?\n/).filter((line) => {
    const match = line.match(/^(.+?)\(\d+,\d+\): error TS/);
    return match && edited.has(normalize(path.join(project, match[1])));
  });
  if (errors.length) report.push(`${path.basename(project)}:\n${errors.join('\n')}`);
}

// graphify update is AST-only and can take a while: never block the turn on it.
// A machine without graphify (e.g. the remote server) simply skips it.
// The graph lives at the Haku-Sci root (D:/Haku-Sci/graphify-out) and covers services, libs and Gateway.
const graphify = spawn('graphify', ['update', '.'], { cwd: path.dirname(ROOT), detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
graphify.on('error', () => {});
graphify.unref();

if (report.length && !input.stop_hook_active) {
  process.stderr.write(`TypeScript errors in files edited this session:\n${report.join('\n\n')}\nFix them before finishing.`);
  process.exit(2);
}
removeState(stateName);
