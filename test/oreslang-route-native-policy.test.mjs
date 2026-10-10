import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { join, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runner = join(root, 'scripts/check-oreslang-route-native.mjs');
function attempt(overrides) {
  return spawnSync(process.execPath, [runner], {
    cwd: root, encoding: 'utf8', timeout: 8000,
    env: {
      ...process.env,
      ORESLANG_BIN: '', ORESLANG_COMPILER_SHA256: '',
      ORESLANG_COMPILER_REVISION: '', ...overrides,
    },
  });
}

test('native Oreslang gate refuses missing compiler without a success receipt', () => {
  const result = attempt({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ORESLANG_BIN/);
  assert.doesNotMatch(result.stdout, /candidate-test-passed/);
});

test('native gate rejects unpinned source revision and arbitrary executable bytes', () => {
  const missingRevision = attempt({
    ORESLANG_BIN: process.execPath,
    ORESLANG_COMPILER_SHA256: '0'.repeat(64),
  });
  assert.notEqual(missingRevision.status, 0);
  assert.match(missingRevision.stderr, /ORESLANG_COMPILER_REVISION/);

  const wrongBinary = attempt({
    ORESLANG_BIN: process.execPath,
    ORESLANG_COMPILER_SHA256: '0'.repeat(64),
    ORESLANG_COMPILER_REVISION: 'a'.repeat(40),
  });
  assert.notEqual(wrongBinary.status, 0);
  assert.match(wrongBinary.stderr, /do not match pinned executable SHA-256/);
});

test('positive and negative fixtures keep import and public method boundary', () => {
  const read = name => readFileSync(join(root, 'contracts/oreslang-route/v1/fixtures', name), 'utf8');
  const valid = read('valid-route.ores');
  const missing = read('missing-post.ores');
  const mismatch = read('wrong-return.ores');
  for (const fixture of [valid, missing, mismatch]) {
    assert.match(fixture, /import contract RouteContract from "\.\.\/RouteContract\.ores";/);
    assert.match(fixture, /define module Route conforms RouteContract as/);
  }
  assert.match(valid, /pub fnc get\(String request\): String/);
  assert.match(valid, /pub fnc post\(String request\): String/);
  assert.doesNotMatch(missing, /pub fnc post\(/);
  assert.match(mismatch, /pub fnc get\(String request\): int/);
});
