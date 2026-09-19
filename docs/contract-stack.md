# ORES contract stack: authority, projection, and conformance

This repository participates in a four-layer contract stack. The layers are intentionally separate so that authored contract authority, parity checking, persistence projection, and runtime conformance cannot silently become competing sources of truth.

## Canonical responsibilities

| Layer | Owner | Responsibility | Must not become |
| --- | --- | --- | --- |
| Shared authored contracts | `ORESoftware/ores-interfaces` | Own fleet-generic, transport-neutral TypeSpec and Draft 2020-12 JSON Schema peer authorities plus reviewed positive/negative fixture corpora. | Product persistence authority, validator implementation, or deployment topology. |
| Wire/schema admission | `ORESoftware/typespec-json-schema-validator` (TJSV) | Prove independently authored TypeSpec and JSON Schema agree on the admitted wire/runtime shape; produce Contract IR, parity receipts, projection evidence, and fail-closed findings. | A third editable contract authority or product/domain schema owner. |
| Persistence/codegen convergence | `ORESoftware/ores-contracts` | For contract families that opt into its supported persistence subset, parse both authored peers independently, compare normalized persistence semantics, and emit byte-parity SQL/ORM/language witnesses. | Fleet contract registry, runtime conformance adjudicator, or replacement for TJSV. |
| Runtime conformance | TJSV runtime-conformance protocol + isolated consumer/runtime adapters | Bind exact admitted Contract IR and parity receipts to a reviewed fixture corpus, execute language/runtime adapters, and make the final fail-closed conformance decision. | Editable authority, generated expectation source, or persistence migration engine. |

`ORESoftware/ores-cli` is the fleet orchestrator. It resolves immutable dependency identities from the zed-pkg graph, invokes the appropriate gates, and reports policy violations. Runtime libraries must not depend on `ores-cli`.

## Dependency direction

```text
                           +----------------------------+
                           | typespec-json-schema-      |
                           | validator (TJSV)           |
                           | wire + runtime conformance |
                           +-------------^--------------+
                                         |
                                  CI / ores-cli
                                         |
+---------------------+       +----------+----------+
| ores-interfaces     |------>| ores-contracts      |
| authored peer pairs |       | persistence/codegen |
| + fixture corpora   |       | convergence tool    |
+----------^----------+       +---------------------+
           |
           | consume shared semantic contracts
           |
 product/domain *-interfaces and language/runtime adapters
```

The arrow from `ores-interfaces` to `ores-contracts` is a build/admission relationship only. `ores-contracts` does not own or import the fleet's editable shared definitions. TJSV likewise validates exact source revisions without becoming their authority.

## Contract family promotion

Every new or migrated contract family follows this order:

1. **Author two peers.** A human-authored `.tsp` file and a separately human-authored Draft 2020-12 JSON Schema describe the same public semantics. Neither is generated from the other and committed as authority.
2. **Run TJSV first.** TJSV validates source closure, emits/generated Schema B only as evidence, compares the authored JSON Schema peer, and produces the Contract IR/parity receipt. Any unexplained finding stops promotion.
3. **Run `ores-contracts` only when persistence semantics are declared.** A contract that uses tables, keys, indexes, references, or another supported persistence projection must also pass the `ores-contracts` independent-parser/byte-parity gate. Pure transport/value contracts do not acquire fake tables merely to satisfy this tool.
4. **Run runtime conformance when implementations exist.** The fixture corpus belongs with the authored contract family. Isolated adapters return verdicts only. TJSV's runtime-conformance decision code binds those verdicts to the exact Contract IR, parity receipt, and corpus digest.
5. **Promote generated outputs as evidence.** Generated Rust, Dart, TypeScript, SQL, SeaORM, Diesel, Protobuf/OpenAPI projections, receipts, and conformance reports are reproducible evidence. They are never editable authority.

## Correcting an admitted family

Promotion says how a family is admitted. This says what may happen to it
afterwards, which is a separate question and was previously unwritten.

An admitted `contracts/<family>/<version>/` may be **corrected in place** only
while every one of these holds:

