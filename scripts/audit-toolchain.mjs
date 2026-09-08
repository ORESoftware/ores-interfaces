// Read-only advisory inventory, NOT a passing security certification.
// The source package remains private pending a separately reviewed release.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

async function main() {
  assert.equal(process.argv.length, 2, 'this repository task accepts no command-line options');
  const root = resolve(import.meta.dirname, '..');
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)('npm', ['audit', '--prefix', join(root, '.deps/tjsv'), '--json'],
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024 }));
  } catch (error) {
    // npm exits 1 for advisories. Preserve its report; network/collector errors
    // are rejected below and are never relabeled as a clean audit.
    if (error.code !== 1 || !error.stdout) throw error;
    stdout = error.stdout;
  }
  const report = JSON.parse(stdout);
  assert.ok(!report.error && report.metadata?.vulnerabilities && report.vulnerabilities, 'advisory collection failed');
  const inventory = { schema: 'ores.build-toolchain-advisories/v1',
    status: report.metadata.vulnerabilities.total ? 'advisories-present' : 'no-known-advisories',
    securityCertified: false, registryPublicationEnabled: false,
    counts: report.metadata.vulnerabilities,
    dependencies: Object.values(report.vulnerabilities).map(({ name, severity, isDirect, via, fixAvailable }) =>
      ({ name, severity, isDirect, via, fixAvailable })) };
  await mkdir(join(root, 'tmp'), { recursive: true });
  await writeFile(join(root, 'tmp/tjsv-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(inventory, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## Build-toolchain advisory inventory\n\nStatus: **${inventory.status}**. High: ${inventory.counts.high}; critical: ${inventory.counts.critical}.\n\nThis is separate from interface conformance. Toolchain dependencies are not bundled in the public source package. Registry publication remains disabled; security remediation/review is separate.\n`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 2; });
