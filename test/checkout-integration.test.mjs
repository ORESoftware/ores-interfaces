import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { ROOT, auditBuiltPackage } from '../scripts/build.mjs';

const exec = promisify(execFile);
const run = (command, args, cwd = ROOT) => exec(command, args,
  { cwd, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
const build = () => run(process.execPath, ['scripts/build.mjs']);

test('hidden source/tool changes cannot execute or leave an admitted package', async t => {
  await build(); // Real TJSV compiler and verify-ir: absent dependencies are a failure.
  assert.equal((await auditBuiltPackage()).bindingsVerified, true);
  for (const [dependency, file, bit, clear] of [
    ['compat', 'validation/tjsv/admission.mjs', '--assume-unchanged', '--no-assume-unchanged'],
    ['compat', 'validation/public-contracts.v1.json', '--skip-worktree', '--no-skip-worktree'],
    ['tjsv', 'bin/typespec-json-schema-validator.mjs', '--assume-unchanged', '--no-assume-unchanged'],
  ]) {
    await t.test(`rejects concealed ${dependency}/${file} and recovers after restoration`, async () => {
      const checkout = join(ROOT, '.deps', dependency);
      const path = join(checkout, file);
      const original = await readFile(path);
      await run('git', ['update-index', bit, '--', file], checkout);
      try {
        const changed = file.endsWith('.json') ? '{}\n' : 'throw new Error("MUTATED_ENTRYPOINT_EXECUTED");\n';
        await writeFile(path, changed);
        await run('git', ['diff', '--quiet', 'HEAD'], checkout);
        await assert.rejects(build(), error => error.code === 2 &&
          error.stderr.includes('tracked source bytes differ') &&
          !error.stderr.includes('MUTATED_ENTRYPOINT_EXECUTED'));
        assert.equal(await readFile(path, 'utf8'), changed, 'gate must not repair or erase rejected source');
        await assert.rejects(lstat(join(ROOT, 'generated/public')), { code: 'ENOENT' });
      } finally {
        await writeFile(path, original);
        await run('git', ['update-index', clear, '--', file], checkout);
      }
      await build();
      assert.equal((await auditBuiltPackage()).bindingsVerified, true);
    });
  }
});
