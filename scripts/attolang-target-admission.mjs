// AttoLang target-only interface projection from independently admitted
// TypeSpec and authored JSON Schema peers. This never certifies guest code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEX40 = /^[a-f0-9]{40}$/;
const HEX64 = /^[a-f0-9]{64}$/;
function requireCondition(condition, message) {
  if (!condition) throw new Error(`AttoLang target admission: ${message}`);
}
function requireDeclarations(declarations) {
  requireCondition(Array.isArray(declarations) && declarations.length > 0,
    'declarations must be a nonempty array');
  requireCondition(declarations.every((name) => typeof name === 'string'
    && name.trim() === name && name.length > 0), 'invalid declaration name');
  requireCondition(new Set(declarations).size === declarations.length, 'duplicate declarations');
}
export function makeAttoLangInterfaceTarget(provenance) {
  requireCondition(provenance && typeof provenance === 'object',
    'missing generated public provenance');
  const { policy, admission } = provenance;
  requireCondition(provenance.schema === 'ores.shared-interfaces-package/v1'
    && provenance.role === 'derived-public-source-package'
    && provenance.editableAuthority === false,
  'generated witness must remain nonauthoritative');
  requireCondition(policy?.authorityModel === 'independent-typespec-and-json-schema-peers'
    && policy.authorityTransfer === false,
  'TypeSpec and authored JSON Schema must remain independent peer authorities');
  requireCondition(HEX40.test(policy?.source?.commit ?? '')
    && HEX40.test(policy?.validator?.commit ?? ''),
  'source and validation tool revisions must be immutable');
  requireCondition(admission?.schema === 'ores.shared-public-admission/v1'
    && admission.status === 'passed'
    && admission.validatorRevision === policy.validator.commit
    && HEX64.test(admission?.irId ?? '')
    && HEX64.test(admission?.runId ?? ''),
  'parity admission/validator revision must agree');
  const digests = admission.sourceDigests;
  requireCondition(HEX64.test(digests?.typespec ?? '')
    && HEX64.test(digests?.authoredSchema ?? '')
    && HEX64.test(digests?.corpus ?? '')
    && HEX64.test(digests?.sourceLock ?? ''),
  'both contract authorities and the conformance corpus must be digest-bound');
  requireCondition(admission.recordedCases > 0 && Number.isSafeInteger(admission.recordedCases),
    'no executed contract cases recorded');
  requireDeclarations(policy.expectedDeclarations);
  requireDeclarations(admission.declarations);
  requireCondition(JSON.stringify([...policy.expectedDeclarations].sort())
    === JSON.stringify([...admission.declarations].sort()),
  'admitted declarations do not match expected declarations');
  return Object.freeze({
    schema: 'ores.interfaces.attolang-target/v1',
    language: 'attolang',
    sourceExtension: '.atto',
    legacyExtension: '.ores',
    status: 'TARGET_ONLY',
    backendExecution: 'NOT_EXECUTED',
    authorityModel: 'independent-typespec-and-json-schema-peers',
    sourceRevision: policy.source.commit,
    validatorRevision: admission.validatorRevision,
    contractIrId: admission.irId,
    parityRunId: admission.runId,
    authorities: {
      typespecSha256: digests.typespec,
      authoredJsonSchemaSha256: digests.authoredSchema,
      corpusSha256: digests.corpus,
      sourceLockSha256: digests.sourceLock,
    },
    declarationIds: [...admission.declarations].sort(),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const provenance = JSON.parse(readFileSync(
    new URL('../generated/public/provenance.json', import.meta.url), 'utf8'));
  process.stdout.write(JSON.stringify(makeAttoLangInterfaceTarget(provenance), null, 2) + '\n');
}
