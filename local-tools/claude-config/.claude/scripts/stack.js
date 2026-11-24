// Local Haku-Sci stack, as VS Code's "Start all services" compound (services/.vscode/launch.json),
// without the services of SKIPPED_SERVICES and with those of EXTRA_SERVICES.
// Usage: node stack.js status | tools | start [--without-cron] | cron | wait [seconds] | stop
//   status  which local tools and services of the compound are up (exit 1 if any service is down)
//   tools   starts the local tools (consul, neo4j, postgres) if any is down, through launch.json's
//           "[Local Tools] start local tools", with no window, and waits until they answer
//   start   `tools`, then starts every service that is down, in the background with no window and
//           without debugger; logs in .claude/logs/. `--without-cron` starts everything except Cron
//   cron    starts Cron only, once every other service is up (exit 1 listing the ones still down); does nothing
//           if Cron is already up (launched by this script or by VS Code). Cron runs all its jobs at startup
//   wait    polls until every service is up (default 600 s), then exit 0; on timeout, prints the logs' tails.
//           Cron is not waited for unless this script launched it.
//           A service that failed because its port was taken is started again: it then finds a free one.
//   stop    stops only what `start` launched (recorded in .claude/state/stack.json)
const fs = require('fs');
const net = require('net');
const path = require('path');
const https = require('https');
const http = require('http');
const { execFileSync } = require('child_process');

const WORKSPACE = path.resolve(process.env.CLAUDE_PROJECT_DIR || 'D:/Haku-Sci/services');
const LAUNCH = path.join(WORKSPACE, '.vscode', 'launch.json');
const CLAUDE_DIR = path.join(WORKSPACE, '.claude');
const LOG_DIR = path.join(CLAUDE_DIR, 'logs');
const STATE = path.join(CLAUDE_DIR, 'state', 'stack.json');
const COMPOUND = 'Start all services';
const CONSUL = 'http://hubs.haku-test.com:8500';
// Services checked over HTTP; every other configuration of the compound registers in Consul.
const HTTP_CHECKS = { Front: 'https://haku-test.com', Api: 'https://api.haku-test.com/is-alive' };
const LOCAL_TOOLS_CONFIGURATION = '[Local Tools] start local tools';
const CONSUL_ADDRESS = { host: '127.30.0.4', port: 8500 };
const CONTAINERS = { postgres: 5432, neo4j: 7687 };
const SPAWN_HIDDEN = path.join(__dirname, 'spawn_hidden.py');
const SKIPPED_SERVICES = new Set(['Logs']);
// Configurations outside the compound that belong to the stack.
const EXTRA_SERVICES = ['Cron'];
// Services with no Consul registration nor HTTP endpoint: up while the process `start` launched is alive.
const PROCESS_CHECKS = new Set(['Cron']);
const CRON = 'Cron';
const MAX_PORT_RETRIES = 3;

