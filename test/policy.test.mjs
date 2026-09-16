import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DECLARATIONS, validatePolicy } from '../scripts/policy.mjs';

const policy = JSON.parse(await readFile(new URL('../shared-interfaces.json', import.meta.url), 'utf8'));
const stack = JSON.parse(await readFile(new URL('../contract-stack.json', import.meta.url), 'utf8'));
const immutableSha = /^[a-f0-9]{40}$/;

test('only the complete isomorphic shared surface is admitted', () => {
  assert.equal(validatePolicy(policy), policy);
  assert.equal(DECLARATIONS.length, 6);
});

test('contract stack separates authority, conformance and persistence convergence', () => {
  assert.equal(stack.schema, 'ores.contract-stack/v1');
  assert.equal(stack.repository, 'ORESoftware/ores-interfaces');
  assert.deepEqual(stack.authority, {
    role: 'shared-contract-registry',
    model: 'independent-typespec-and-json-schema-peers',
  });

  const tjsv = stack.tools.wireAndRuntimeConformance;
  assert.equal(tjsv.repository, 'ORESoftware/typespec-json-schema-validator');
  assert.match(tjsv.commit, immutableSha);
  assert.equal(tjsv.commit, policy.validator.commit, 'legacy and registry lanes must use the same reviewed TJSV revision');
  assert.deepEqual(tjsv.requiredFor, ['wire-parity', 'contract-ir', 'runtime-conformance']);

  const persistence = stack.tools.persistenceConvergence;
  assert.equal(persistence.repository, 'ORESoftware/ores-contracts');
  assert.match(persistence.commit, immutableSha);
  assert.deepEqual(persistence.requiredFor, ['declared-persistence-subset']);

  assert.deepEqual(stack.orchestrator, {
    repository: 'ORESoftware/ores-cli',
    role: 'resolved-version-policy-only',
  });
  assert.equal(stack.legacyCompatibilityManifest, 'shared-interfaces.json');
});

for (const [name, mutate] of [
  ['unversioned policy', (p) => { p.schema = 'unknown'; }],
  ['wrong consumer', (p) => { p.repository = 'other/repo'; }],
  ['wrong authority owner', (p) => { p.source.repository = 'other/repo'; }],
  ['wrong validator owner', (p) => { p.validator.repository = 'other/tool'; }],
  ['floating source pin', (p) => { p.source.commit = 'main'; }],
  ['floating toolchain pin', (p) => { p.validator.commit = 'latest'; }],
  ['ranked authority', (p) => { p.authorityModel = 'typespec-first'; }],
  ['implicit authority transfer', (p) => { p.authorityTransfer = true; }],
  ['missing declaration', (p) => { p.expectedDeclarations.pop(); }],
  ['duplicate declaration', (p) => { p.expectedDeclarations.push(p.expectedDeclarations[0]); }],
  ['private declaration', (p) => { p.scopes.server.push('TrustedActor'); }],
  ['browser server leak', (p) => { p.runtimeExports.browser.push('server'); }],
  ['edge server leak', (p) => { p.runtimeExports.edge = ['server']; }],
]) test(`rejects ${name}`, () => {
  const changed = structuredClone(policy); mutate(changed);
  assert.throws(() => validatePolicy(changed));
});
