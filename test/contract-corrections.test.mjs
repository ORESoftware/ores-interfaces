// docs/contract-stack.md permits correcting an admitted contract family in
// place only while nothing outside this repository can depend on it. That was
// prose. This makes the checkable half of it a gate: a family that declares an
// in-place correction must be absent from everything this package releases.
// The day the family is added to the release surface this test fails, and the
// next change to it has to be a new version.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));

async function families() {
  const found = [];
  for (const family of await readdir('contracts')) {
    for (const version of await readdir(join('contracts', family))) {
      const path = join('contracts', family, version, 'corrections.json');
      try {
        found.push({ dir: join('contracts', family, version), doc: JSON.parse(await readFile(path, 'utf8')) });
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
    }
  }
  return found;
}

test('an in-place correction is only declared for an unreleased family', async () => {
  const declared = await families();
  assert.ok(declared.length > 0, 'the premise: at least one family declares a correction');
  const released = await Promise.all(pkg.files.map((file) => readFile(file, 'utf8').catch(() => '')));
  for (const { dir, doc } of declared) {
    assert.equal(doc.family, dir.replace(/^contracts\//, ''), `${dir}: family does not match its path`);
    // 1. Nothing can install this package from a registry.
    assert.equal(pkg.private, true, `${dir}: corrected in place, but the package is publishable`);
    // 2. Nothing the package ships contains the family.
    assert.ok(
      !pkg.files.some((file) => file.startsWith('contracts/')),
      `${dir}: corrected in place, but contracts/ is part of the released file set`,
    );
    for (const correction of doc.corrections) {
      for (const declaration of correction.declarations) {
        const carriers = pkg.files.filter((_, index) => new RegExp(`\\b${declaration}\\b`).test(released[index]));
        assert.deepEqual(
          carriers,
          [],
          `${dir}: ${declaration} was corrected in place but is part of the released surface`,
        );
      }
      // What cannot be checked has to be said, not implied.
      assert.ok(correction.not_machine_checkable?.length > 40, `${dir}: state what this gate cannot prove`);
    }
  }
});

test('every declared correction is explained in the family README', async () => {
  for (const { dir, doc } of await families()) {
    const readme = await readFile(join(dir, 'README.md'), 'utf8');
    assert.match(readme, /## Corrections to this version/, `${dir}: README records no corrections`);
    for (const correction of doc.corrections) {
      assert.ok(correction.id && correction.summary, `${dir}: a correction needs an id and a summary`);
    }
  }
});
