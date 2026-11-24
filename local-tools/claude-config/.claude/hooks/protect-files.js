// PreToolUse (Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell):
// secrets and certificates are never written by Claude, and INIT (TypeORM synchronize) is never set.
const path = require('path');
const { readInput, deny } = require('./lib');

const ENV_NAME = String.raw`\.env(?!\.(?:example|sample|template))(?!\w)`;
const SECRET_FILE = new RegExp(String.raw`(^|[\\/])${ENV_NAME}[\w.-]*$`, 'i');
const CERT_FILE = /(^|[\\/])certificates[\\/]|\.(pem|key)$/i;
// Writing commands followed (in the same pipeline segment) by a protected path.
const SHELL_WRITE = new RegExp(
  String.raw`(>>?|\b(?:Set-Content|Add-Content|Out-File|tee|cp|mv|Copy-Item|Move-Item|Remove-Item|rm|del)\b|\bsed\s+-i)` +
    String.raw`[^|;&\n]*?(${ENV_NAME}|certificates[\\/]|\.pem\b|\.key\b)`,
  'i',
);
// INIT=<value>, export INIT=<value>, $env:INIT = <value>, setx INIT <value>
// Only at a command position, so `grep INIT=` or a commit message mentioning it is not caught.
const SET_INIT = /(^\s*|[;&|(]\s*|\bexport\s+|\benv\s+(\w+=\S*\s+)*)INIT=(?!\s|$|["']{2})|\$env:INIT\s*=|\bsetx\s+INIT\b/i;

const input = readInput();
const toolInput = input.tool_input || {};

if (['Bash', 'PowerShell'].includes(input.tool_name)) {
  const command = String(toolInput.command || '');
  if (SET_INIT.test(command))
    deny('INIT enables TypeORM synchronize (and Boolean(process.env.INIT) is true even for "false"). Ask the user to set it themselves if a schema sync is really intended.');
  if (SHELL_WRITE.test(command))
    deny('This command writes to a protected file (.env, certificates/, *.pem, *.key). Ask the user to make this change themselves.');
} else {
  const file = String(toolInput.file_path || toolInput.notebook_path || '');
  if (SECRET_FILE.test(file) || CERT_FILE.test(file))
    deny(`${path.basename(file)} is protected (secrets / certificates). Ask the user to edit it themselves.`);
}
