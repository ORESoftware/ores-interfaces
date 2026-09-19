# Conformance

`contracts/` remains authoritative for API, data-shape, and wire semantics. `conformance/` owns shared implementation-neutral behavioral expectations for consumers of those contracts.

## Admission rules

1. Feed the same case bytes to every runtime, adapter, client, server, or generator under test.
2. Runtime-specific golden vectors are not conformance authority.
3. Run `node conformance/check.mjs` before promotion.
4. Evidence must be bound to the exact current contract and corpus SHA-256 digests.
5. Missing or stale evidence for any required participant fails closed.
6. Generated reports and receipts are evidence only; they do not become contract or conformance authority.
7. Symlinks and repository-path escape are forbidden in authority inputs.

`manifest.v1.json` stays at `coverageStatus: "bootstrap"` until domain cases exist and `requiredParticipants` is non-empty with matching `ores.conformance.evidence/v1` receipts. Changing it to `"enforced"` before that is intentionally an error.

Where `contracts/instances/` or contract fixtures already exist, runners should reuse or reference those exact bytes rather than creating divergent implementation-local copies.
