# desktop daemon operational snapshots

Driver: `ORESoftware/ores-interfaces#59`

This is a bounded review contract for one independently mergeable slice of the driver issue; it does not claim full issue closure.

## Invariants

- Snapshots expose typed readiness, runtime identity, endpoint/control transport, and bounded health state.
- Do not leak credentials, tokens, raw process environment, or unbounded logs through the snapshot.
- Version the snapshot contract and reject unknown incompatible major versions.
- Rust/Flutter/CLI consumers must observe equivalent readiness semantics.

## Verification

- Verify the exact PR head with the repository's normal checks.
- Add/retain negative coverage for fail-closed behavior where this boundary is executable.
- Treat missing, skipped, or zero-step CI as missing evidence.
- Keep generated artifacts downstream of the reviewed authority.

## Non-goals

No credentials, branch-protection bypass, or unreviewed compatibility break is introduced by this contract slice.
