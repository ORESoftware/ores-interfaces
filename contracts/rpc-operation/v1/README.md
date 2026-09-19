# rpc-operation v1

`main.tsp` (TypeSpec) and `authored.schema.json` (JSON Schema Draft 2020-12) are
independently hand-authored peer authorities. Neither is generated from the other,
and TJSV output is comparison evidence only, never a third authority.

The directory carries two related groups of declarations.

## Normalized operation IR

`RpcOperation` and its supporting declarations are the language-neutral operation
shape emitted from one authoritative Rust `handlers.rs` operation. `route.rs` and
REST metadata are optional HTTP projections.

## Payload-free RPC error logging

Added for DEN-666. When generated RPC code guards a dispatch with the language's
error-trapping mechanism, logs the failure through the ores-otel seam and then
re-raises, this is the shape of the event it emits.

| Declaration | Purpose |
| --- | --- |
| `OresTraceId` | `^ores-trace-[A-Za-z0-9_-]{12,64}$` compatibility shape; current generators mint 21-character nanoids and keep the static id inline at the call site |
| `OresRoutineId` | `^ores-routine-[A-Za-z0-9_-]{12,64}$` compatibility shape; current generators mint 21-character nanoids and declare the id once per generated function |
| `RpcErrorTransport` | carrier the failed invocation arrived on: `rpc`, `http`, `in_process` |
| `RpcDispatchOutcome` | `error`, `panic`, `timeout`, `cancelled` |
| `RpcErrorKind` | closed, language-neutral classification of the trapped failure |
| `RpcErrorLogEvent` | the event itself |

The important distinction is **admission vs generation**. Existing ORES wire/runtime
contracts admit suffix widths from 12 through 64 for compatibility. New ORES tooling
uses the 21-character nanoid width as the canonical generated form. A CI guard must
not silently narrow the wire contract merely because the current generator emits a
single width.

`RpcErrorLogEvent` is payload-free by construction. It has no property for a
request or response body, a path or query value, a header, a `meta` object, or
any user data, and it is a closed model (`additionalProperties: false`, and the
TypeSpec equivalent under `--seal-object-schemas=true`), so a generator that adds
one fails admission rather than leaking. `payload_omitted: true` states that rule
positively so a consumer can assert it rather than infer it. `re_raised` records
that the trapped error was re-raised — returned unchanged, rethrown,
`resume_unwind`-ed or re-panicked — instead of swallowed. Both property names use
this contract's snake_case wire convention.

## Instance corpus

`instances/<Declaration>/{valid,invalid}/` holds the positive and negative cases.
Every file is a single JSON value. The id corpus pins both compatibility boundaries
and the canonical generator subset: widths 12, 21, 22, 41 and 64 are valid; 11 and
65 are invalid. Wrong prefixes, disallowed characters and non-string values remain
invalid.

## Scope of the TJSV comparison

`tjsv.mapping.json` currently excludes the pre-existing `RpcOperation` group from
comparison. Those declarations are not yet at peer parity: the authored schema
models the request/response schema slots as `schemaRef` (object or non-empty
string) while the TypeSpec models them as `unknown`, and the authored schema has
no peers for several TypeSpec declarations. Bringing them to parity changes the
published operation-IR contract and belongs in its own reviewed change. The
exclusions are declared explicitly, and TJSV's mapping-integrity gate fails
closed if any of them goes stale.

## Verify locally

```sh
npx --yes \
  --package="https://github.com/ORESoftware/typespec-json-schema-validator/archive/1614779275115258db73b92c938313e8ae437936.tar.gz" \
  tjsv check \
  --typespec=contracts/rpc-operation/v1/main.tsp \
  --schema=contracts/rpc-operation/v1/authored.schema.json \
  --mapping=contracts/rpc-operation/v1/tjsv.mapping.json \
  --instances=contracts/rpc-operation/v1/instances \
  --seal-object-schemas=true
```

CI runs the same command in `.github/workflows/rpc-operation-tjsv.yml`. Any
structural, declaration, differential-validation or corpus disagreement fails
closed.
