# Fleet contract ownership boundaries

Status: accepted direction for new work; existing misplaced definitions migrate incrementally.

## Purpose

`ores-interfaces` is the fleet-wide home for transport-neutral semantic contracts that are genuinely shared across organizations and languages. It defines **what values and messages mean**, not how a Kubernetes cluster deploys them and not product-specific persistence schemas.

The canonical authored contract pair remains independent TypeSpec plus JSON Schema Draft 2020-12. `ORESoftware/typespec-json-schema-validator` (TJSV) is the admission gate; neither authority is generated from the other merely to force parity.

## Ownership matrix

| Concern | Canonical owner | Rule |
| --- | --- | --- |
| Cross-fleet request metadata, pagination, errors, IDs, common envelopes | `ORESoftware/ores-interfaces` | Shared semantic primitives; generate Dart, Rust, Go, TypeScript, Gleam and other supported language surfaces from admitted contracts. |
| Generic NATS message envelopes, subject grammar/naming contracts, correlation/causation metadata | `ORESoftware/ores-interfaces` | These are application-facing interoperability contracts, not Kubernetes deployment topology. |
| Generic Redis key/value/envelope contracts used by multiple orgs | `ORESoftware/ores-interfaces` | Only portable semantic shapes belong here. |
| Lock/lease/fencing contracts and implementations | `ORESoftware/ores-locks-and-leases` | Domain-owned package; may reuse `ores-interfaces` primitives, but remains the authority for coordination semantics. |
| Kubernetes manifests, CRDs, Helm/Kustomize overlays, namespace/service discovery, NATS/JetStream deployment topology, Redis/NATS cluster wiring | `ORESoftware/k8s-libs-and-shared-defs` | Defines **how shared contracts are deployed/wired in Kubernetes**. It may depend on `ores-interfaces`; the reverse dependency is forbidden. |
| Product/org-specific Postgres tables, columns, indexes, RLS and persistence schema | owning org's canonical `*-lib-core` / persistence authority | Never add new product schemas to `k8s-libs-and-shared-defs` or `ores-interfaces`. Infrastructure repositories may reference/version them, but cannot become their authoring authority. |
| TypeSpec/JSON Schema parity and behavioral validation | `ORESoftware/typespec-json-schema-validator` | Tooling layer; must not depend on product/domain runtime packages. |
| Fleet/repo/org conformance policy | `ORESoftware/ores-cli` | Reads repository metadata and resolved zed-pkg graph, delegates contract parity to TJSV, and reports violations. Application/runtime packages must not depend on `ores-cli`. |

## Dependency direction

Allowed direction:

```text
typespec-json-schema-validator   (build/admission tool)
             ^
             | used by CI / ores-cli
             |
ores-interfaces  <-------  ores-locks-and-leases
      ^                         ^
      |                         |
      +---- k8s-libs-and-shared-defs

ores-cli/CI observes and validates all of the above; it is not a runtime dependency.

product/org *-lib-core packages -> ores-locks-and-leases when coordination is required
product/org infra packages      -> k8s-libs-and-shared-defs where cluster wiring is required
```

The diagram is conceptual: TJSV and `ores-cli` are governance/build-time edges, not runtime API dependencies.

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

`ores-interfaces` may define portable persistence-independent value types (IDs, timestamps, cursors, common envelopes). It must not define product tables.

`k8s-libs-and-shared-defs` may hold deployment/registry descriptors saying which product schema/version is deployed where. It must not be the authored source of truth for product tables, columns, indexes, constraints, RLS or migrations.

## Version-resolution rule

Validation that compares contracts across repositories must use the **resolved zed-pkg graph**. A `.zpkg.toml` range expresses policy intent; `.zpkg.lock` is the execution truth. `ores-cli` should fail closed when a dependency that participates in a cross-repo parity check lacks a complete resolved lock entry (exact version plus immutable artifact/VCS identity).

Tip-of-main comparison is useful as a forward-compatibility canary, but it must be reported separately from resolved-version compatibility and must never replace it.

## Anti-cycle rules

1. `ores-interfaces` must not depend on `k8s-libs-and-shared-defs`, `ores-locks-and-leases`, product packages, or `ores-cli`.
2. `typespec-json-schema-validator` must not depend on any product/runtime contract package it validates.
3. `k8s-libs-and-shared-defs` may consume `ores-interfaces`; `ores-interfaces` may not consume Kubernetes deployment definitions.
4. Domain packages such as `ores-locks-and-leases` own their domain contracts and may consume only genuinely generic primitives from `ores-interfaces`.
5. Product/org contract authorities consume shared packages through zed-pkg; shared packages do not reach back into product/org repositories.

## Migration policy

Existing misplaced definitions are compatibility surfaces until consumers are moved. New additions must follow this boundary immediately. Migrations should use forwarding/generated compatibility outputs where practical, then remove the legacy copy after `ores-cli` confirms that no resolved consumer still depends on it.
