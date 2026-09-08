import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withOwnedOutput } from '../scripts/output.mjs';
import { PUBLIC_FILES } from '../scripts/policy.mjs';
// Synthetic bytes test filesystem mechanics ONLY, not TJSV admission.
const fixture = () => Object.fromEntries(PUBLIC_FILES.map((name) => [name, `fixture:${name}\n`]));
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'ores-output-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('promotes only the complete explicit export set as read-only files', async (t) => {
  const root = await workspace(t), output = await withOwnedOutput(root, fixture);
  assert.deepEqual((await readdir(output)).sort(), ['.owner', ...PUBLIC_FILES].sort());
  assert.equal((await lstat(join(output, 'schema.json'))).mode & 0o222, 0);
});
test('failed rebuild removes prior owned admission and releases its own lock', async (t) => {
  const root = await workspace(t); await withOwnedOutput(root, fixture);
  await assert.rejects(withOwnedOutput(root, () => { throw new Error('compiler failed'); }), /compiler failed/);
  await assert.rejects(lstat(join(root, 'generated/public')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(join(root, 'generated')), []);
});
test('unexpected export names never produce a partial package', async (t) => {
  const root = await workspace(t);
  await assert.rejects(withOwnedOutput(root, () => ({ ...fixture(), '../escape': 'no' })), /export set/);
  assert.deepEqual(await readdir(join(root, 'generated')), []);
});
test('never overwrites an unowned directory', async (t) => {
  const root = await workspace(t);
  await mkdir(join(root, 'generated/public'), { recursive: true });
  await writeFile(join(root, 'generated/public/notes.txt'), 'work in progress');
  await assert.rejects(withOwnedOutput(root, fixture), /unowned/);
  assert.equal(await readFile(join(root, 'generated/public/notes.txt'), 'utf8'), 'work in progress');
});
test('never follows a generated-directory symlink', async (t) => {
  const root = await workspace(t), outside = await workspace(t);
  await symlink(outside, join(root, 'generated'), 'dir');
  await assert.rejects(withOwnedOutput(root, fixture), /unsafe generated/);
  assert.deepEqual(await readdir(outside), []);
});
test('never follows a public-output symlink', async (t) => {
  const root = await workspace(t), outside = await workspace(t);
  await mkdir(join(root, 'generated'));
  await symlink(outside, join(root, 'generated/public'), 'dir');
  await assert.rejects(withOwnedOutput(root, fixture), /linked/);
  assert.deepEqual(await readdir(outside), []);
});
test('rejects a second writer without stealing the first writer lock', async (t) => {
  const root = await workspace(t);
  let release, started;
  const barrier = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { started = resolve; });
  const first = withOwnedOutput(root, async () => { started(); await barrier; return fixture(); });
  await ready;
  try { await assert.rejects(withOwnedOutput(root, fixture), { code: 'EEXIST' }); }
  finally { release(); }
  await first;
  assert.equal(await readFile(join(root, 'generated/public/schema.json'), 'utf8'), 'fixture:schema.json\n');
});
