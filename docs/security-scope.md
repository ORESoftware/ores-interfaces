# Security scope and build-only advisory inventory

Contract conformance is not a clean software-supply-chain certificate. The
pinned TJSV compiler toolchain is installed in an isolated read-only-permission
CI job. Its npm advisory inventory is queried and retained separately; collector
errors fail the job, while known advisories are explicitly reported as
`advisories-present`, not hidden or relabeled as resolved. This is an inventory,
not a release approval gate. No prior security gate was removed or relaxed.

The public package contains only admitted schema/TypeSpec source snapshots,
provenance, package metadata, documentation and license files. TJSV, its compiler,
flags2env native addon and transitive npm dependencies are not bundled. This does
not remove build-time exposure; use trusted pinned sources and isolated builders.

Registry publication remains disabled (`private: true`) pending a separately
reviewed release, advisory triage/remediation and signed provenance policy.
Do not describe green interface tests as proof that toolchain advisories are
resolved, or the unsigned packageId as a signature. No automatic npm audit fix,
unreviewed override, dependency unlock or validation fallback is allowed.
