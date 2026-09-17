# Fleet contract ownership boundaries

Status: accepted direction for new work; existing misplaced definitions migrate incrementally.

## Purpose

`ores-interfaces` is the fleet-wide home for transport-neutral semantic contracts that are genuinely shared across organizations and languages. It defines **what values and messages mean**, not how a Kubernetes cluster deploys them and not product-specific persistence schemas.

The canonical authored contract pair remains independent TypeSpec plus JSON Schema Draft 2020-12. `ORESoftware/typespec-json-schema-validator` (TJSV) is the wire/schema admission and runtime-conformance gate; neither authority is generated from the other merely to force parity. `ORESoftware/ores-contracts` is a separate persistence/codegen convergence tool for contract families that explicitly opt into its supported persistence subset. It does not own shared definitions and does not replace TJSV.

## Ownership matrix

| Concern | Canonical owner | Rule |
| --- | --- | --- |
| Cross-fleet request metadata, pagination, errors, IDs, common envelopes | `ORESoftware/ores-interfaces` | Shared semantic primitives; generate Dart, Rust, Go, TypeScript, Gleam and other supported language surfaces from admitted contracts. |
| Generic NATS message envelopes, subject grammar/naming contracts, correlation/causation metadata | `ORESoftware/ores-interfaces` | These are application-facing interoperability contracts, not Kubernetes deployment topology. |
| Generic Redis key/value/envelope contracts used by multiple orgs | `ORESoftware/ores-interfaces` | Only portable semantic shapes belong here. |
| Lock/lease/fencing contracts and implementations | `ORESoftware/ores-locks-and-leases` | Domain-owned package; may reuse `ores-interfaces` primitives, but remains the authority for coordination semantics. |
| Kubernetes manifests, CRDs, Helm/Kustomize overlays, namespace/service discovery, NATS/JetStream deployment topology, Redis/NATS cluster wiring | `ORESoftware/k8s-libs-and-shared-defs` | Defines **how shared contracts are deployed/wired in Kubernetes**. It may depend on `ores-interfaces`; the reverse dependency is forbidden. |
| Product/org-specific Postgres tables, columns, indexes, RLS and persistence schema | owning org's canonical `*-interfaces` plus reviewed persistence authority | Product contracts stay with their owning org; `*-orm-core` and migration repos consume admitted projections but do not become a second source authority. |
| TypeSpec/JSON Schema wire parity, Contract IR, projection verification, runtime evidence and conformance decisions | `ORESoftware/typespec-json-schema-validator` | Generic admission/conformance tooling; must not depend on product/domain runtime packages. Generated Schema B and reports are evidence, never authority. |
| Persistence-aware independent parsing, SQL/SeaORM/Diesel/language witness convergence | `ORESoftware/ores-contracts` | Build/admission tool for the explicitly supported persistence subset. Consumes authored peer pairs from an owning `*-interfaces` repo; must not become the fleet registry or runtime conformance engine. |
| Fleet/repo/org conformance policy | `ORESoftware/ores-cli` | Reads repository metadata and resolved zed-pkg graph, delegates wire/runtime parity to TJSV and persistence convergence to `ores-contracts` when declared, and reports violations. Application/runtime packages must not depend on `ores-cli`. |

## Dependency direction

Allowed direction:

```text
                  typespec-json-schema-validator (TJSV)
                    wire parity + runtime decision
                               ^
                               | CI / ores-cli
                               |
ores-interfaces -------------------------------+
 authored peer pairs + fixtures                 |
      ^                                         |
      |                                         v
      |                              ores-contracts
      |                              persistence/codegen
      |                              convergence only
      |
      +---- ores-locks-and-leases
      +---- k8s-libs-and-shared-defs

product/org *-interfaces may consume shared primitives from ores-interfaces
and may invoke TJSV / ores-contracts as build-time gates for their own contracts.
```

The TJSV and `ores-contracts` edges are governance/build-time edges, not runtime API dependencies. Neither tool reaches back and edits the authority repository.

## One contract, multiple proofs

A contract family may need more than one proof, but those proofs must not compete:

