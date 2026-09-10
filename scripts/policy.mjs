import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertPublicValidatorMirror, readTjsvLock, validateTjsvLock } from './tjsv-lock.mjs';

export const DECLARATIONS = Object.freeze([
  'Ores.Validation.PageQuery', 'Ores.Validation.ProblemDetails',
  'Ores.Validation.PublicValidationContract', 'Ores.Validation.RequestMeta',
]);
export const PUBLIC_FILES = Object.freeze(['LICENSE.upstream', 'main.tsp', 'provenance.json', 'schema.json']);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function validatePolicy(policy, tjsvLock) {
  assert.equal(policy?.schema, 'ores.shared-interfaces-source/v1');
  assert.equal(policy.repository, 'ORESoftware/ores-interfaces');
  assert.equal(policy.source?.repository, 'ores-otel/ores-interfaces');
  assert.equal(policy.validator?.repository, 'ORESoftware/typespec-json-schema-validator');
  for (const pin of [policy.source.commit, policy.validator.commit])
    assert.match(pin, /^[a-f0-9]{40}$/, 'full immutable dependency commit required');
  assert.equal(policy.authorityModel, 'independent-typespec-and-json-schema-peers');
  assert.equal(policy.authorityTransfer, false, 'legacy authorities must not be transferred implicitly');
  assert.deepEqual(policy.expectedDeclarations, DECLARATIONS, 'complete public declaration inventory required');
  assert.deepEqual(policy.scopes, { isomorphic: [...DECLARATIONS], client: [], edge: [], server: [] });
  assert.deepEqual(policy.runtimeExports, {
    browser: ['isomorphic'], node: ['isomorphic'], deno: ['isomorphic'],
    bun: ['isomorphic'], edge: ['isomorphic'], native: ['isomorphic'],
  }, 'public source package must never export a server scope');
  validateTjsvLock(tjsvLock);
  assertPublicValidatorMirror(policy, tjsvLock);
  return policy;
}

export async function readPolicyAndTjsvLock(root) {
  const [policy, tjsvLock] = await Promise.all([
    readFile(join(root, 'shared-interfaces.json'), 'utf8').then(JSON.parse),
    readTjsvLock(root),
  ]);
  validatePolicy(policy, tjsvLock);
  return Object.freeze({ policy, tjsvLock });
}

export async function readPolicy(root) {
  return (await readPolicyAndTjsvLock(root)).policy;
}
