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
| `OresTraceId` | `^ores-trace-[A-Za-z0-9_-]{21}$` — static call-site trace id, an inline literal fixed at generation time |
| `OresRoutineId` | `^ores-routine-[A-Za-z0-9_-]{21}$` — static routine id, declared once per generated function |
| `RpcErrorTransport` | carrier the failed invocation arrived on: `rpc`, `http`, `in_process` |
| `RpcDispatchOutcome` | `error`, `panic`, `timeout`, `cancelled` |
| `RpcErrorKind` | closed, language-neutral classification of the trapped failure |
| `RpcErrorLogEvent` | the event itself |

Both id patterns mirror `ores-otel/ores.otel.log` `contracts/ores-ids`
(PR #81, merged 2026-09-13) exactly, so an id admitted by one repository is
admitted by the other.

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

`instances/<Declaration>/{valid,invalid}/` holds the positive and negative cases:
TJSV requires both authorities to accept every `valid/` instance and both to
reject every `invalid/` instance. Every file is a single JSON value.

The error-log negative cases include the legacy `dd-trace-` prefix, wrong suffix
lengths, a non-string id, and payload-bearing fields. The operation-IR negative
cases exercise each constraint the TypeSpec previously failed to state:
`dependentRequired` between `route_file` and `route_handler`, `uniqueItems` on
`audiences` and `codecs.allowed`, `minItems` on `namespace`, the `handlers.rs`
and `route.rs` filename patterns, the leading-slash HTTP path, the dotted
`operation_key`, and the section-slot cases (`true`, `""`, `null`, `42`) that the
old `unknown` slot type wrongly accepted.

## Scope of the TJSV comparison

`tjsv.mapping.json` excludes nothing. Every declaration in the pair is compared,
and CI fails closed if an exclusion is ever reintroduced.

This was not always true. The `RpcOperation` group was originally excluded,
which left the operation IR that ores-stack and api-docs consume without a
fail-closed gate. The two authorities were genuinely out of parity, but the
divergence was entirely one-sided: the authored JSON Schema published patterns,
`minItems`, `uniqueItems` and `dependentRequired` that the TypeSpec never
stated, and modelled the section slots as an inline schema object or a non-empty
reference string where the TypeSpec said `unknown`. Running TJSV over the old
pair reports 39 instance-verdict divergences and every single one reads
"authored rejects, TypeSpec-generated accepts" — never the reverse.

Parity was therefore restored by having the TypeSpec state the constraints the
authored schema already published, not by loosening the published schema. The
admitted instance set of `authored.schema.json` is unchanged.

## Declarations

| Declaration | Purpose |
| --- | --- |
| `HttpMethod` | wire method of an optional HTTP projection |
| `RpcRouteHandler` | lowercase Axum handler name a `route.rs` projection binds to |
| `RpcAudience` | `browser`, `server` |
| `RpcScope` | `regular`, `admin` |
| `RpcPayloadCodec` | `json`, `protobuf`, `messagepack` |
| `RpcStreamMode` | `unary`, `server_stream`, `client_stream`, `bidi`; absent means legacy unary |
| `RpcNamespaceSegment` | one lowercase segment of the operation namespace |
| `RpcSchemaReference` | non-empty locator for a schema held outside this document |
| `RpcInlineSchema` | a JSON Schema document carried inline; deliberately open |
| `RpcSchemaRef` | what a section slot holds: `RpcInlineSchema` or `RpcSchemaReference` |
| `RpcSource` | the authoritative `handlers.rs` operation and its optional `route.rs` projection |
| `RpcHttpProjection` | optional REST method/path |
| `RpcCodecSet` | allowed codecs and the default |
| `RpcRequestShape` | path/query/header/body section slots |
| `RpcResponseShape` | header/trailer/body/error section slots |
| `RpcOperation` | the operation IR itself |

Declaration names are PascalCase on both sides, matching the peer names TJSV
compares. Every wire property name is snake_case on both sides.

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
