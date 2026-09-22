// Local guards for the rpc-client-plan/v1 contract family.
//
// TJSV owns semantic parity between the two authored peers and validates the
// reviewed instance corpus in CI (polyglot-contract-admission discovers this
// family through its contracts.config.json). These tests cover what TJSV does
// not: that the corpus is shaped to be falsifiable, that the plan can never
// carry a credential, and that a field added to one peer was not forgotten in
// the other. They add no dependency to a registry that has none.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FAMILY = 'contracts/rpc-client-plan/v1';
const MODEL = 'RpcRequestPlan';
const instancesDir = join(FAMILY, 'instances', MODEL);

const schema = JSON.parse(await readFile(join(FAMILY, 'authored.schema.json'), 'utf8'));
// Every declaration is a named peer under $defs, so TJSV has something to match
// against the TypeSpec declaration of the same name. While the plan was the
// schema ROOT, TJSV matched nothing and compared nothing: zero probes.
const plan = schema.$defs.RpcRequestPlan;
const resolve = (node) => (node.$ref ? schema.$defs[node.$ref.replace('#/$defs/', '')] : node);
const typespec = await readFile(join(FAMILY, 'main.tsp'), 'utf8');

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

test('the reviewed corpus exercises both verdicts and both client surfaces', async () => {
  const valid = await load('valid');
  const invalid = await load('invalid');
  assert.ok(valid.length >= 5, `expected a broad positive corpus, got ${valid.length}`);
  assert.ok(invalid.length >= 8, `expected a broad negative corpus, got ${invalid.length}`);
  for (const surface of ['unary', 'stream']) {
    assert.ok(
      valid.some(({ instance }) => instance.kind === surface),
      `positive corpus must exercise ${surface}`,
    );
  }
  assert.ok(valid.some(({ instance }) => instance.headers), 'positive corpus must exercise headers');
  assert.ok(valid.some(({ instance }) => instance.query), 'positive corpus must exercise query');
});

test('every reviewed instance is a well-formed plan envelope', async () => {
  for (const verdict of ['valid', 'invalid']) {
    for (const { name, instance } of await load(verdict)) {
      assert.equal(typeof instance, 'object', `${verdict}/${name}`);
      assert.notEqual(instance, null, `${verdict}/${name}`);
      assert.equal(Array.isArray(instance), false, `${verdict}/${name}`);
      assert.ok('schema_version' in instance, `${verdict}/${name} must carry schema_version`);
      assert.ok('key' in instance, `${verdict}/${name} must carry key`);
      assert.ok('kind' in instance, `${verdict}/${name} must carry kind`);
      assert.ok('surface' in instance, `${verdict}/${name} must carry surface`);
      assert.ok('endpoint' in instance, `${verdict}/${name} must carry endpoint`);
    }
  }
});

test('the negative corpus names a distinct rule per instance', async () => {
  const names = (await load('invalid')).map(({ name }) => name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => name.includes('-')), 'negative names should describe their rule');
});

test('a plan can never carry a credential', () => {
  const source = JSON.stringify(plan);
  for (const forbidden of [
    'authorization',
    'proxy_authorization',
    'cookie',
    'set-cookie',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'password',
    'secret',
  ]) {
    assert.equal(source.toLowerCase().includes(`"${forbidden}"`), false, forbidden);
  }
});

test('the two peers declare the same field set', () => {
  const tspModel = typespec.match(/model RpcRequestPlan\s*\{([\s\S]*?)\n\}/);
  assert.ok(tspModel, 'RpcRequestPlan must exist in TypeSpec');
  const tspFields = [...tspModel[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?:/gm)].map((match) => match[1]);
  assert.deepEqual(tspFields.sort(), Object.keys(plan.properties).sort());
});

test('the surface split is expressed as conditional constraints, not prose', () => {
  assert.ok(Array.isArray(plan.allOf));
  assert.equal(plan.allOf.length, 2);
  for (const branch of plan.allOf) {
    assert.ok(branch.if);
    assert.ok(branch.then);
  }
});

test('the family config declares two distinct peer authorities', async () => {
  const config = JSON.parse(await readFile(join(FAMILY, 'contracts.config.json'), 'utf8'));
  assert.deepEqual(config.authorities, ['typespec', 'json_schema']);
  assert.equal(config.typespec, 'main.tsp');
  assert.equal(config.jsonSchema, 'authored.schema.json');
  assert.equal(config.json_schema_draft, '2020-12');
  // deadline_unix_millis is an int64 carried as a JSON number, not a string.
  assert.equal(config.tjsv.int64Strategy, 'number');
});

test('the tightened rules each have a negative instance naming them', async () => {
  const names = (await readdir(join(instancesDir, 'invalid'))).sort();
  for (const expected of [
    'legacy-non-dotted-operation-key.json',
    'proxy-url-carrying-userinfo.json',
    'query-sensitive-substring-in-the-clear.json',
    'trace-id-not-lowercase-hex.json',
    'trace-id-wrong-length.json',
    'span-id-wrong-length.json',
    'deadline-beyond-js-safe-integer.json',
  ]) {
    assert.ok(names.includes(expected), `the corpus must cover ${expected}`);
  }
});

test('the operation-key grammar matches rpc-operation/v1', async () => {
  const peer = JSON.parse(
    await readFile('contracts/rpc-operation/v1/authored.schema.json', 'utf8'),
  );
  // Resolve the named operation peer rather than depending on whether that
  // declaration is serialized inline at the document root or referenced from it.
  const operation = peer.$defs?.RpcOperation ?? peer;
  assert.ok(operation?.properties?.operation_key, 'RpcOperation.operation_key must exist');
  // A plan names an operation. If the two grammars drift, a key can be valid in
  // one contract and rejected by the other, which is exactly the class of gap
  // this registry exists to close.
  assert.equal(plan.properties.key.pattern, operation.properties.operation_key.pattern);
  assert.equal(plan.properties.key.minLength, operation.properties.operation_key.minLength);
});

test('a credential cannot be expressed in a plan, not merely discouraged', () => {
  // proxy_url admits only a stripped authority.
  const proxy = new RegExp(plan.properties.proxy_url.pattern);
  assert.equal(proxy.test('http://user:pw@proxy.internal:8080'), false);
  assert.equal(proxy.test('http://redacted@proxy.internal:8080'), true);
  assert.equal(proxy.test('http://proxy.internal:8080'), true);
  // and the descriptions say redaction is a boundary property.
  assert.match(resolve(plan.properties.headers).description, /boundary/i);
  assert.match(resolve(plan.properties.query).description, /boundary/i);
});

test('W3C trace context is constrained to the spec shape', () => {
  const trace = resolve(plan.properties.trace_id);
  const span = resolve(plan.properties.span_id);
  assert.equal(trace.pattern, '^[0-9a-f]{32}$');
  assert.equal(span.pattern, '^[0-9a-f]{16}$');
});

test('an int64 carried as a JSON number stays exactly representable', () => {
  const deadline = resolve(plan.properties.deadline_unix_millis);
  assert.equal(deadline.maximum, 9007199254740991);
});
