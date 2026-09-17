# ores-interfaces

Fleet-wide shared semantic contract registry for ORESoftware applications, libraries, and tooling.

Human-authored TypeSpec and Draft 2020-12 JSON Schema remain independent peer authorities. New shared contract families live under `contracts/<family>/<version>/` with reviewed positive/negative fixtures. `ORESoftware/typespec-json-schema-validator` (TJSV) owns generic wire/schema parity and runtime-conformance decisions; `ORESoftware/ores-contracts` owns persistence/codegen convergence for the subset of contracts that explicitly declares persistence semantics. Neither tool becomes an editable contract authority.

See `docs/contract-stack.md` for the reconciled ownership and promotion model, and `docs/fleet-contract-boundaries.md` for fleet/domain/infrastructure boundaries.

## Two migration lanes currently coexist

### Repository-owned contract registry

`contracts/` is the authority location for new fleet-generic shared contracts. Each admitted family keeps independently authored TypeSpec and JSON Schema peers. CI discovers the declared pairs, runs TJSV fail closed, and retains evidence without mutating authored sources.

Pure transport/value contracts stay persistence-neutral. Contract families that intentionally declare tables, keys, indexes, references, or another supported persistence projection additionally run `ores-contracts`; they do not acquire fake persistence semantics merely to satisfy that tool.

Runtime conformance is separate from code generation. Reviewed fixture corpora stay with the contract family; isolated language/runtime adapters produce verdicts only; TJSV's runtime-conformance protocol binds those verdicts to the exact Contract IR, parity receipt, and corpus digest.

### Legacy compatibility package

The original `generated/public` package remains a compatibility slice pinned to `ores-otel/ores-interfaces` at an immutable commit. `shared-interfaces.json` governs that legacy package and does **not** transfer authority for all repository-owned `contracts/` back to the legacy source.

Existing auth/platform consumers remain compatible while declarations migrate explicitly, family by family. Generated compatibility surfaces are removed only after resolved consumer evidence shows the old lane is no longer required.

## Admission and packaging

Every legacy-package build checks exact Git revisions and clean source trees, runs the actual TJSV compiler/parity CLI with recorded positive/negative instances, then runs canonical `verify-ir` over explicit current inputs and the complete declaration inventory. Only afterwards does it assemble unchanged public source snapshots. The validator is imported from its upstream repository, not copied here.

`generated/public` contains TypeSpec, JSON Schema, source/toolchain/output provenance and the upstream license. Public source exports are isomorphic; client, edge and server-specific scopes are empty. No private auth/ORM contracts or unchecked legacy language implementations are included in that package.

Development commands after provisioning the manifest-pinned `.deps/compat` source repository and `.deps/tjsv` validator, as demonstrated in CI:

```sh
npm ci --prefix .deps/tjsv
npm test
npm run test:integration
npm run build
npm pack
```

The npm source package exposes `@oresoftware/ores-interfaces/schema`, `/typespec`, `/provenance`, and `/manifest`; `tspMain` selects the admitted TypeSpec source. It remains `private: true`: local/CI tarball consumption is supported, but registry publication requires a separate reviewed release.

## Boundaries

This repository owns genuinely shared semantic contracts, not product-specific persistence tables, Kubernetes topology, validator implementations, or fleet policy orchestration. Product/domain contract authorities remain in their owning `*-interfaces` repositories and may consume the shared primitives here.

TJSV is the generic TypeSpec/JSON Schema parity and runtime-conformance engine. `ores-contracts` is the persistence-aware independent-parser/codegen convergence engine. `ores-cli` resolves fleet policy and immutable dependency identities. Generated schemas/types/ORM code, Contract IR, parity receipts, adapter evidence, and final conformance reports are downstream evidence, never a third editable authority.

The original bounded public package started with `Ores.Validation.RequestMeta`, `PageQuery`, `ProblemDetails`, and `PublicValidationContract` and has since admitted additional compatibility declarations. It is not a claim of universal schema equivalence or full authority migration. Runtime request validation still belongs at application admission boundaries.

Tracking: DEN-3828 and ORESoftware/typespec-json-schema-validator#20.
