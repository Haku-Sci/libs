// PostToolUse (Edit|Write|MultiEdit): remember which files this session changed,
// so the Stop hook type-checks only the touched services and refreshes graphify once.
const { readInput, readState, writeState } = require('./lib');

const input = readInput();
const file = input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path);
if (file && input.session_id) {
  const name = `edits-${input.session_id}.json`;
  const files = new Set(readState(name, []));
  files.add(file);
  writeState(name, [...files]);
}
