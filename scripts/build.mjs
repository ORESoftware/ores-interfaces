import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { DECLARATIONS, PUBLIC_FILES, json, readPolicy, sha256 } from './policy.mjs';
import { withOwnedOutput } from './output.mjs';

const exec = promisify(execFile);
export const ROOT = resolve(import.meta.dirname, '..');
export async function verifyCheckout(path, revision) {
  assert.equal((await exec('git', ['-C', path, 'rev-parse', 'HEAD'])).stdout.trim(), revision, 'dependency checkout revision mismatch');
  await exec('git', ['-C', path, 'diff', '--exit-code', 'HEAD']);
  assert.equal((await exec('git', ['-C', path, 'ls-files', '--others', '--exclude-standard'])).stdout.trim(), '', 'untracked dependency sources are not admitted');
}

export async function buildSharedInterfaces(root = ROOT) {
  // Invalidate a previous owned package before reading configuration/dependencies.
  return withOwnedOutput(root, async () => {
    const policy = await readPolicy(root);
    const sourceRoot = join(root, '.deps/compat');
    const validatorRoot = join(root, '.deps/tjsv');
    await verifyCheckout(sourceRoot, policy.source.commit);
    await verifyCheckout(validatorRoot, policy.validator.commit);
    const { withPublicAdmission, VALIDATOR_REVISION } = await import(pathToFileURL(join(sourceRoot, 'validation/tjsv/admission.mjs')).href);
    assert.equal(VALIDATOR_REVISION, policy.validator.commit, 'source gate and consumer toolchain must agree');
    return withPublicAdmission({ sourceRoot, validatorRoot }, async (evidence) => {
      assert.deepEqual(evidence.summary.declarations, DECLARATIONS);
      const files = {
        'LICENSE.upstream': await readFile(join(sourceRoot, 'LICENSE'), 'utf8'),
        'main.tsp': evidence.sources.typespec,
        'schema.json': evidence.sources.authoredSchema,
      };
      // These bytes come from both unchanged authored lanes, never from Schema B.
      const body = { schema: 'ores.shared-interfaces-package/v1', role: 'derived-public-source-package',
        editableAuthority: false, policy, admission: evidence.summary,
        files: Object.fromEntries(Object.entries(files).sort().map(([name, text]) => [name, sha256(text)])) };
      files['provenance.json'] = json({ ...body, packageId: sha256(json(body)) });
      await verifyCheckout(sourceRoot, policy.source.commit);
      await verifyCheckout(validatorRoot, policy.validator.commit);
      return files;
    });
  });
}

// Binding-only inspection, deliberately not another TJSV admission decision.
export async function auditBuiltPackage(root = ROOT) {
  const output = join(root, 'generated/public');
  const entries = await readdir(output, { withFileTypes: true });
  assert.ok(entries.every((entry) => entry.isFile()), 'linked or nested public output');
  assert.deepEqual(entries.map((entry) => entry.name).sort(), ['.owner', ...PUBLIC_FILES].sort());
  const { packageId, ...body } = JSON.parse(await readFile(join(output, 'provenance.json'), 'utf8'));
  assert.equal(packageId, sha256(json(body)), 'package provenance body changed');
  assert.deepEqual(body.policy, await readPolicy(root), 'package policy is stale');
  assert.equal(body.editableAuthority, false);
  assert.equal(body.role, 'derived-public-source-package');
  assert.deepEqual(Object.keys(body.files).sort(), ['LICENSE.upstream', 'main.tsp', 'schema.json']);
  for (const [name, digest] of Object.entries(body.files))
    assert.equal(sha256(await readFile(join(output, name))), digest, `changed export: ${name}`);
  return Object.freeze({ bindingsVerified: true, packageId });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'this repository task accepts no command-line options');
    await buildSharedInterfaces();
    console.log(JSON.stringify(await auditBuiltPackage()));
  } catch (error) { console.error(`Shared interface build stopped: ${error.message}`); process.exitCode = 2; }
}
