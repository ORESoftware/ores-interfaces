import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { admitRuntimeArtifactBundle } from '../scripts/admit-polyglot-runtime-artifacts.mjs';

const SHA = 'a'.repeat(40);
const evidence = (language, runtime, content) => ({
  schema: 'ores.typespec-json-schema-validator.language-boundary-evidence/v1',
  language, runtime, status: 'passed', sourceRevision: SHA,
  artifactDigest: 'sha256:' + createHash('sha256').update(content).digest('hex'),
  receiptRunId: 'b'.repeat(64), contractIrId: 'c'.repeat(64),
  toolchain: { name: language, version: '1' }, generator: { name: 'TJSV', version: '1' },
  validation: { ingress: 'passed', egress: 'passed' },
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ores-artifact-admit-'));
  const manifest = {
    schema: 'ores.typespec-json-schema-validator.language-boundaries/v1',
    minimumDistinctLanguages: 2,
    authorities: { typeSpec: 'peer', jsonSchema: 'peer', generatedWitness: 'evidence_only' },
    targets: [
      { language: 'rust', runtime: 'native', required: true, ingress: true, egress: true, evidence: 'rust/native.json' },
      { language: 'go', runtime: 'native', required: true, ingress: true, egress: true, evidence: 'go/native.json' },
    ],
  };
  const writeTarget = (i, body) => {
    const target = manifest.targets[i];
    const directory = join(root, target.language);
    mkdirSync(directory, { recursive: true });
    const bytes = body ?? Buffer.from('compiled-test-binary-' + target.language);
    writeFileSync(join(root, target.evidence + '.artifact'), bytes);
    writeFileSync(join(root, target.evidence), JSON.stringify(evidence(target.language, target.runtime, bytes)));
  };
  writeTarget(0);
  writeTarget(1);
  return { root, manifest, writeTarget, run: () => admitRuntimeArtifactBundle({ manifest, artifactRoot: root, expectedSha: SHA }) };
}

test('two different native artifacts and exact head are accepted for downstream TJSV verifier', t => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const result = f.run();
  assert.deepEqual(Object.keys(result).sort(), ['go/native.json', 'rust/native.json']);
  assert.equal(Object.getPrototypeOf(result), null);
});
for (const [label, change, pattern] of [
  ['missing artifact', f => rmSync(join(f.root, 'rust/native.json.artifact')), /native artifact/],
  ['tampered artifact', f => writeFileSync(join(f.root, 'rust/native.json.artifact'), 'malicious-mutation'), /do not match/],
  ['fabricated revision', f => {
    const t = f.manifest.targets[0]; const b = evidence('rust', 'native', Buffer.from('compiled-test-binary-rust'));
    b.sourceRevision = 'f'.repeat(40); writeFileSync(join(f.root, t.evidence), JSON.stringify(b));
  }, /another source revision/],
  ['missing ingress proof', f => {
    const t = f.manifest.targets[0]; const b = evidence('rust', 'native', Buffer.from('compiled-test-binary-rust'));
    b.validation.ingress = 'failed'; writeFileSync(join(f.root, t.evidence), JSON.stringify(b));
  }, /bidirectionally passed/],
  ['duplicate identity', f => { f.manifest.targets[1].language = 'rust'; }, /runtime identity|matching/],
  ['shared binary', f => f.writeTarget(1, Buffer.from('compiled-test-binary-rust')), /same native artifact/],
  ['path traversal', f => { f.manifest.targets[0].evidence = '../outside.json'; }, /canonical repository-relative/],
  ['opted-out runtime', f => { f.manifest.targets[0].required = false; }, /bidirectional/],
  ['single language', f => { f.manifest.targets[1].language = 'rust'; }, /required languages|matching/],
]) {
  test('refuse ' + label, t => {
    const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
    change(f); assert.throws(f.run, pattern);
  });
}
test('refuse symlink that points outside artifact root even if content matches', t => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const link = join(f.root, 'go/native.json.artifact');
  rmSync(link);
  symlinkSync(join(f.root, 'rust/native.json.artifact'), link);
  assert.throws(f.run, /symbolic link/);
});
test('refuse JSON receipt with no underlying native artifact bytes', t => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  rmSync(join(f.root, 'go/native.json.artifact'));
  assert.throws(f.run, /native artifact/);
});
