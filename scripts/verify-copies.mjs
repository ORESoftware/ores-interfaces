import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

const sha = (kind, bytes) => createHash(kind).update(bytes).digest('hex');
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error(`invalid ${label} fields`);
  }
}
function relativePath(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f\x7f:]/.test(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('unsafe relative path');
  }
  return value;
}
function regularFile(root, relative) {
  let current = realpathSync(root);
  const parts = relativePath(relative).split('/');
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('symlink in copy path');
    if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) {
      throw new Error('copy path has wrong file type');
    }
    if (index === parts.length - 1 && stat.size > 1048576) throw new Error('copy exceeds size bound');
  }
  return readFileSync(current);
}
function listFiles(root, relative) {
  const stat = lstatSync(join(root, relative));
  if (stat.isSymbolicLink()) throw new Error('symlink in copy inventory');
  if (stat.isFile()) return [relative];
  if (!stat.isDirectory()) throw new Error('unsupported copy file type');
  return readdirSync(join(root, relative)).sort().flatMap(name => listFiles(root, `${relative}/${name}`));
}

/** Verify byte-preserved sources, not semantic parity or current upstream HEAD. */
export function verifyCopies(root, manifest, upstreamRoot) {
  exactKeys(manifest, ['schema', 'policy', 'repository', 'commit', 'files'], 'manifest');
  if (manifest.schema !== 'ores.shared-interface-copies/v1' ||
      manifest.policy !== 'duplicate-not-extract' ||
      manifest.repository !== 'ores-otel/ores-interfaces' ||
      !/^[a-f0-9]{40}$/.test(manifest.commit)) throw new Error('invalid source identity');
  if (!Array.isArray(manifest.files) || manifest.files.length !== 2) throw new Error('incomplete copy set');
  const seen = new Set();
  const sources = new Set();
  const digests = manifest.files.map(file => {
    exactKeys(file, ['path', 'sourcePath', 'gitBlob', 'sha256'], 'copy');
    relativePath(file.path);
    relativePath(file.sourcePath);
    if (!file.path.startsWith('contracts/shared-public/') || seen.has(file.path) || sources.has(file.sourcePath)) {
      throw new Error('duplicate or out-of-scope copy');
    }
    seen.add(file.path);
    sources.add(file.sourcePath);
    if (!/^[a-f0-9]{40}$/.test(file.gitBlob) || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('invalid digest');
    }
    const bytes = regularFile(root, file.path);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (blob !== file.gitBlob || sha('sha256', bytes) !== file.sha256) throw new Error('copy content drift');
    if (upstreamRoot !== undefined && !bytes.equals(regularFile(upstreamRoot, file.sourcePath))) {
      throw new Error('pinned upstream differs from copy');
    }
    return { path: file.path, sha256: file.sha256 };
  });
  const inventory = listFiles(root, 'contracts/shared-public').sort();
  if (inventory.join('\0') !== [...seen].sort().join('\0')) throw new Error('untracked copy content');
  return digests.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
