import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const TJSV_LOCK_PATH = 'contracts/tjsv-consumer.lock.json';
export const TJSV_LOCK_SCHEMA = 'ores.tjsv-consumer-lock/v1';
export const TJSV_REPOSITORY = 'ORESoftware/typespec-json-schema-validator';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (object(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function tjsvLockDigest(lock) {
  const copy = structuredClone(lock);
  delete copy.selfDigest;
  return createHash('sha256').update(canonicalJson(copy)).digest('hex');
}

function exactKeys(value, expected, name) {
  assert.ok(object(value), `${name} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${name} keys changed`);
}

export function validateTjsvLock(lock) {
  exactKeys(lock, [
    'schema', 'repository', 'revision', 'assuranceProfile', 'sourceRevisionBinding',
    'compatibilityPolicy', 'publicProvenanceMirror', 'upstreamSourceLock',
    'evidenceSchemas', 'currentConsumers', 'scanPolicy', 'selfDigestAlgorithm', 'selfDigest',
  ], 'TJSV consumer lock');
  assert.equal(lock.schema, TJSV_LOCK_SCHEMA);
  assert.equal(lock.repository, TJSV_REPOSITORY);
  assert.match(lock.revision, SHA40, 'TJSV revision must be an immutable lowercase 40-character Git commit');
  assert.equal(lock.assuranceProfile, 'shared-interface-parity-and-package-consumption');
  assert.equal(lock.sourceRevisionBinding, 'runtime-git-head');

  exactKeys(lock.compatibilityPolicy,
    ['inferenceFromGitAncestryAllowed', 'policyIssue', 'qualificationIssue'], 'compatibility policy');
  assert.equal(lock.compatibilityPolicy.inferenceFromGitAncestryAllowed, false,
    'TJSV compatibility must never be inferred from Git ancestry');
  for (const field of ['policyIssue', 'qualificationIssue'])
    assert.match(lock.compatibilityPolicy[field], /^https:\/\/github\.com\/ORESoftware\/\.github\/issues\/[1-9][0-9]*$/);

  exactKeys(lock.publicProvenanceMirror,
    ['path', 'repositoryPointer', 'revisionPointer'], 'public provenance mirror');
  assert.equal(lock.publicProvenanceMirror.path, 'shared-interfaces.json');
  assert.equal(lock.publicProvenanceMirror.repositoryPointer, '/validator/repository');
  assert.equal(lock.publicProvenanceMirror.revisionPointer, '/validator/commit');

  exactKeys(lock.upstreamSourceLock, ['path', 'schema'], 'upstream source lock');
  assert.equal(lock.upstreamSourceLock.path, 'validation/tjsv/source-lock.json');
  assert.equal(lock.upstreamSourceLock.schema, 'ores.tjsv-source-lock/v1');

  assert.deepEqual(lock.evidenceSchemas, ['ores.shared-public-admission/v1']);
  assert.ok(Array.isArray(lock.currentConsumers) && lock.currentConsumers.length > 0,
    'current TJSV consumers must be enumerated');
  const paths = new Set();
  for (const consumer of lock.currentConsumers) {
    exactKeys(consumer, ['path', 'binding'], 'current consumer');
    assert.match(consumer.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._/@+-]+)*$/);
    assert.ok(typeof consumer.binding === 'string' && consumer.binding.length > 0);
    assert.ok(!paths.has(consumer.path), `duplicate TJSV consumer path: ${consumer.path}`);
    paths.add(consumer.path);
  }

  exactKeys(lock.scanPolicy,
    ['allowMutableRefs', 'allowShortShas', 'allowWrongRepository', 'allowDuplicateLocks', 'allowMirrorDrift'],
    'scan policy');
  for (const value of Object.values(lock.scanPolicy)) assert.equal(value, false, 'consumer drift must fail closed');

  assert.equal(lock.selfDigestAlgorithm, 'sha256-sorted-json-v1');
  assert.match(lock.selfDigest, SHA256, 'TJSV lock selfDigest must be lowercase SHA-256');
  assert.equal(tjsvLockDigest(lock), lock.selfDigest, 'TJSV consumer lock selfDigest mismatch');
  return lock;
}

export async function readTjsvLock(root) {
  return validateTjsvLock(JSON.parse(await readFile(join(root, TJSV_LOCK_PATH), 'utf8')));
}

export function assertPublicValidatorMirror(policy, lock) {
  assert.equal(policy?.validator?.repository, lock.repository,
    'shared-interface public provenance validator repository drifted from the TJSV consumer lock');
  assert.equal(policy?.validator?.commit, lock.revision,
    'shared-interface public provenance validator revision drifted from the TJSV consumer lock');
  return policy;
}
