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
      `the positive corpus must cover the ${surface} surface`,
    );
  }
});

test('every reviewed instance is a well-formed plan envelope', async () => {
  for (const verdict of ['valid', 'invalid']) {
    for (const { name, instance } of await load(verdict)) {
      assert.equal(typeof instance, 'object', `${name} is not an object`);
      assert.ok(instance !== null && !Array.isArray(instance), `${name} is not a plan object`);
      // Even a negative instance must be recognizably a plan, or it proves
      // nothing about the contract it is filed against.
      assert.ok(
        'kind' in instance || 'plan_version' in instance,
        `${name} does not look like a request plan`,
      );
    }
  }
});

test('the negative corpus names a distinct rule per instance', async () => {
  const invalid = await load('invalid');
  const names = invalid.map(({ name }) => name);
  assert.equal(new Set(names).size, names.length, 'instance file names must be distinct');
  for (const expected of [
    'unary-only-option-on-a-stream-plan.json',
    'stream-only-option-on-a-unary-plan.json',
    'throttle-and-debounce-together.json',
    'two-stream-rate-shapers.json',
    'timeout-above-documented-maximum.json',
    'unknown-plan-field.json',
    'backoff-without-a-retry-budget.json',
  ]) {
    assert.ok(names.includes(expected), `the corpus must cover ${expected}`);
  }
});

test('a plan can never carry a credential', () => {
  assert.equal(schema.additionalProperties, false, 'the plan must be a closed shape');
  for (const forbidden of ['authorization', 'token', 'bearer_token', 'credential', 'secret']) {
    assert.ok(
      !Object.hasOwn(schema.properties, forbidden),
      `the plan schema must not declare a ${forbidden} property`,
    );
  }
  assert.deepEqual(
    schema.properties.auth_mode.enum,
    ['default', 'omitted', 'bearer_override'],
    'auth_mode records that a credential was overridden, never the credential',
  );
});

test('the two peers declare the same field set', () => {
  // TJSV owns semantic parity; this is a cheap guard against a field being
  // added to one peer and silently forgotten in the other.
  const missing = Object.keys(schema.properties).filter(
    (field) => !new RegExp(`\\b${field}\\??:`).test(typespec),
  );
  assert.deepEqual(missing, [], 'fields present in JSON Schema but absent from TypeSpec');
});

test('the surface split is expressed as conditional constraints, not prose', () => {
  const titles = (schema.allOf ?? []).map((clause) => clause.title ?? '');
  assert.ok(
    titles.some((title) => /stream.*reject/i.test(title)),
    'the schema must reject unary-only shaping on a streaming plan',
  );
  assert.ok(
    titles.some((title) => /unary.*reject/i.test(title)),
    'the schema must reject stream-only shaping on a unary plan',
  );
  assert.ok(
    titles.some((title) => /mutually exclusive/i.test(title)),
    'contradictory rate shaping must be expressed as an exclusion',
  );
});

test('the family config declares two distinct peer authorities', async () => {
  const config = JSON.parse(await readFile(join(FAMILY, 'contracts.config.json'), 'utf8'));
  assert.equal(config.typespec, 'main.tsp');
  assert.equal(config.jsonSchema, 'authored.schema.json');
  assert.notEqual(config.typespec, config.jsonSchema);
  assert.equal(
    schema.$schema,
    'https://json-schema.org/draft/2020-12/schema',
    'the JSON Schema peer must declare Draft 2020-12',
  );
  // deadline_unix_millis is an int64 carried as a JSON number, not a string.
  assert.equal(config.tjsv.int64Strategy, 'number');
});

test('the tightened rules each have a negative instance naming them', async () => {
  const names = (await readdir(join(instancesDir, 'invalid'))).sort();
  for (const expected of [
    'legacy-non-dotted-operation-key.json',
    'proxy-url-carrying-userinfo.json',
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
  // A plan names an operation. If the two grammars drift, a key can be valid in
  // one contract and rejected by the other, which is exactly the class of gap
  // this registry exists to close.
  assert.equal(schema.properties.key.pattern, peer.properties.operation_key.pattern);
  assert.equal(schema.properties.key.minLength, peer.properties.operation_key.minLength);
});

test('a credential cannot be expressed in a plan, not merely discouraged', () => {
  // proxy_url admits only a stripped authority.
  const proxy = new RegExp(schema.properties.proxy_url.pattern);
  assert.equal(proxy.test('http://user:pw@proxy.internal:8080'), false);
  assert.equal(proxy.test('http://[redacted]@proxy.internal:8080'), true);
  assert.equal(proxy.test('http://proxy.internal:8080'), true);
  // and the description says redaction is a boundary property.
  assert.match(schema.properties.headers.description, /boundary/i);
});

test('W3C trace context is constrained to the spec shape', () => {
  assert.equal(new RegExp(schema.properties.trace_id.pattern).test('4bf92f3577b34da6a3ce929d0e0e4736'), true);
  assert.equal(new RegExp(schema.properties.span_id.pattern).test('00f067aa0ba902b7'), true);
  // All-zero is invalid per the spec and is excluded explicitly.
  assert.equal(schema.properties.trace_id.not.const, '0'.repeat(32));
  assert.equal(schema.properties.span_id.not.const, '0'.repeat(16));
});

test('an int64 carried as a JSON number stays exactly representable', () => {
  assert.equal(schema.properties.deadline_unix_millis.maximum, Number.MAX_SAFE_INTEGER);
});
