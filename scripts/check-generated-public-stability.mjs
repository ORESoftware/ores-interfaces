import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FILES = [
  'generated/public/interface-release.json',
  'generated/public/provenance.json',
];

function readHead(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' });
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortObject(child)]),
    );
  }
  return value;
}

function stableProjection(path, text) {
  const value = JSON.parse(text);

  if (path.endsWith('interface-release.json')) {
    delete value.admissionRunId;
    delete value.releaseId;
    if (value.artifacts?.['provenance.json']) {
      delete value.artifacts['provenance.json'].sha256;
    }
  } else if (path.endsWith('provenance.json')) {
    if (value.admission) {
      delete value.admission.irId;
      delete value.admission.runId;
    }
    delete value.packageId;
  } else {
    throw new Error(`unhandled generated receipt: ${path}`);
  }

  return JSON.stringify(sortObject(value), null, 2);
}

let failed = false;
for (const path of FILES) {
  const committed = stableProjection(path, readHead(path));
  const generated = stableProjection(path, readFileSync(path, 'utf8'));
  if (committed === generated) continue;

  failed = true;
  console.error(`stable generated-public fields changed in ${path}`);
  console.error('--- committed stable projection');
  console.error(committed);
  console.error('--- generated stable projection');
  console.error(generated);
}

if (failed) process.exit(1);
console.log('generated/public stable fields unchanged; run-scoped receipt ids ignored');
