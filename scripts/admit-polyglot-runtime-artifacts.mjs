import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const MANIFEST_SCHEMA = 'ores.typespec-json-schema-validator.language-boundaries/v1';
const EVIDENCE_SCHEMA = 'ores.typespec-json-schema-validator.language-boundary-evidence/v1';
const REPO_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const MAX_RECEIPT_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024;

export function assertCanonicalFile(base, path, label, limit = MAX_RECEIPT_BYTES) {
  if (typeof path !== 'string' || path.length === 0 || path.length > 2048
      || path !== path.trim() || CONTROL.test(path) || isAbsolute(path)
      || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(label + ' must be a canonical repository-relative file');
  }
  const root = realpathSync(base);
  const destination = resolve(root, path);
  const rel = relative(root, destination);
  if (!rel || rel === '..' || rel.startsWith('..' + sep)) throw new Error(label + ' escapes admitted root');
  let cursor = root;
  for (const segment of path.split('/')) {
    cursor = join(cursor, segment);
    let info;
    try { info = lstatSync(cursor); } catch { throw new Error(label + ' is missing or inaccessible'); }
    if (info.isSymbolicLink()) throw new Error(label + ' crosses symbolic link');
  }
  const info = lstatSync(destination);
  if (!info.isFile() || info.size <= 0 || info.size > limit) {
    throw new Error(label + ' must be a non-empty regular file below the byte limit');
  }
  return destination;
}

function strictManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
      || manifest.schema !== MANIFEST_SCHEMA || !Array.isArray(manifest.targets)
      || manifest.targets.length < 2 || !Number.isSafeInteger(manifest.minimumDistinctLanguages)
      || manifest.minimumDistinctLanguages < 2
      || manifest.authorities?.typeSpec !== 'peer'
      || manifest.authorities?.jsonSchema !== 'peer'
      || manifest.authorities?.generatedWitness !== 'evidence_only') {
    throw new Error('strict runtime manifest requires peer authorities and at least two language targets');
  }
  const langs = new Set();
  for (const t of manifest.targets) {
    if (t?.required !== true || t.ingress !== true || t.egress !== true
        || typeof t.language !== 'string' || !t.language.trim() || typeof t.runtime !== 'string' || !t.runtime.trim()) {
      throw new Error('all runtime targets must require bidirectional conformance');
    }
    langs.add(t.language);
  }
  if (langs.size < manifest.minimumDistinctLanguages) throw new Error('runtime manifest omits required languages');
}

export function admitRuntimeArtifactBundle({ manifest, artifactRoot, expectedSha }) {
  strictManifest(manifest);
  if (!REPO_SHA.test(expectedSha ?? '')) throw new Error('expected head SHA must be immutable');
  const evidenceByPath = Object.create(null);
  const digests = new Set();
  const identities = new Set();
  for (const target of manifest.targets) {
    const identity = JSON.stringify([target.language, target.runtime]);
    if (identities.has(identity)) throw new Error('duplicate language/runtime identity');
    identities.add(identity);
    const evidenceFile = assertCanonicalFile(artifactRoot, target.evidence, 'runtime evidence');
    const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8'));
    if (evidence?.schema !== EVIDENCE_SCHEMA || evidence.status !== 'passed'
        || evidence.language !== target.language || evidence.runtime !== target.runtime
        || evidence.validation?.ingress !== 'passed' || evidence.validation?.egress !== 'passed') {
      throw new Error('runtime evidence is not a matching bidirectionally passed native test receipt');
    }
    if (evidence.sourceRevision !== expectedSha) throw new Error('runtime evidence belongs to another source revision');
    if (Object.hasOwn(evidenceByPath, target.evidence)) throw new Error('duplicate native evidence path');
    const artifactFile = assertCanonicalFile(artifactRoot, target.evidence + '.artifact', 'tested native artifact', MAX_ARTIFACT_BYTES);
    const digest = 'sha256:' + createHash('sha256').update(readFileSync(artifactFile)).digest('hex');
    if (!SHA256.test(evidence.artifactDigest ?? '') || digest !== evidence.artifactDigest) {
      throw new Error('native artifact bytes do not match claimed digest');
    }
    if (digests.has(digest)) throw new Error('same native artifact cannot attest to distinct runtime implementations');
    digests.add(digest);
    evidenceByPath[target.evidence] = evidence;
  }
  return evidenceByPath;
}
