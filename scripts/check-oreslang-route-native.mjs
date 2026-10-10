// Standalone native/Oreslang smoke. No fake compiler, no silent skips, and no
// fallback to parsing source with JS. This is NOT the TJSV wire admission gate.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertExpectedNativeRejection } from './oreslang-native-rejection.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixtures = join(root, 'contracts/oreslang-route/v1/fixtures');
const binary = process.env.ORESLANG_BIN;
const pinnedDigest = process.env.ORESLANG_COMPILER_SHA256;
const pinnedRevision = process.env.ORESLANG_COMPILER_REVISION;
const MAX = 1024 * 1024;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function run(...args) {
  const result = spawnSync(binary, args, {
    cwd: root, shell: false, encoding: 'utf8', timeout: 120_000, maxBuffer: MAX,
    env: { ...process.env, ORES_CORE_PERF: 'false', ORES_CORE_DEBUG: 'false' },
  });
  if (result.error) throw result.error;
  assert(!result.signal, 'Oreslang compiler terminated by signal');
  return result;
}

assert(typeof binary === 'string' && isAbsolute(binary), 'ORESLANG_BIN must be an absolute compiler executable path');
const compiler = realpathSync(binary);
const info = statSync(compiler);
assert(info.isFile() && info.size > 0, 'compiler path must resolve to a non-empty file');
assert(typeof pinnedDigest === 'string' && /^[a-f0-9]{64}$/.test(pinnedDigest),
  'ORESLANG_COMPILER_SHA256 must pin the executable bytes');
assert(typeof pinnedRevision === 'string' && /^[a-f0-9]{40}$/.test(pinnedRevision),
  'ORESLANG_COMPILER_REVISION must pin the canonical source commit');
assert(sha(readFileSync(compiler)) === pinnedDigest,
  'Oreslang compiler bytes do not match pinned executable SHA-256');

const build = run('--build-info');
assert(build.status === 0, 'compiler --build-info failed');
let buildInfo;
try { buildInfo = JSON.parse(build.stdout.trim()); }
catch { throw new Error('Oreslang --build-info did not return JSON'); }
assert(['aot', 'hybrid', 'jvm'].includes(String(buildInfo.build_mode || '').toLowerCase())
  || ['jit', 'aot', 'hybrid'].includes(String(buildInfo.default_execution_mode || '').toLowerCase()),
  'unrecognized native compiler profile');

const positive = join(fixtures, 'valid-route.ores');
const errors = [
  ['missing-post', join(fixtures, 'missing-post.ores')],
  ['wrong-return', join(fixtures, 'wrong-return.ores')],
];
const check = run('--check', positive);
assert(check.status === 0, 'valid module contract did not compile/link: ' + (check.stderr || '').slice(0, 500));
for (const [kind, path] of errors) {
  const negative = run('--check', path);
  assertExpectedNativeRejection(kind, negative, path);
}
const execution = run(positive);
assert(execution.status === 0, 'valid module contract failed native execution');
assert(execution.stdout.trim() === 'get-ok|post-ok', 'unexpected RouteContract execution result');

const paths = [
  'contracts/oreslang-route/v1/RouteContract.ores',
  'contracts/oreslang-route/v1/fixtures/valid-route.ores',
  'contracts/oreslang-route/v1/fixtures/missing-post.ores',
  'contracts/oreslang-route/v1/fixtures/wrong-return.ores',
];
const sourceHashes = Object.fromEntries(paths.map(path => [path, 'sha256:' + sha(readFileSync(join(root, path)))]));
process.stdout.write(JSON.stringify({
  schema: 'ores.interfaces.oreslang-route-native-check/v1',
  status: 'candidate-test-passed',
  certification: false,
  compilerRevision: pinnedRevision,
  compilerSha256: 'sha256:' + pinnedDigest,
  profile: buildInfo,
  sourceHashes,
  nativeChecks: { valid: 'passed', missingPost: 'rejected', wrongReturn: 'rejected', execution: 'passed' },
}, null, 2) + '\n');
