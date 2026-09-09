import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { verifyCheckout } from '../scripts/checkout.mjs';

const exec = promisify(execFile);
const git = async (root, ...args) => (await exec('git', ['-C', root, ...args], { timeout: 10000 })).stdout;
const original = 'export const admission = "pinned";\n';
async function fixture(t) {
  const work = await realpath(await mkdtemp(join(tmpdir(), 'ores-checkout-test-')));
  t.after(() => rm(work, { recursive: true, force: true }));
  const root = join(work, 'dependency');
  await mkdir(join(root, 'src'), { recursive: true });
  await git(root, 'init', '-q');
  await git(root, 'config', 'user.name', 'Contract Test');
  await git(root, 'config', 'user.email', 'contract-test@example.invalid');
  await writeFile(join(root, '.gitignore'), 'node_modules/\n');
  await writeFile(join(root, 'src/admission.mjs'), original);
  await git(root, 'add', '--', '.gitignore', 'src/admission.mjs');
  await git(root, 'commit', '-qm', 'synthetic pinned fixture');
  return { work, root, pin: (await git(root, 'rev-parse', 'HEAD')).trim() };
}

test('pristine pinned checkout passes without changing the index or files', async t => {
  const { root, pin } = await fixture(t);
  const index = await readFile(join(root, '.git/index'));
  await verifyCheckout(root, pin);
  assert.deepEqual(await readFile(join(root, '.git/index')), index);
  assert.equal(await readFile(join(root, 'src/admission.mjs'), 'utf8'), original);
});
for (const bit of ['--assume-unchanged', '--skip-worktree']) {
  test(`detects hidden tracked changes with ${bit} despite a clean Git diff`, async t => {
    const { root, pin } = await fixture(t);
    await git(root, 'update-index', bit, '--', 'src/admission.mjs');
    await writeFile(join(root, 'src/admission.mjs'), 'export const admission = "forged";\n');
    await git(root, 'diff', '--quiet', 'HEAD'); // Demonstrate the old check's bypass.
    const index = await readFile(join(root, '.git/index'));
    await assert.rejects(verifyCheckout(root, pin), /bytes differ/);
    assert.deepEqual(await readFile(join(root, '.git/index')), index);
  });
}
test('checks the index even when working bytes equal HEAD', async t => {
  const { root, pin } = await fixture(t);
  await writeFile(join(root, 'src/admission.mjs'), 'staged change\n');
  await git(root, 'add', '--', 'src/admission.mjs');
  await writeFile(join(root, 'src/admission.mjs'), original);
  await git(root, 'diff', '--quiet', 'HEAD');
  await assert.rejects(verifyCheckout(root, pin));
});
test('rejects ordinary modification and missing skipped files', async t => {
  const { root, pin } = await fixture(t);
  await writeFile(join(root, 'src/admission.mjs'), 'modified\n');
  await assert.rejects(verifyCheckout(root, pin), /bytes differ/);
  await writeFile(join(root, 'src/admission.mjs'), original);
  await git(root, 'update-index', '--skip-worktree', '--', 'src/admission.mjs');
  await rm(join(root, 'src/admission.mjs'));
  await assert.rejects(verifyCheckout(root, pin), { code: 'ENOENT' });
});
test('rejects mutable and incorrect pins', async t => {
  const { root } = await fixture(t);
  await assert.rejects(verifyCheckout(root, 'main'), /immutable/);
  await assert.rejects(verifyCheckout(root, '0'.repeat(40)), /revision mismatch/);
});
test('rejects untracked sources but permits ignored dependency artifacts', async t => {
  const { root, pin } = await fixture(t);
  await mkdir(join(root, 'node_modules'), { recursive: true });
  await writeFile(join(root, 'node_modules/cache'), 'build artifact\n');
  await verifyCheckout(root, pin);
  await writeFile(join(root, 'src/untracked.mjs'), 'export {};\n');
  await assert.rejects(verifyCheckout(root, pin), /untracked/);
});
test('a nested directory cannot impersonate a standalone checkout', async t => {
  const { root, pin } = await fixture(t);
  await assert.rejects(verifyCheckout(join(root, 'src'), pin));
});
test('rejects tracked-file symlinks even with identical target bytes', async t => {
  const { root, work, pin } = await fixture(t);
  const external = join(work, 'external.mjs');
  await writeFile(external, original);
  await rm(join(root, 'src/admission.mjs'));
  await symlink(external, join(root, 'src/admission.mjs'));
  await assert.rejects(verifyCheckout(root, pin), /regular file/);
});
test('rejects symlinked parents and checkout roots', async t => {
  const { root, work, pin } = await fixture(t);
  await symlink(root, join(work, 'alias'));
  await assert.rejects(verifyCheckout(join(work, 'alias'), pin), /linked/);
  await mkdir(join(work, 'external'));
  await writeFile(join(work, 'external/admission.mjs'), original);
  await rm(join(root, 'src'), { recursive: true });
  await symlink(join(work, 'external'), join(root, 'src'));
  await assert.rejects(verifyCheckout(root, pin), /source parent/);
});
test('rejects executable mode drift hidden by core.filemode=false', async t => {
  const { root, pin } = await fixture(t);
  await git(root, 'config', 'core.filemode', 'false');
  await chmod(join(root, 'src/admission.mjs'), 0o755);
  await git(root, 'diff', '--quiet', 'HEAD');
  if (process.platform !== 'win32') await assert.rejects(verifyCheckout(root, pin), /mode drift/);
  else await verifyCheckout(root, pin);
});
test('raw bytes cannot be hidden behind a clean filter', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, '.gitattributes'), '*.mjs text eol=lf\n');
  await git(root, 'add', '--', '.gitattributes');
  await git(root, 'commit', '-qm', 'test raw byte policy');
  const pin = (await git(root, 'rev-parse', 'HEAD')).trim();
  await writeFile(join(root, 'src/admission.mjs'), original.replaceAll('\n', '\r\n'));
  await git(root, 'diff', '--quiet', 'HEAD');
  await assert.rejects(verifyCheckout(root, pin), /bytes differ/);
});
test('rejects links already recorded in the committed tree', async t => {
  const { root } = await fixture(t);
  await symlink('admission.mjs', join(root, 'src/linked.mjs'));
  await git(root, 'add', '--', 'src/linked.mjs');
  await git(root, 'commit', '-qm', 'synthetic unsupported tree');
  const pin = (await git(root, 'rev-parse', 'HEAD')).trim();
  await assert.rejects(verifyCheckout(root, pin), /unsupported dependency tree/);
});
test('Git replacement objects cannot substitute another tree for the pin', async t => {
  const { root, pin } = await fixture(t);
  await writeFile(join(root, 'src/admission.mjs'), 'replacement bytes\n');
  await git(root, 'add', '--', 'src/admission.mjs');
  await git(root, 'commit', '-qm', 'replacement fixture');
  const replacement = (await git(root, 'rev-parse', 'HEAD')).trim();
  await git(root, 'replace', pin, replacement);
  // Detached checkout stays inside this synthetic test repo; no shared history changes.
  await git(root, 'switch', '--detach', pin);
  assert.equal(await readFile(join(root, 'src/admission.mjs'), 'utf8'), 'replacement bytes\n');
  await git(root, 'diff', '--quiet', 'HEAD');
  await assert.rejects(verifyCheckout(root, pin), /bytes differ/);
});
test('ambient Git selectors cannot redirect the verified checkout', async t => {
  const first = await fixture(t);
  const second = await fixture(t);
  await writeFile(join(first.root, 'src/admission.mjs'), 'not the pinned bytes\n');
  const module = new URL('../scripts/checkout.mjs', import.meta.url).href;
  const code = `import { verifyCheckout } from ${JSON.stringify(module)};
    import assert from 'node:assert/strict';
    await assert.rejects(verifyCheckout(${JSON.stringify(first.root)}, ${JSON.stringify(first.pin)}), /bytes differ/);`;
  await exec(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, GIT_DIR: join(second.root, '.git'), GIT_WORK_TREE: second.root,
      GIT_INDEX_FILE: join(second.root, '.git/index') }, timeout: 10000,
  });
});
test('rejects redirected Git metadata without touching its target', async t => {
  const { root, work, pin } = await fixture(t);
  const other = join(work, 'other-metadata');
  await mkdir(other);
  await rm(join(root, '.git'), { recursive: true });
  await symlink(other, join(root, '.git'));
  await assert.rejects(verifyCheckout(root, pin), /standalone/);
  assert.ok((await lstat(other)).isDirectory());
});