1. `ores-interfaces` or a product `*-interfaces` repo owns the two human-authored peer authorities.
2. TJSV proves wire/schema parity and emits Contract IR plus receipts.
3. If the family declares persistence metadata inside the supported subset, `ores-contracts` independently parses both peers and proves persistence/codegen convergence.
4. Runtime adapters execute reviewed positive/negative cases and return verdicts only; TJSV's runtime-conformance protocol binds the decision to the exact Contract IR and corpus digest.
5. `ores-cli` verifies the resolved dependency graph and that every required proof exists for the exact pinned revisions.

A generated language binding, SQL file, ORM declaration, Schema B, receipt, or conformance report is evidence and never becomes editable authority.

## NATS boundary

Move or author the following in `ores-interfaces` when they are fleet-generic:

- message/event envelope fields;
- subject grammar and reserved fleet prefixes;
- correlation, causation, trace and idempotency metadata;
- serialization/version-discriminator contracts;
- portable request/reply and event metadata shared across products.

Keep the following in `k8s-libs-and-shared-defs`:

- JetStream stream/consumer deployment definitions;
- replica/storage/retention topology chosen for a cluster/environment;
- Kubernetes resources, service accounts, secret references and network policy;
- environment placement and operational defaults.

Product-specific subjects or payloads remain in the owning product/org contract package and may compose the fleet-generic envelope.

## Persistence boundary

`ores-interfaces` may define portable persistence-independent value types such as IDs, timestamps, cursors and common envelopes. It must not define product tables merely because `ores-contracts` can project tables.

Product/org `*-interfaces` repos own product-specific authored contracts. Their `*-orm-core` and migration layers consume admitted outputs. `ores-contracts` may prove SQL/SeaORM/Diesel convergence for those contracts, but it never becomes the schema owner.

`k8s-libs-and-shared-defs` may hold deployment/registry descriptors saying which product schema/version is deployed where. It must not be the authored source of truth for product tables, columns, indexes, constraints, RLS or migrations.

## Conformance boundary

Generic conformance protocol code belongs in TJSV. Expected cases and their accept/reject classifications belong with the contract owner. Language/runtime adapters belong with the implementation they execute and must report verdicts without rewriting expectations.

Do not copy TJSV's runtime evidence schemas, Contract IR verifier, decision algorithm, or finding fingerprint logic into `ores-interfaces`, `ores-contracts`, or product repos. Likewise, do not make `ores-contracts` adjudicate runtime behavior; its scope is deterministic persistence/codegen convergence.

## Version-resolution rule

Validation that compares contracts across repositories must use the **resolved zed-pkg graph**. A `.zpkg.toml` range expresses policy intent; `.zpkg.lock` is the execution truth. `ores-cli` should fail closed when a dependency that participates in a cross-repo parity check lacks a complete resolved lock entry with exact version plus immutable artifact/VCS identity.

Tip-of-main comparison is useful as a forward-compatibility canary, but it must be reported separately from resolved-version compatibility and must never replace it.

## Anti-cycle rules

1. `ores-interfaces` must not depend at runtime on `k8s-libs-and-shared-defs`, `ores-locks-and-leases`, product packages, `ores-contracts`, TJSV, or `ores-cli`; tool use is CI/build-only.
2. TJSV must not depend on any product/runtime contract package it validates.
3. `ores-contracts` must not own or import editable fleet/product authorities as bundled source; it operates on paths/revisions supplied by the caller.
4. `k8s-libs-and-shared-defs` may consume `ores-interfaces`; `ores-interfaces` may not consume Kubernetes deployment definitions.
5. Domain packages such as `ores-locks-and-leases` own their domain contracts and may consume only genuinely generic primitives from `ores-interfaces`.
6. Product/org contract authorities consume shared packages through zed-pkg; shared packages do not reach back into product/org repositories.
7. `ores-cli` orchestrates resolved policy but does not become a wire parser, persistence emitter, or runtime dependency.

## Migration policy

Existing misplaced definitions are compatibility surfaces until consumers are moved. New additions must follow this boundary immediately. Migrations should use forwarding/generated compatibility outputs where practical, then remove the legacy copy after `ores-cli` confirms that no resolved consumer still depends on it.

The legacy `shared-interfaces.json` / `generated/public` compatibility package is one such migration surface. New repository-owned contract families under `contracts/` follow the reconciled stack in `docs/contract-stack.md`; the legacy source pin does not override that ownership model.
