import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TREE_BYTES = 256 * 1024 * 1024;

// These are local reads. Ambient Git selectors/config injection must not redirect
// them to a different repository, index, or replacement object database.
async function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  env.GIT_OPTIONAL_LOCKS = '0';
  const result = await exec('git', ['--no-replace-objects', '-C', root,
    '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args],
  { env, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}

async function checkedFile(root, path, mode, objectId) {
  const parts = path.split('/');
  assert.ok(parts.every(part => part && part !== '.' && part !== '..') && !path.includes('\\'),
    'unsupported tracked path');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const info = await lstat(current);
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'linked or non-directory source parent');
  }
  const file = join(root, path);
  const before = await lstat(file);
  assert.ok(before.isFile() && !before.isSymbolicLink(), 'tracked source must be a regular file');
  assert.ok(before.size <= MAX_FILE_BYTES, 'tracked source exceeds size bound');
  if (process.platform !== 'win32')
    assert.equal(Boolean(before.mode & 0o111), mode === '100755', 'tracked executable mode drift');

  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await handle.stat();
    assert.ok(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino,
      'tracked source changed while opening');
    assert.ok(opened.size <= MAX_FILE_BYTES, 'tracked source exceeds size bound');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const linked = await lstat(file);
    assert.ok(linked.isFile() && !linked.isSymbolicLink() && linked.dev === after.dev && linked.ino === after.ino,
      'tracked source path changed during read');
    assert.equal(after.size, opened.size, 'tracked source changed during read');
    assert.equal(after.mtimeMs, opened.mtimeMs, 'tracked source changed during read');
    assert.equal(bytes.length, opened.size, 'tracked source size changed during read');
    const digest = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(digest, objectId, 'tracked source bytes differ from pinned Git object');
    return bytes.length;
  } finally { await handle.close(); }
}

/** Check the actual tracked bytes, not Git's cached working-tree assumptions.
 * Ignored build/dependency artifacts remain allowed; this is not a sandbox or
 * an attestation of node_modules, the local Git executable, or hostile writers.
 */
export async function verifyCheckout(path, revision) {
  assert.match(revision, /^[a-f0-9]{40}$/, 'full immutable SHA-1 commit required');
  const root = resolve(path);
  assert.equal(await realpath(root), root, 'linked dependency checkout path');
  const metadata = await lstat(join(root, '.git'));
  assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'standalone dependency checkout required');
  assert.equal((await git(root, ['rev-parse', '--show-toplevel'])).trim(), root, 'dependency root mismatch');
  assert.equal((await git(root, ['rev-parse', 'HEAD'])).trim(), revision, 'dependency checkout revision mismatch');
  assert.equal((await git(root, ['rev-parse', '--show-object-format'])).trim(), 'sha1', 'unsupported Git object format');
  const tree = await git(root, ['ls-tree', '-rz', '--full-tree', revision]);
  assert.ok(tree.endsWith('\0'), 'empty or incomplete dependency tree');
  const entries = tree.slice(0, -1).split('\0');
  assert.ok(entries.length <= 20000, 'dependency tree exceeds entry bound');
  let size = 0;
  for (const entry of entries) {
    const tab = entry.indexOf('\t');
    assert.ok(tab > 0, 'invalid Git tree entry');
    const [mode, type, objectId] = entry.slice(0, tab).split(' ');
    assert.ok(type === 'blob' && ['100644', '100755'].includes(mode),
      'linked or unsupported dependency tree entry');
    assert.match(objectId, /^[a-f0-9]{40}$/);
    size += await checkedFile(root, entry.slice(tab + 1), mode, objectId);
    assert.ok(size <= MAX_TREE_BYTES, 'dependency tree exceeds byte bound');
  }
  // Preserve both index and ordinary working-tree cleanliness checks. Neither is
  // a substitute for reading every tracked file against the pinned tree above.
  await git(root, ['diff', '--cached', '--quiet', '--no-ext-diff', '--no-textconv', revision, '--']);
  await git(root, ['diff', '--quiet', '--no-ext-diff', '--no-textconv', revision, '--']);
  assert.equal(await git(root, ['ls-files', '--others', '--exclude-standard', '-z']), '',
    'untracked dependency sources are not admitted');
  assert.equal((await git(root, ['rev-parse', 'HEAD'])).trim(), revision, 'dependency revision changed during verification');
}
