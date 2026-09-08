import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DECLARATIONS, validatePolicy } from '../scripts/policy.mjs';
const policy = JSON.parse(await readFile(new URL('../shared-interfaces.json', import.meta.url), 'utf8'));
test('only the complete isomorphic shared surface is admitted', () => {
  assert.equal(validatePolicy(policy), policy);
  assert.equal(DECLARATIONS.length, 4);
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
