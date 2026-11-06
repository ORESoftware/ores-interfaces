import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { makeAttoLangInterfaceTarget, verifyAttoLangSourceBytes } from '../scripts/attolang-target-admission.mjs';

const provenance = JSON.parse(readFileSync(new URL(
  '../generated/public/provenance.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(provenance);

test('AttoLang target binds exact two-authority/provenance receipt without claiming guest execution', () => {
  const a = makeAttoLangInterfaceTarget(provenance);
  const b = makeAttoLangInterfaceTarget(clone());
  assert.deepEqual(a, b);
  assert.equal(a.schema, 'ores.interfaces.attolang-target/v1');
  assert.equal(a.language, 'attolang');
  assert.equal(a.status, 'TARGET_ONLY');
  assert.equal(a.backendExecution, 'NOT_EXECUTED');
  assert.equal(a.sourceExtension, '.atto');
  assert.equal(a.legacyExtension, '.ores');
  assert.equal(a.authorities.typespecSha256, provenance.admission.sourceDigests.typespec);
  assert.equal(a.authorities.authoredJsonSchemaSha256, provenance.admission.sourceDigests.authoredSchema);
  assert.deepEqual(a.declarationIds, [...provenance.admission.declarations].sort());
});

for (const [label, mutate] of [
  ['promoted editable authority', p => { p.editableAuthority = true; }],
  ['implicit authority transfer', p => { p.policy.authorityTransfer = true; }],
  ['one-sided authority digest', p => { delete p.admission.sourceDigests.authoredSchema; }],
  ['floating source revision', p => { p.policy.source.commit = 'main'; }],
  ['unexpected validator revision', p => { p.admission.validatorRevision = '1'.repeat(40); }],
  ['zero contract cases', p => { p.admission.recordedCases = 0; }],
  ['missing conformance corpus', p => { p.admission.sourceDigests.corpus = ''; }],
  ['missing source lock', p => { p.admission.sourceDigests.sourceLock = '0'; }],
  ['extra declaration', p => { p.admission.declarations.push('Forged.Contract'); }],
  ['duplicate declaration', p => { p.admission.declarations.push(p.admission.declarations[0]); }],
  ['failed parity admission', p => { p.admission.status = 'failed'; }],
]) {
  test(`AttoLang target fails closed: ${label}`, () => {
    const edited = clone();
    mutate(edited);
    assert.throws(() => makeAttoLangInterfaceTarget(edited), /AttoLang target admission/);
  });
}

test('AttoLang runtime-independent target checks published source bytes, not just claims', () => {
  const typespec = readFileSync(new URL('../generated/public/main.tsp', import.meta.url));
  const authoredSchema = readFileSync(new URL('../generated/public/schema.json', import.meta.url));
  const expected = makeAttoLangInterfaceTarget(provenance);
  assert.deepEqual(verifyAttoLangSourceBytes(provenance, { typespec, authoredSchema }), expected);
  for (const replacement of [
    { typespec: Buffer.from('tampered TypeSpec'), authoredSchema },
    { typespec, authoredSchema: Buffer.from('tampered authored schema') },
    { typespec: authoredSchema, authoredSchema: typespec },
  ]) {
    assert.throws(() => verifyAttoLangSourceBytes(provenance, replacement),
      /AttoLang target admission/);
  }
  assert.throws(() => verifyAttoLangSourceBytes(provenance, {
    typespec, authoredSchema: undefined,
  }), /both published contract authority files/);
});

for (const [label, mutate] of [
  ['published TypeSpec digest mismatch', p => { p.files['main.tsp'] = '0'.repeat(64); }],
  ['published schema digest mismatch', p => { p.files['schema.json'] = '0'.repeat(64); }],
  ['missing published file roster', p => { delete p.files; }],
]) {
  test(`AttoLang source provenance rejects ${label}`, () => {
    const changed = clone();
    mutate(changed);
    assert.throws(() => makeAttoLangInterfaceTarget(changed), /AttoLang target admission/);
  });
}
