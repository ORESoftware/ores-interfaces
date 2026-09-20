// `npm test` names its files one by one, so a test file that is not on the list
// is never run and nothing says so. rpc-error-log-repairs.test.mjs was written,
// passed when run by hand, and was skipped by `npm test` until this existed.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

test('every test file in test/ is run by some npm test script', async () => {
  // `npm run check` runs both `test` and `test:integration`, so a file listed in
  // either is run.
  const scripts = JSON.parse(await readFile('package.json', 'utf8')).scripts;
  const script = Object.entries(scripts)
    .filter(([name]) => name === 'test' || name.startsWith('test:'))
    .map(([, command]) => command)
    .join(' ');
  const listed = new Set(script.split(/\s+/).filter((word) => word.endsWith('.test.mjs')));
  const present = (await readdir('test'))
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => `test/${name}`);
  assert.deepEqual(present.filter((file) => !listed.has(file)), [], 'test files no npm test script runs');
  assert.deepEqual([...listed].filter((file) => !present.includes(file)), [], 'a test script names files that do not exist');
});
