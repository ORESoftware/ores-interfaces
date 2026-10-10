// Static upstream grammar gate only; native Oreslang compiler conformance is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../contracts/oreslang-route/v1/RouteContract.ores', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../contracts/oreslang-route/v1/README.md', import.meta.url), 'utf8');
const declarations = source.split(/\r?\n/).filter(line => !line.trimStart().startsWith('//')).join('\n').trim();

test('versioned Oreslang REST contract has the exact v1 method declarations', () => {
  assert.equal(declarations, [
    'define contract RouteContract as',
    '  fnc get(String request) => String;',
    '  fnc post(String request) => String;',
    'end',
  ].join('\n'));
});

test('module-conformance documentation uses current parser spelling', () => {
  assert.match(docs, /define module Route conforms RouteContract as/);
  assert.doesNotMatch(docs, /\bconforms\s+to\s+RouteContract\b/);
  assert.match(docs, /=> String;/);
});
