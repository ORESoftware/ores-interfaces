import test from 'node:test';
import assert from 'node:assert/strict';
import {assertExpectedNativeRejection} from '../scripts/oreslang-native-rejection.mjs';

const path = '/tmp/work/contracts/oreslang-route/v1/fixtures/missing-post.ores';
const wrong = '/tmp/work/contracts/oreslang-route/v1/fixtures/wrong-return.ores';

test('accept actual contract-member and signature-rejection diagnostics', () => {
  assert.equal(assertExpectedNativeRejection('missing-post', {
    status: 1, signal: null,
    stderr: 'Oreslang type error: module Route does not conform to RouteContract; missing required post(String) method',
  }, path), true);
  assert.equal(assertExpectedNativeRejection('wrong-return', {
    status: 1, signal: null,
    stderr: 'Oreslang compiler error: contract return signature mismatch for get: expected String, got int',
  }, wrong), true);
});

test('reject launcher failure, missing file, timeout or signal despite nonzero exit', () => {
  for (const stderr of [
    'ENOENT: cannot open ' + path,
    'process out of memory',
    'unknown option: --check',
    'permission denied',
    'Oreslang launcher failed',
    'compiler binary unavailable',
  ]) {
    assert.throws(() => assertExpectedNativeRejection('missing-post', {
      status: 1, signal: null, stderr,
    }, path), /relevant contract\/type diagnostic/, stderr);
  }
  for (const result of [
    {status: 0, stderr: 'contract post missing'},
    {status: null, signal: 'SIGKILL', stderr: 'contract post missing'},
  ]) {
    assert.throws(() => assertExpectedNativeRejection('missing-post', result, path));
  }
});

test('filename words alone cannot satisfy an expected diagnostic', () => {
  assert.throws(() => assertExpectedNativeRejection('wrong-return', {
    status: 1,
    stderr: 'could not open ' + wrong,
  }, wrong));
  assert.throws(() => assertExpectedNativeRejection('unknown', {
    status: 1, stderr: 'contract signature mismatch',
  }, wrong));
});