1. **Nothing outside this repository depends on it.** The package is
   `private: true` and unpublished, or the version has never been released.
2. **No consumer has shipped against it.** Every known consumer is still
   mid-integration. A consumer that has merged and deployed is a consumer that
   can be broken silently.
3. **The correction is semantic.** It removes an ambiguity, a wrong meaning, or
   a claim the contract cannot keep. Adding fields for convenience is not a
   correction; that is a new version.

If any of those fails, add `contracts/<family>/<next-version>/` instead and
leave the admitted version untouched. Provide a deterministic adapter from the
old shape to the new one so persisted data stays readable, and do not carry the
old name forward as an alias inside the new version.

That last clause is the point of the rule rather than a detail. Keeping a
corrected name as a compatibility alias puts both meanings in one document, so
every consumer needs precedence rules and the ambiguity the correction was meant
to remove survives it. A version boundary separates the two meanings; an alias
merges them.

Record every in-place correction in the family's `README.md`, stating what the
old shape meant and why it could not stand. A correction that leaves no trace is
indistinguishable from the contract having always said the new thing.

Note that `additionalProperties: false` makes most "additive" changes breaking
anyway: a strict consumer rejects unknown properties, so adding a field already
requires every consumer to update. Weigh a correction against that, not against
an imagined zero-cost additive path.

## Conformance ownership

Generic conformance protocol code belongs in TJSV. Repository- or language-specific adapters belong with the implementation they execute. Reviewed fixture corpora and expected accept/reject classifications belong with the contract owner.

That means this repository may contain:

- `contracts/<family>/<version>/main.tsp`;
- `contracts/<family>/<version>/authored.schema.json`;
- positive/negative instance corpora tied to that exact pair; and
- small adapter manifests that identify required runtimes.

It should not copy TJSV's decision algorithm, Contract IR verifier, evidence schema, or finding fingerprint logic. `ores-contracts` should not reimplement runtime conformance either; it may emit persistence witnesses that a later conformance/admission layer consumes.

## Existing legacy compatibility package

`shared-interfaces.json` and `generated/public/` currently preserve a separately pinned compatibility slice originating in `ores-otel/ores-interfaces`. That compatibility lane predates the repository-owned `contracts/` registry and must not be mistaken for the ownership rule for all new contracts.

Migration is explicit and per contract family:

1. copy neither authority blindly;
2. establish independently reviewed TypeSpec and JSON Schema peers under `contracts/<family>/<version>/`;
3. prove TJSV parity and runtime fixtures against the exact new revision;
4. if persistence metadata exists, prove `ores-contracts` convergence as a second independent gate;
5. publish forwarding/generated compatibility outputs while resolved consumers still use the legacy package; and
6. remove the legacy source only after `ores-cli` proves no locked consumer depends on it.

No migration step changes the rule that TypeSpec and JSON Schema are peer authorities.

## Anti-duplication rules

- TJSV is the only generic TypeSpec-versus-JSON-Schema wire parity engine.
- TJSV runtime-conformance is the only generic cross-runtime evidence/decision protocol.
- `ores-contracts` is the only generic persistence/codegen convergence engine for the supported ORES persistence subset.
- `ores-interfaces` is the fleet-wide source registry only for genuinely shared semantic contracts; product/domain authorities remain in their owning `*-interfaces` repositories.
- `ores-cli` coordinates policy and resolved versions; it does not become a parser or runtime dependency.
- Unknown annotations or unsupported persistence constructs fail closed at the layer that owns them. A tool must never silently ignore a construct merely because another layer understands it.

## Current integration pins used as a compatibility witness

At the time this boundary was reconciled, the current compatible tool revisions were:

- `ORESoftware/typespec-json-schema-validator@dd3418aa243198619abfd6106cea3540ef0bbb4f`
- `ORESoftware/ores-contracts@fef0b716d950f717c240504bd85d6f1732a383a0`

These hashes are evidence of one reviewed integration state, not permanent version policy. Fleet execution must use the immutable versions resolved by zed-pkg / repository policy for the exact consumer revision being admitted.
