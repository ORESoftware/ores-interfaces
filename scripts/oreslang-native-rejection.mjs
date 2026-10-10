// A nonzero compiler exit is not automatically a passing negative fixture.
// Differentiate module/type rejection from OS, launcher, permission, or timeout
// failures; the latter must never produce a "passed" conformance receipt.
export function assertExpectedNativeRejection(kind, result, fixturePath) {
  if (!['missing-post', 'wrong-return'].includes(kind)) {
    throw new Error('unknown native negative fixture');
  }
  if (!result || !Number.isInteger(result.status) || result.status === 0 || result.signal) {
    throw new Error(kind + ': negative fixture was not rejected by the compiler');
  }
  const raw = String(result.stderr ?? '') + '\n' + String(result.stdout ?? '');
  const filename = fixturePath.split(/[\\/]/).at(-1);
  // A launcher message echoing "missing-post.ores" must not satisfy the
  // semantic diagnostic just because the fixture is named "missing-post".
  const clean = raw.replaceAll(fixturePath, '').replaceAll(filename, '');
  const semantic = kind === 'missing-post'
    ? /(?:contract|conform|module|signature)/i.test(clean) && /(?:post|missing|required|implement)/i.test(clean)
    : /(?:type|return|signature|conform|contract)/i.test(clean) && /(?:get|mismatch|incompatible|expected|String|int)/i.test(clean);
  const diagnostic = /(?:error|exception|mismatch|incompatible|missing|does not|not conform|expected|required)/i.test(clean);
  if (!semantic || !diagnostic) {
    throw new Error(kind + ': compiler exited without a relevant contract/type diagnostic');
  }
  return true;
}
