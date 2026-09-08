import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLIC_FILES } from './policy.mjs';

const MARKER = 'ores-interfaces/public-source/v1\n';
const names = [...PUBLIC_FILES, '.owner'].sort();
async function statOrMissing(path) {
  try { return await lstat(path); } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}
async function ensureDirectory(path) {
  const stat = await statOrMissing(path);
  if (!stat) { await mkdir(path); return; }
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), `unsafe generated directory: ${path}`);
}
async function invalidateOwnedOutput(target) {
  const stat = await statOrMissing(target);
  if (!stat) return;
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'refusing a linked or non-directory output');
  const entries = await readdir(target, { withFileTypes: true });
  assert.ok(entries.every((entry) => names.includes(entry.name) && entry.isFile()), 'unowned output files must be reviewed, not deleted');
  assert.equal(await readFile(join(target, '.owner'), 'utf8'), MARKER, 'unowned output directory');
  // Invalidate admission first. Only known, owned, regular files may be removed.
  if (entries.some((entry) => entry.name === 'provenance.json')) await unlink(join(target, 'provenance.json'));
  for (const entry of entries) if (entry.name !== 'provenance.json') await unlink(join(target, entry.name));
  await rmdir(target);
}

/** Single-writer, fail-closed promotion in a repository-owned generated directory.
 * Unknown files, symlinks and another invocation's lock are never removed.
 */
export async function withOwnedOutput(root, produce) {
  root = await realpath(root);
  const generated = join(root, 'generated');
  await ensureDirectory(generated);
  const lock = join(generated, '.build-lock');
  await mkdir(lock); // EEXIST stops; never steal or silently clear a lock.
  let stage;
  try {
    const target = join(generated, 'public');
    await invalidateOwnedOutput(target);
    stage = await mkdtemp(join(generated, '.stage-'));
    const files = await produce();
    assert.deepEqual(Object.keys(files).sort(), PUBLIC_FILES, 'unexpected public export set');
    for (const [name, text] of Object.entries(files)) {
      assert.equal(typeof text, 'string');
      await writeFile(join(stage, name), text, { flag: 'wx', mode: 0o444 });
    }
    await writeFile(join(stage, '.owner'), MARKER, { flag: 'wx', mode: 0o444 });
    await rename(stage, target);
    stage = undefined;
    return target;
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    await rmdir(lock);
  }
}
