# Conformance

`contracts/` remains authoritative for API, structural, data-shape, and wire semantics. `conformance/` owns the shared implementation-neutral behavioral corpus used to test implementations of those contracts.

## Admission rules

1. Feed the same case bytes to every runtime, adapter, client, server, or generator under test.
2. Runtime-specific golden vectors are not conformance authority.
3. Run `node conformance/check.mjs` before promotion.
4. Evidence is bound to the exact current contract, behavioral-corpus, and conformance-spec SHA-256 digests.
5. Missing, failed, or stale evidence for any required participant fails closed.
6. Generated reports and receipts are evidence only; they do not become contract or conformance authority.
7. Authority paths may not escape their watched namespaces or traverse symlinks.
8. `contractRoots` stay under `contracts/`, case roots and the case schema stay under `conformance/`, and evidence stays at `artifacts/conformance/evidence` so CI path filters remain fail-closed.

The bootstrap document is repository-policy metadata only and does **not** count as behavioral coverage. Keep `coverage.status` at `scaffold-only` with `behavioralCasesRequired: false` until real `ores.conformance.case/v1` behavior cases and required participants exist. Behavioral mode requires both and exact `ores.conformance.evidence/v1` receipts.

Where `contracts/instances/` or contract fixtures already exist, runners should reuse or reference those exact bytes rather than creating divergent implementation-local copies.