// launch.json is JSONC: drop comments and trailing commas outside strings.
function parseJsonc(text) {
  let out = '';
  for (let i = 0, inString = false; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') out += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const substitute = (value) => String(value).replace(/\$\{workspaceFolder\}/g, WORKSPACE.replace(/\\/g, '/'));

const readLaunch = () => parseJsonc(fs.readFileSync(LAUNCH, 'utf8'));

function compound() {
  const launch = readLaunch();
  const entry = launch.compounds.find((c) => c.name === COMPOUND);
  const configurations = entry.configurations
    .filter((name) => !SKIPPED_SERVICES.has(name))
    .concat(EXTRA_SERVICES)
    .map((name) => launch.configurations.find((c) => c.name === name));
  return { entry, configurations };
}

function get(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    // Local dev certificates are mkcert ones: health checks only, never for data.
    const request = client.get(url, { rejectUnauthorized: false, timeout: 4000 }, (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve({ status: 0, body: '' }));
  });
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    socket.setTimeout(2000);
    socket.on('connect', () => (socket.destroy(), resolve(true)));
    socket.on('timeout', () => (socket.destroy(), resolve(false)));
    socket.on('error', () => resolve(false));
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function status() {
  const { configurations } = compound();
  const consul = await get(`${CONSUL}/v1/health/state/passing`);
  let passing = new Set();
  try {
    passing = new Set(JSON.parse(consul.body).map((check) => check.ServiceName));
  } catch {}
  const result = {};
  for (const { name } of configurations) {
    if (PROCESS_CHECKS.has(name)) {
      const started = readState().processes.find((p) => p.name === name);
      result[name] = (Boolean(started) && processAlive(started.pid)) || (name === CRON && externalCronRunning());
    } else if (HTTP_CHECKS[name]) {
      const { status: code } = await get(HTTP_CHECKS[name]);
      result[name] = code > 0 && code < 500;
    } else {
      result[name] = passing.has(name.toLowerCase());
    }
  }
  return { tools: await toolsStatus(), services: result };
}

// Cron registers nowhere: a Cron started elsewhere (VS Code) is found from the command lines of the
// running processes (any process whose command line points into the cron service folder).
function externalCronRunning() {
  try {
    const lines = process.platform === 'win32'
      ? execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }'], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
      : execFileSync('ps', ['-eo', 'args'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return lines.split(/\r?\n/).some((line) => /services[\\/]cron([\\/]|\s|$)/i.test(line) && !line.includes('stack.js'));
  } catch {
    return false;
  }
}

// Services `wait` requires: all, except Cron when this script did not launch it.
function required(services) {
  const cronLaunched = readState().processes.some((p) => p.name === CRON);
  return Object.entries(services).filter(([name]) => name !== CRON || cronLaunched);
}

async function toolsStatus() {
  const tools = { consul: await portOpen(CONSUL_ADDRESS.port, CONSUL_ADDRESS.host) };
  for (const [container, port] of Object.entries(CONTAINERS)) tools[container] = await portOpen(port);
  return tools;
}

function print({ tools, services }) {
  for (const [name, up] of Object.entries(tools)) console.log(`${name}: ${up ? 'up' : 'DOWN'}`);
  for (const [name, up] of Object.entries(services)) console.log(`${name}: ${up ? 'up' : 'DOWN'}`);
}

function readState() {
  const empty = { processes: [], containers: [], consul: false };
  try {
    return { ...empty, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) };
  } catch {
    return empty;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

// Through spawn_hidden.py: a hidden console the whole process tree inherits, so no window opens
// (Node's `detached` gives no console, and every child then opens a visible one).
function launchHidden(state, name, commandLine, cwd, env) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const log = path.join(LOG_DIR, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  const pid = Number(execFileSync('python', ['-I', SPAWN_HIDDEN, '--log', log, '--cwd', cwd, '--', commandLine], { env, encoding: 'utf8', windowsHide: true }).trim());
  state.processes = state.processes.filter((p) => p.name !== name).concat({ name, pid, log });
  writeState(state);
  console.log(`started ${name} (pid ${pid}), log: ${log}`);
}

const quote = (value) => `"${value}"`;

// launch.json's "[Local Tools] start local tools", run hidden: it starts consul and the containers
// (each one only if it is not already running). What was down is recorded, so `stop` closes only that.
async function startLocalTools(state) {
  const before = await toolsStatus();
  if (Object.values(before).every(Boolean)) return console.log('Local tools (consul, neo4j, postgres) are already up.');
  const config = readLaunch().configurations.find((c) => c.name === LOCAL_TOOLS_CONFIGURATION);
  if (!config) throw new Error(`"${LOCAL_TOOLS_CONFIGURATION}" not found in ${LAUNCH}`);
  if (!before.consul) state.consul = true;
  for (const container of Object.keys(CONTAINERS)) {
    if (!before[container] && !state.containers.includes(container)) state.containers.push(container);
  }
  launchHidden(state, 'LocalTools', substitute(config.command), WORKSPACE, process.env);
  for (let elapsed = 0; elapsed < 180; elapsed += 5) {
    const tools = await toolsStatus();
    if (Object.values(tools).every(Boolean) && (await get(`${CONSUL}/v1/status/leader`)).status === 200) {
      return console.log('Local tools (consul, neo4j, postgres) are up.');
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log('Warning: local tools still not ready after 180 s.');
}

async function start(withoutCron) {
  const state = readState();
  await startLocalTools(state);
  const current = await status();
  const down = Object.entries(current.services).filter(([name, up]) => !up && !(withoutCron && name === CRON)).map(([name]) => name);
  if (!down.length) return console.log(`All services${withoutCron ? ' but Cron' : ''} of "Start all services" are already up.`);
  const { configurations } = compound();

  for (const config of configurations.filter((c) => down.includes(c.name))) launchConfiguration(state, config);
}

// Cron only, and only once every other service is registered: its jobs all run at startup.
async function startCron() {
  const current = await status();
  if (current.services[CRON]) return console.log('Cron is already up: nothing started.');
  const down = Object.entries(current.services).filter(([name, up]) => name !== CRON && !up).map(([name]) => name);
  if (down.length) {
    console.error(`Cron not started: these services are still down: ${down.join(', ')}. Run "start --without-cron" then "wait" first.`);
    process.exit(1);
  }
  launchConfiguration(readState(), compound().configurations.find((c) => c.name === CRON));
}

// Normal mode: the configuration's own command, without the VS Code / debugpy debugger.
function launchConfiguration(state, config) {
  const env = { ...process.env, ...readEnvFile(substitute(config.envFile || '')) };
  for (const [key, value] of Object.entries(config.env || {})) env[key] = substitute(value);
  if (config.type === 'debugpy') {
    launchHidden(state, config.name, `python ${quote(substitute(config.program))}`, substitute(config.cwd || WORKSPACE), env);
  } else {
    launchHidden(state, config.name, substitute(config.command), WORKSPACE, env);
  }
}

function killProcessTree(pid) {
  if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else process.kill(-pid);
}

// Services started by `start` whose log shows their port was already taken get started again.
function restartPortConflicts(down, retries) {
  const state = readState();
  const { configurations } = compound();
  for (const name of down) {
    const started = state.processes.find((p) => p.name === name);
    if (!started || !fs.existsSync(started.log) || (retries[name] ?? 0) >= MAX_PORT_RETRIES) continue;
    if (!fs.readFileSync(started.log, 'utf8').includes('EADDRINUSE')) continue;
    retries[name] = (retries[name] ?? 0) + 1;
    console.log(`${name} found its port taken: starting it again (attempt ${retries[name]})`);
    try {
      killProcessTree(started.pid);
    } catch {}
    launchConfiguration(state, configurations.find((c) => c.name === name));
  }
}

async function wait(seconds) {
  const deadline = Date.now() + seconds * 1000;
  const retries = {};
  let current;
  while (Date.now() < deadline) {
    current = await status();
    if (required(current.services).every(([, up]) => up)) {
      print(current);
      return console.log('All services are up.');
    }
    restartPortConflicts(required(current.services).filter(([, up]) => !up).map(([name]) => name), retries);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  print(current);
  const { processes } = readState();
  for (const [name, up] of Object.entries(current.services)) {
    const started = processes.find((p) => p.name === name);
    if (!up && started && fs.existsSync(started.log)) {
      console.log(`\n--- last lines of ${started.log}`);
      console.log(fs.readFileSync(started.log, 'utf8').split(/\r?\n/).slice(-30).join('\n'));
    }
  }
  console.log(`Timeout after ${seconds} s: some services are still down.`);
  process.exit(1);
}

function stop() {
  const state = readState();
  // Services first, then the local tools they depend on.
  for (const { name, pid } of state.processes) {
    try {
      killProcessTree(pid);
      console.log(`stopped ${name} (pid ${pid})`);
    } catch {
      console.log(`${name} (pid ${pid}) was not running`);
    }
  }
  // start-local-tools.py exits right after launching consul, so consul is no longer in a recorded tree.
  if (state.consul) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/IM', 'consul.exe', '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else execFileSync('pkill', ['-f', 'consul agent'], { stdio: 'ignore' });
      console.log('stopped consul');
    } catch {
      console.log('consul was not running');
    }
  }
  for (const container of state.containers) {
    try {
      execFileSync('docker', ['stop', container], { stdio: 'ignore', windowsHide: true });
      console.log(`stopped container ${container}`);
    } catch {
      console.log(`container ${container} was not running`);
    }
  }
  writeState({ processes: [], containers: [], consul: false });
}

(async () => {
  const [command, arg] = process.argv.slice(2);
  if (command === 'status') {
    const current = await status();
    print(current);
    process.exit(Object.values(current.services).every(Boolean) ? 0 : 1);
  } else if (command === 'tools') {
    await startLocalTools(readState());
  } else if (command === 'start') {
    await start(process.argv.includes('--without-cron'));
  } else if (command === 'cron') {
    await startCron();
  } else if (command === 'wait') {
    await wait(Number(arg) || 600);
  } else if (command === 'stop') {
    stop();
  } else {
    console.error('Usage: node stack.js status | tools | start [--without-cron] | cron | wait [seconds] | stop');
    process.exit(2);
  }
})();
