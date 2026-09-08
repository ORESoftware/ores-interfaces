import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { ROOT, auditBuiltPackage, buildSharedInterfaces } from '../scripts/build.mjs';
import { DECLARATIONS, readPolicy } from '../scripts/policy.mjs';

const exec = promisify(execFile);
const execute = (command, args, cwd = ROOT) => exec(command, args, { cwd, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
const expectedFiles = [
  'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'shared-interfaces.json',
  'generated/public/LICENSE.upstream', 'generated/public/main.tsp',
  'generated/public/provenance.json', 'generated/public/schema.json',
].sort();

test('actual TJSV admission, artifact rejection and external packed-source consumer', async (t) => {
  const policy = await readPolicy(ROOT);
  const work = await mkdtemp(join(tmpdir(), 'ores-hub-integration-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  await buildSharedInterfaces(); // Missing dependency/compiler is a failure, never skip.
  const output = join(ROOT, 'generated/public');
  await t.test('exports both admitted independent sources byte for byte', async () => {
    assert.equal((await auditBuiltPackage()).bindingsVerified, true);
    assert.equal(await readFile(join(output, 'main.tsp'), 'utf8'),
      await readFile(join(ROOT, '.deps/compat/validation/typespec/validation.tsp'), 'utf8'));
    assert.equal(await readFile(join(output, 'schema.json'), 'utf8'),
      await readFile(join(ROOT, '.deps/compat/validation/public-contracts.v1.json'), 'utf8'));
    const provenance = JSON.parse(await readFile(join(output, 'provenance.json'), 'utf8'));
    assert.deepEqual(provenance.admission.declarations, DECLARATIONS);
    assert.equal(provenance.admission.recordedCases, 31);
    assert.equal(provenance.admission.status, 'passed');
    assert.deepEqual(provenance.policy, policy);
  });
  await t.test('npm prepack invokes real admission and ships only public interface files', async () => {
    await execute('npm', ['pack', '--pack-destination', work]);
    const archives = (await readdir(work)).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    const archive = join(work, archives[0]);
    const listing = (await execute('tar', ['-tzf', archive])).stdout.trim().split('\n');
    assert.deepEqual(listing.sort(), expectedFiles.map((path) => `package/${path}`).sort());
    const consumer = join(work, 'consumer');
    const installed = join(consumer, 'node_modules/@oresoftware/ores-interfaces');
    await mkdir(installed, { recursive: true });
    await execute('tar', ['-xzf', archive, '--strip-components=1', '-C', installed]);
    // Exercise real package exports from a different cwd with no repo-local imports.
    await execute(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import schema from '@oresoftware/ores-interfaces/schema' with { type: 'json' };
      import provenance from '@oresoftware/ores-interfaces/provenance' with { type: 'json' };
      assert.equal(schema.$defs.PageQuery.required.includes('limit'), true);
      assert.equal(Object.hasOwn(schema.$defs, 'TrustedActor'), false);
      assert.equal(provenance.editableAuthority, false);
      assert.ok(import.meta.resolve('@oresoftware/ores-interfaces/typespec').endsWith('/main.tsp'));
    `], consumer);
    // Exercise tspMain through an ordinary package import with pinned peer libraries.
    await mkdir(join(consumer, 'node_modules/@typespec'), { recursive: true });
    for (const name of ['compiler', 'json-schema'])
      await symlink(join(ROOT, '.deps/tjsv/node_modules/@typespec', name), join(consumer, 'node_modules/@typespec', name), 'dir');
    const entry = join(consumer, 'main.tsp');
    const tsp = join(ROOT, '.deps/tjsv/node_modules/.bin/tsp');
    await writeFile(entry, 'import "@oresoftware/ores-interfaces";\nmodel ConsumerRequest { meta: Ores.Validation.RequestMeta; page: Ores.Validation.PageQuery; }\n');
    await execute(tsp, ['compile', entry, '--no-emit', '--warn-as-error'], consumer);
    await writeFile(entry, 'import "@oresoftware/ores-interfaces";\nmodel Forbidden { actor: Ores.Validation.TrustedActor; }\n');
    await assert.rejects(execute(tsp, ['compile', entry, '--no-emit', '--warn-as-error'], consumer));
    // Recompile the actual packed source bytes against each other and the pinned
    // recorded corpus, not merely a successful JSON.parse or package listing.
    const sourceRoot = join(work, 'packed-contract');
    await mkdir(join(sourceRoot, 'validation/typespec'), { recursive: true });
    await mkdir(join(sourceRoot, 'validation/tjsv'), { recursive: true });
    await cp(join(installed, 'generated/public/main.tsp'), join(sourceRoot, 'validation/typespec/validation.tsp'));
    await cp(join(installed, 'generated/public/schema.json'), join(sourceRoot, 'validation/public-contracts.v1.json'));
    await cp(join(ROOT, '.deps/compat/validation/tjsv/public-corpus.json'), join(sourceRoot, 'validation/tjsv/public-corpus.json'));
    const { withPublicAdmission } = await import(pathToFileURL(join(ROOT, '.deps/compat/validation/tjsv/admission.mjs')).href);
    const admitted = await withPublicAdmission({ sourceRoot, validatorRoot: join(ROOT, '.deps/tjsv') });
    assert.equal(admitted.status, 'passed');
    assert.equal(admitted.recordedCases, 31);
  });
  await t.test('edited generated schema fails binding inspection', async () => {
    const path = join(output, 'schema.json');
    await chmod(path, 0o644);
    await writeFile(path, '{}\n');
    await assert.rejects(auditBuiltPackage(), /changed export/);
    await buildSharedInterfaces();
  });
  await t.test('failed dependency pin prevents packing and invalidates old owned output', async () => {
    const path = join(ROOT, 'shared-interfaces.json'), original = await readFile(path, 'utf8');
    const changed = JSON.parse(original); changed.source.commit = '0'.repeat(40);
    const destination = join(work, 'rejected-pack');
    await mkdir(destination);
    try {
      await writeFile(path, JSON.stringify(changed));
      await assert.rejects(execute('npm', ['pack', '--pack-destination', destination]));
      assert.deepEqual(await readdir(destination), []);
      await assert.rejects(lstat(output), { code: 'ENOENT' });
    } finally { await writeFile(path, original); }
  });
  await t.test('missing dependency checkouts cannot become an empty passing package', async () => {
    const root = join(work, 'missing-checkouts');
    await mkdir(root);
    await cp(join(ROOT, 'shared-interfaces.json'), join(root, 'shared-interfaces.json'));
    await assert.rejects(buildSharedInterfaces(root));
    await assert.rejects(lstat(join(root, 'generated/public')), { code: 'ENOENT' });
  });
  await t.test('unsupported task flags fail rather than introducing a parallel parser', async () => {
    await assert.rejects(execute(process.execPath, ['scripts/build.mjs', '--skip-parity']),
      (error) => error.code === 2 && error.stderr.includes('accepts no command-line options'));
  });
  await buildSharedInterfaces();
  assert.equal((await auditBuiltPackage()).bindingsVerified, true);
});
