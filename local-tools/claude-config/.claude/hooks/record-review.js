// Records the result of a /qa run for the git pre-push gate (git-hooks/qa-gate.js).
// Usage, from the last step of /qa: node record-review.js qa <blocking findings> <failed tests>
const { readState, writeState } = require('./lib');

const [kind, ...counts] = process.argv.slice(2);
const [blocking, failed] = counts.map(Number);
if (kind !== 'qa' || ![blocking, failed].every((n) => Number.isInteger(n) && n >= 0)) {
  process.stderr.write('Usage: record-review.js qa <blocking findings> <failed tests>\n');
  process.exit(1);
}

const reviews = readState('reviews.json', {});
reviews.qa = { at: Math.floor(Date.now() / 1000), blocking, failed };
writeState('reviews.json', reviews);
process.stdout.write(`Recorded /qa: ${blocking} blocking finding(s), ${failed} failed test(s).\n`);
