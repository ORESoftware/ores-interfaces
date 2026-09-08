# ores-interfaces

TJSV-gated shared interface source package for ORESoftware applications, libraries
and tooling. The initial public surface is `Ores.Validation.RequestMeta`,
`PageQuery`, `ProblemDetails`, and `PublicValidationContract`.

This repository consumes the existing independently authored TypeSpec and
Draft 2020-12 JSON Schema from `ores-otel/ores-interfaces` at an immutable commit.
It does not transfer that repository or create a competing editable authority.
Existing auth/platform consumers remain compatible and are not migrated by this
change. The exact source and TJSV commits are in `shared-interfaces.json`.

## Admission and packaging

Every build checks both Git revisions and clean source trees, runs the actual
TJSV compiler/parity CLI with recorded positive/negative instances, then runs
canonical `verify-ir` over explicit current inputs and the complete declaration
inventory. Only afterwards does it assemble unchanged public source snapshots.
The validator is imported from its upstream repository, not copied here.

`generated/public` contains TypeSpec, JSON Schema, source/toolchain/output
provenance and the upstream license. Public source exports are isomorphic;
client, edge and server-specific scopes are empty. No private auth/ORM contracts
or unchecked legacy language implementations are included in this package.

Development commands after provisioning the manifest-pinned `.deps/compat`
(source repository) and `.deps/tjsv` (validator), as demonstrated in CI:

```sh
npm ci --prefix .deps/tjsv
npm test
npm run test:integration
npm run build
npm pack
```

The root package has no development dependencies to resolve. TypeSpec users
provide the declared optional compiler/emitter peers; JSON Schema consumers do
not need them. Build tasks require Node 22.9+ and Git. Extra task flags are
rejected; TJSV owns CLI option parsing through its flags-2-env contract.

The npm source package exposes `@oresoftware/ores-interfaces/schema`,
`/typespec`, `/provenance`, and `/manifest`; `tspMain` selects the admitted
TypeSpec source. It remains `private: true`: local/CI tarball consumption is
supported, but registry publication requires a separate reviewed release.

## Boundaries

This gate certifies bounded data-contract evidence for these four declarations,
not all legacy auth/platform contracts, every SDK, or universal schema
equivalence. No services are deployed. Runtime request validation still belongs
at application admission boundaries; shipping schemas alone does not execute it.
15+ language code generation, full authority migration and signed release
attestations remain separate work. Follow the migration notes in `docs/`.

Tracking: DEN-3828 and ORESoftware/typespec-json-schema-validator#20.
