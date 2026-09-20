import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const FAMILY = 'contracts/rpc-client-plan/v1';
const schema = JSON.parse(await readFile(`${FAMILY}/authored.schema.json`, 'utf8'));
const typespec = await readFile(`${FAMILY}/main.tsp`, 'utf8');
const plan = schema.$defs.RpcRequestPlan;
const headers = schema.$defs.RpcHeaders;

test('credential-bearing header names are held to the redaction placeholder', () => {
  const entries = Object.entries(headers.patternProperties ?? {});
  assert.equal(entries.length, 1, 'one shared sensitive-header rule should own redaction');
  const [pattern, rule] = entries[0];
  assert.deepEqual(rule, { const: '[redacted]' });
  const names = new RegExp(pattern);

  for (const name of [
    'authorization',
    'cookie',
    'proxy-authorization',
    'x-auth-token',
    'x-amz-security-token',
    'x-tenant-api-key',
    'client-secret',
    'signature-version',
  ]) {
    assert.ok(names.test(name), `${name} must carry [redacted] in a plan`);
  }
  for (const name of ['accept', 'cache-control', 'content-type', 'x-request-id']) {
    assert.ok(!names.test(name), `${name} is not credential-bearing`);
  }

  assert.ok(
    typespec.includes('@extension(\n  "patternProperties"'),
    'TypeSpec must carry the same machine-readable header redaction rule',
  );
});

test('a W3C span id cannot appear without its trace id', () => {
  assert.deepEqual(plan.dependentRequired?.span_id, ['trace_id']);
  assert.ok(
    typespec.includes('@extension("dependentRequired", #{ span_id: #["trace_id"] })'),
    'TypeSpec must require trace_id whenever span_id is present',
  );
});
