import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCopies } from '../scripts/verify-copies.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = JSON.parse(readFileSync(join(root, 'provenance/shared-public.json'), 'utf8'));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ores-copy-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(root, 'contracts'), join(dir, 'contracts'), { recursive: true });
  return { dir, manifest: structuredClone(original) };
}
test('committed copies match both recorded source blob hashes and SHA-256 digests', () => {
  assert.equal(verifyCopies(root, original).length, 2);
});
test('mounted immutable upstream matches both independently authored copies', {
  skip: !process.env.UPSTREAM_ROOT,
}, () => {
  assert.equal(verifyCopies(root, original, process.env.UPSTREAM_ROOT).length, 2);
});
for (const [name, change] of [
  ['empty inventory', m => { m.files = []; }],
  ['duplicate target', m => { m.files[1].path = m.files[0].path; }],
  ['duplicate source', m => { m.files[1].sourcePath = m.files[0].sourcePath; }],
  ['mutable source ref', m => { m.commit = 'main'; }],
  ['unknown manifest field', m => { m.accepted = true; }],
  ['unknown copy field', m => { m.files[0].accepted = true; }],
  ['missing digest', m => { delete m.files[0].sha256; }],
  ['incorrect digest', m => { m.files[0].sha256 = '0'.repeat(64); }],
  ['incorrect source blob', m => { m.files[0].gitBlob = '0'.repeat(40); }],
]) {
  test(`rejects ${name}`, t => {
    const { dir, manifest } = fixture(t);
    change(manifest);
    assert.throws(() => verifyCopies(dir, manifest));
  });
}
test('rejects unsafe paths in either lane', t => {
  const { dir } = fixture(t);
  for (const path of ['/etc/passwd', '../outside', 'contracts/../outside', 'C:\\outside', 'contracts//file', 'contracts/./file', 'contracts/\u0000file']) {
    for (const key of ['path', 'sourcePath']) {
      const manifest = structuredClone(original);
      manifest.files[0][key] = path;
      assert.throws(() => verifyCopies(dir, manifest));
    }
  }
});
test('rejects changed source bytes including whitespace', t => {
  const { dir, manifest } = fixture(t);
  writeFileSync(join(dir, manifest.files[0].path), readFileSync(join(dir, manifest.files[0].path), 'utf8') + '\n');
  assert.throws(() => verifyCopies(dir, manifest), /drift/);
});
test('rejects missing and extra files', t => {
  const { dir, manifest } = fixture(t);
  const extra = join(dir, 'contracts/shared-public/untracked.tsp');
  writeFileSync(extra, 'model Hidden {}\n');
  assert.throws(() => verifyCopies(dir, manifest), /untracked/);
  rmSync(extra);
  rmSync(join(dir, manifest.files[0].path));
  assert.throws(() => verifyCopies(dir, manifest));
});
test('rejects a symlink even when it points to the correct source', t => {
  const { dir, manifest } = fixture(t);
  const path = join(dir, manifest.files[0].path);
  rmSync(path);
  symlinkSync(join(root, manifest.files[0].path), path);
  assert.throws(() => verifyCopies(dir, manifest), /symlink/);
});
test('rejects a symlinked parent directory', t => {
  const { dir, manifest } = fixture(t);
  rmSync(join(dir, 'contracts/shared-public'), { recursive: true });
  symlinkSync(join(root, 'contracts/shared-public'), join(dir, 'contracts/shared-public'));
  assert.throws(() => verifyCopies(dir, manifest), /symlink/);
});
test('rejects a mismatched pinned-upstream mount', t => {
  const { dir, manifest } = fixture(t);
  const upstream = join(dir, 'upstream');
  mkdirSync(join(upstream, 'validation/typespec'), { recursive: true });
  writeFileSync(join(upstream, 'validation/typespec/validation.tsp'), 'model Different {}\n');
  assert.throws(() => verifyCopies(dir, manifest, upstream), /upstream differs/);
});
