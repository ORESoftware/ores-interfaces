import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DECLARATIONS, validatePolicy } from '../scripts/policy.mjs';
import { readTjsvLock, tjsvLockDigest, validateTjsvLock } from '../scripts/tjsv-lock.mjs';

const policy = JSON.parse(await readFile(new URL('../shared-interfaces.json', import.meta.url), 'utf8'));
const tjsvLock = await readTjsvLock(new URL('..', import.meta.url).pathname);

function redigest(lock) {
  lock.selfDigest = tjsvLockDigest(lock);
  return lock;
}

test('only the complete isomorphic shared surface is admitted', () => {
  assert.equal(validateTjsvLock(tjsvLock), tjsvLock);
  assert.equal(validatePolicy(policy, tjsvLock), policy);
  assert.equal(DECLARATIONS.length, 4);
});

for (const [name, mutate] of [
  ['unversioned policy', (p) => { p.schema = 'unknown'; }],
  ['wrong consumer', (p) => { p.repository = 'other/repo'; }],
  ['wrong authority owner', (p) => { p.source.repository = 'other/repo'; }],
  ['wrong validator mirror owner', (p) => { p.validator.repository = 'other/tool'; }],
  ['floating source pin', (p) => { p.source.commit = 'main'; }],
  ['floating validator mirror pin', (p) => { p.validator.commit = 'latest'; }],
  ['immutable validator mirror drift', (p) => { p.validator.commit = '0'.repeat(40); }],
  ['ranked authority', (p) => { p.authorityModel = 'typespec-first'; }],
  ['implicit authority transfer', (p) => { p.authorityTransfer = true; }],
  ['missing declaration', (p) => { p.expectedDeclarations.pop(); }],
  ['duplicate declaration', (p) => { p.expectedDeclarations.push(p.expectedDeclarations[0]); }],
  ['private declaration', (p) => { p.scopes.server.push('TrustedActor'); }],
  ['browser server leak', (p) => { p.runtimeExports.browser.push('server'); }],
  ['edge server leak', (p) => { p.runtimeExports.edge = ['server']; }],
]) test(`rejects ${name}`, () => {
  const changed = structuredClone(policy); mutate(changed);
  assert.throws(() => validatePolicy(changed, tjsvLock));
});

test('rejects mutable execution revision in the TJSV consumer lock', () => {
  const changed = structuredClone(tjsvLock);
  changed.revision = 'main';
  redigest(changed);
  assert.throws(() => validatePolicy(policy, changed), /immutable lowercase 40-character/);
});

test('rejects wrong execution repository in the TJSV consumer lock', () => {
  const changed = structuredClone(tjsvLock);
  changed.repository = 'other/typespec-json-schema-validator';
  redigest(changed);
  assert.throws(() => validatePolicy(policy, changed));
});

test('rejects ancestry-based compatibility inference even with a valid digest', () => {
  const changed = structuredClone(tjsvLock);
  changed.compatibilityPolicy.inferenceFromGitAncestryAllowed = true;
  redigest(changed);
  assert.throws(() => validatePolicy(policy, changed), /must never be inferred from Git ancestry/);
});

test('rejects a changed lock without a recomputed self-digest', () => {
  const changed = structuredClone(tjsvLock);
  changed.assuranceProfile = 'tampered-profile';
  assert.throws(() => validateTjsvLock(changed));
});

test('rejects a re-digested execution revision that no longer matches public provenance', () => {
  const changed = structuredClone(tjsvLock);
  changed.revision = '1'.repeat(40);
  redigest(changed);
  assert.throws(() => validatePolicy(policy, changed), /public provenance validator revision drifted/);
});
