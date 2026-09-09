# Consuming the shared interfaces

## Reproducible source setup

In a fresh checkout, provision the exact dependencies recorded by the policy:

```sh
mkdir -p .deps
git clone --no-checkout https://github.com/ores-otel/ores-interfaces.git .deps/compat
git -C .deps/compat checkout --detach "$(node -p 'require("./shared-interfaces.json").source.commit')"
git clone --no-checkout https://github.com/ORESoftware/typespec-json-schema-validator.git .deps/tjsv
git -C .deps/tjsv checkout --detach "$(node -p 'require("./shared-interfaces.json").validator.commit')"
npm ci --prefix .deps/tjsv
npm run check
npm pack
```

Do not rerun clone into an existing checkout or force it clean. A changed pin or
dirty dependency fails closed; review it and use the normal Git merge workflow.
The root package has no runtime/build dependencies to install. TJSV itself owns
its exact compiler/emitter/f2e dependency lock. No fabricated `.zpkg.lock` exists.

## Public source API

A locally packed tarball exposes these source entry points (this is not an npm
registry release):

```js
import schema from '@oresoftware/ores-interfaces/schema' with { type: 'json' };
import provenance from '@oresoftware/ores-interfaces/provenance' with { type: 'json' };
const requestMetaSchema = schema.$defs.RequestMeta;
```

The package's `tspMain` identifies `generated/public/main.tsp`; TypeSpec consumers
with the declared compiler/emitter peers can import `@oresoftware/ores-interfaces`.
Schema consumers must support Draft 2020-12 and the document's local resources.
The root `$id`, model namespaces and existing field semantics are preserved.

`PageQuery.limit` is required despite its default annotation. Optional locale,
cursor and detail may be absent, not null. String limits are Unicode code-point
limits; no implicit whitespace trimming occurs. Those invariants are exercised
through both source lanes in the recorded corpus, not asserted by metadata alone.

The `.zpkg.toml` exposes repository and public-contract source targets.
`zed task run build` and `zed task run check` call the same admission/test paths;
they do not create a separate validator. `zed validate` and task execution are
checked with the pinned CLI in CI. Registry resolution, publication and a genuine
frozen installation remain release work; no placeholder lock claims otherwise.

## Domain-specific form contracts and runtime validators

A domain package such as `ores-forms/ores-forms-interfaces` owns its form models.
Its author-maintained TypeSpec and human-authored Draft 2020-12 JSON Schema are
independent peer authorities and must be admitted together through pinned TJSV.
Do not move form-specific models into this repository merely to make code generation
or package consumption convenient. This repository is only for interfaces that are
truly shared across organizations.

Zod/TypeScript, Rust/Serde-backed validation, Dart/Flutter, WASM and Qt/QML
bindings are downstream runtime artifacts and evidence. A TJSV-integrated generator
or adapter may derive them from admitted inputs, but generated output must stay in a
read-only `generated/` tree, retain source/toolchain provenance, and never become a
third editable contract authority. Promotion requires positive/negative runtime
fixtures against the exact admitted contract revision; successful code generation
alone is not runtime-conformance evidence.

Form synchronization is a separate concern. `opto-sync` may carry optimistic local
updates, revisions and conflict metadata between app layers, but it does not own field
validation rules. Every server admission boundary still revalidates the submitted
payload against the same admitted contract semantics before authorization or writes.
Client-side reactive validation improves UX and can reject early; it never replaces
server-side validation, tenant checks, authorization or database invariants.

## Ownership and migration

This package currently distributes the four shared public validation declarations
from an exact revision of `ores-otel/ores-interfaces`. Their author-maintained
TypeSpec and JSON Schema stay there. Change both independently, run parity, merge
that source PR, then update the source commit in this repository and rerun the
complete consumer gate. Generated public snapshots are never edited here.

The existing auth/platform/startup/retry families and legacy native language
bindings are deliberately not copied or advertised as TJSV-certified. Their
migration requires per-family scope, compatibility, consumer and runtime evidence.
Moving shared authorities to this repo later is a separately reviewed migration,
not an implicit consequence of its name. Business logic, database code, policy
and actual runtime validation remain in sibling libraries and applications.

Provenance hashes provide binding, not authenticity. The live build gate invokes
TJSV's exact-input verifier; `auditBuiltPackage` only detects output/policy drift.
Use trusted CI and immutable pins. Signatures, release attestations and checks
against hostile concurrent filesystem mutation are outside this initial slice.
