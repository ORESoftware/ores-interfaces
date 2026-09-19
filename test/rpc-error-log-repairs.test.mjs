// One rule per negative, for the RPC error-log event.
//
// TJSV proves the verdicts: invalid/<name> is rejected, and
// valid/repaired-<name> accepted, by BOTH authored peers. This proves the other
// half — that the two documents differ in exactly the field the manifest
// names. Without it a negative can be rejected for a reason other than the one
// in its filename and nobody finds out: when `rpc_layer` became required, nine
// negatives that did not carry it kept "passing" while proving nothing about
// the rules they were named after.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FAMILY = 'contracts/rpc-operation/v1';
const instancesDir = join(FAMILY, 'instances', 'RpcErrorLogEvent');

async function load(verdict) {
  const dir = join(instancesDir, verdict);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      instance: JSON.parse(await readFile(join(dir, name), 'utf8')),
    })),
  );
}

const schema = JSON.parse(await readFile(join(FAMILY, 'authored.schema.json'), 'utf8'));
const typespec = await readFile(join(FAMILY, 'main.tsp'), 'utf8');
const manifest = JSON.parse(await readFile(join(FAMILY, 'negative-repairs.json'), 'utf8'));

test('every negative is one field away from a document both authorities accept', async () => {
  const invalid = await load('invalid');
  const valid = new Map((await load('valid')).map(({ name, instance }) => [name, instance]));
  assert.deepEqual(
    Object.keys(manifest.repairs).sort(),
    invalid.map(({ name }) => name.replace(/\.json$/, '')).sort(),
    'every negative instance needs a declared repair, and every repair a negative',
  );
  for (const { name, instance } of invalid) {
    const twin = valid.get(`repaired-${name}`);
    assert.ok(twin, `${name} has no repaired twin in valid/`);
    const { field, repair } = manifest.repairs[name.replace(/\.json$/, '')];
    const keys = new Set([...Object.keys(instance), ...Object.keys(twin)]);
    const differing = [...keys].filter(
      (key) => JSON.stringify(instance[key]) !== JSON.stringify(twin[key]),
    );
    assert.deepEqual(differing, [field], `${name} must differ from its twin only in ${field}`);
    assert.equal(repair === 'removed', !(field in twin), `${name}: repair kind does not match`);
  }
});

test('a negative carries every required field its name is not about', async () => {
  const required = schema.$defs.RpcErrorLogEvent.required;
  for (const { name, instance } of await load('invalid')) {
    const { field } = manifest.repairs[name.replace(/\.json$/, '')];
    const absent = required.filter((key) => !(key in instance));
    assert.deepEqual(
      absent.filter((key) => key !== field),
      [],
      `${name} is missing required fields unrelated to the rule it names`,
    );
  }
});

test('rpc_layer is a named declaration in both peers', () => {
  assert.deepEqual(schema.$defs.RpcLayer.enum, ['handler', 'dispatch', 'transport', 'client']);
  assert.equal(schema.$defs.RpcErrorLogEvent.properties.rpc_layer.$ref, '#/$defs/RpcLayer');
  assert.match(typespec, /\benum RpcLayer\b/);
});

test('the all-zero W3C ids are excluded by both peers, identically', () => {
  const event = schema.$defs.RpcErrorLogEvent.properties;
  for (const [field, zeros] of [['trace_id', '0'.repeat(32)], ['span_id', '0'.repeat(16)]]) {
    assert.deepEqual(event[field].not, { const: zeros });
    assert.ok(
      typespec.includes(`@extension("not", #{ \`const\`: "${zeros}" })`),
      `TypeSpec must exclude the all-zero ${field} too`,
    );
  }
});
