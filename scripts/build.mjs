import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DECLARATIONS, PUBLIC_FILES, json, readPolicyAndTjsvLock, sha256 } from './policy.mjs';
import { withOwnedOutput } from './output.mjs';
import { verifyCheckout } from './checkout.mjs';
export { verifyCheckout } from './checkout.mjs';

export const ROOT = resolve(import.meta.dirname, '..');

function publicTjsvBinding(tjsvLock) {
  return Object.freeze({
    schema: tjsvLock.schema,
    repository: tjsvLock.repository,
    revision: tjsvLock.revision,
    assuranceProfile: tjsvLock.assuranceProfile,
    lockDigest: tjsvLock.selfDigest,
  });
}

export async function buildSharedInterfaces(root = ROOT) {
  // Invalidate a previous owned package before reading configuration/dependencies.
  return withOwnedOutput(root, async () => {
    const { policy, tjsvLock } = await readPolicyAndTjsvLock(root);
    const sourceRoot = join(root, '.deps/compat');
    const validatorRoot = join(root, '.deps/tjsv');
    await verifyCheckout(sourceRoot, policy.source.commit);
    await verifyCheckout(validatorRoot, tjsvLock.revision);
    const sourceModule = pathToFileURL(join(sourceRoot, 'validation/tjsv/admission.mjs'));
    sourceModule.searchParams.set('commit', policy.source.commit);
    const { withPublicAdmission, VALIDATOR_REVISION } = await import(sourceModule.href);
    assert.equal(VALIDATOR_REVISION, tjsvLock.revision,
      'source-owned TJSV lock and consumer execution identity must agree');
    return withPublicAdmission({ sourceRoot, validatorRoot }, async (evidence) => {
      assert.deepEqual(evidence.summary.declarations, DECLARATIONS);
      assert.equal(evidence.summary.validatorRepository, tjsvLock.repository);
      assert.equal(evidence.summary.validatorRevision, tjsvLock.revision);
      assert.equal(evidence.summary.schema, tjsvLock.evidenceSchemas[0]);
      const files = {
        'LICENSE.upstream': await readFile(join(sourceRoot, 'LICENSE'), 'utf8'),
        'main.tsp': evidence.sources.typespec,
        'schema.json': evidence.sources.authoredSchema,
      };
      // These bytes come from both unchanged authored lanes, never from Schema B.
      const body = { schema: 'ores.shared-interfaces-package/v1', role: 'derived-public-source-package',
        editableAuthority: false, policy, tjsvLock: publicTjsvBinding(tjsvLock), admission: evidence.summary,
        files: Object.fromEntries(Object.entries(files).sort().map(([name, text]) => [name, sha256(text)])) };
      files['provenance.json'] = json({ ...body, packageId: sha256(json(body)) });
      await verifyCheckout(sourceRoot, policy.source.commit);
      await verifyCheckout(validatorRoot, tjsvLock.revision);
      const after = await readPolicyAndTjsvLock(root);
      assert.deepEqual(after.policy, policy, 'shared source policy changed during build');
      assert.deepEqual(after.tjsvLock, tjsvLock, 'TJSV consumer lock changed during build');
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
  const current = await readPolicyAndTjsvLock(root);
  assert.deepEqual(body.policy, current.policy, 'package policy is stale');
  assert.deepEqual(body.tjsvLock, publicTjsvBinding(current.tjsvLock), 'package TJSV binding is stale');
  assert.equal(body.editableAuthority, false);
  assert.equal(body.role, 'derived-public-source-package');
  assert.deepEqual(Object.keys(body.files).sort(), ['LICENSE.upstream', 'main.tsp', 'schema.json']);
  for (const [name, digest] of Object.entries(body.files))
    assert.equal(sha256(await readFile(join(output, name))), digest, `changed export: ${name}`);
  return Object.freeze({ bindingsVerified: true, packageId, validatorRevision: body.tjsvLock.revision });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'this repository task accepts no command-line options');
    await buildSharedInterfaces();
    console.log(JSON.stringify(await auditBuiltPackage()));
  } catch (error) { console.error(`Shared interface build stopped: ${error.message}`); process.exitCode = 2; }
}
