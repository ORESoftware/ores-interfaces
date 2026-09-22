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
| `RpcLayer` | seam that emitted the event: `handler`, `dispatch`, `transport`, `client` |
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

`instances/<Declaration>/{valid,invalid}/` holds positive and negative cases. TJSV
requires both authorities to accept every `valid/` instance and both to reject every
`invalid/` instance. Every file is a single JSON value.

The id corpus pins both compatibility boundaries and the canonical generator subset:
widths 12, 20, 21, 22, 41 and 64 are valid; 11 and 65 are invalid. Wrong prefixes,
disallowed characters, non-string values and payload-bearing event fields remain
invalid.

The operation-IR negative cases exercise each constraint the TypeSpec previously
failed to state: `dependentRequired` between `route_file` and `route_handler`,
`uniqueItems` on `audiences` and `codecs.allowed`, `minItems` on `namespace`, the
`handlers.rs` and `route.rs` filename patterns, the leading-slash HTTP path, the
dotted `operation_key`, and the section-slot cases (`true`, `""`, `null`, `42`)
that the old `unknown` slot type wrongly accepted.

## Scope of the TJSV comparison

`tjsv.mapping.json` excludes nothing. Every declaration in the pair is compared,
and CI fails closed if an exclusion is ever reintroduced.

This was not always true. The `RpcOperation` group was originally excluded, which
left the operation IR that ores-stack and api-docs consume without a fail-closed
gate. The two authorities were genuinely out of parity, but the divergence was
one-sided: the authored JSON Schema published patterns, `minItems`, `uniqueItems`
and `dependentRequired` that the TypeSpec never stated, and modelled section slots
as an inline schema object or a non-empty reference string where the TypeSpec said
`unknown`.

Parity is restored by having TypeSpec state constraints the authored schema already
published, not by loosening the published schema. Generated schemas remain evidence
only.

## Operation declarations

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
| `RpcSchemaRef` | section slot value: `RpcInlineSchema` or `RpcSchemaReference` |
| `RpcSource` | authoritative `handlers.rs` operation and optional `route.rs` projection |
| `RpcHttpProjection` | optional REST method/path |
| `RpcCodecSet` | allowed codecs and default |
| `RpcRequestShape` | path/query/header/body section slots |
| `RpcResponseShape` | header/trailer/body/error section slots |
| `RpcOperation` | operation IR itself |

Declaration names are PascalCase on both sides, matching the peer names TJSV
compares. Every wire property name is snake_case on both sides.

## Verify locally

```sh
npx --yes \
  --package="https://github.com/ORESoftware/typespec-json-schema-validator/archive/bfe9667cc6ac8863d436587d8125c4eb66ddd647.tar.gz" \
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

## Identity fields: static versus dynamic

`RpcErrorLogEvent` carries two kinds of identity, and they are not
interchangeable:

| Field | Kind | Shape | Required |
| --- | --- | --- | --- |
| `ores_trace_id` | **static** call-site identity, emitted as an inline literal by the generator | `ores-trace-<12..64 compatible; 21 generated>` | yes |
| `ores_routine_id` | **static** routine identity for the call site | `ores-routine-<12..64 compatible; 21 generated>` | no |
| `trace_id` | **dynamic** W3C trace-context trace-id for the invocation | 32 lowercase hex | no |
| `span_id` | **dynamic** W3C trace-context span-id for the invocation | 16 lowercase hex | no |

The static pair answers *which line of code emitted this*. The dynamic pair
answers *which invocation was it part of*. An earlier version of this contract
called the static value simply `trace_id`, which collided with the W3C field of
the same name in `rpc-client-plan/v1` — so a log join across the two contracts
would silently conflate a source location with an invocation, and the resulting
"trace" would group together every occurrence of one call site.

The dynamic fields are optional because an error can be logged outside any
propagated trace. The static one is required because the generator always knows
it.

## `rpc_layer`

Required, one of `handler`, `dispatch`, `transport`, `client`.

One error legitimately produces more than one log line as it crosses seams: a
handler failure is re-raised through dispatch and observed again at the
transport. `rpc_layer` says which of those a given line is.

**It is a classification, not a correlation key.** It tells a reader that two
lines were emitted at different seams; it does not tell them the two lines
describe the *same* failure. That takes the W3C `trace_id` and `span_id`. Where
those are absent — an error logged outside any propagated trace — two
independent failures at one call site and one layer are indistinguishable in
this contract, and a consumer must not deduplicate on
`(ores_trace_id, rpc_layer)` alone. An earlier version of this section justified
the field by what "a deduplicator needs", which promised more than one enum can
deliver. If per-failure correlation without trace context turns out to be
needed, the answer is a non-sensitive per-dispatch correlation id in a new
version, not a wider reading of this field.

## Corrections to this version

Per [Correcting an admitted family](../../../docs/contract-stack.md#correcting-an-admitted-family).

### `trace_id` → `ores_trace_id` (static call-site identity)

**What the old shape meant.** `RpcErrorLogEvent.trace_id` was required and
`$ref`ed `OresTraceId` — the static `ores-trace-*` literal the generator emits
inline at a source location. It identified *a line of code*.

**Why it could not stand.** `trace_id` in the sibling `rpc-client-plan/v1` means
the W3C trace-context trace-id for *one invocation*. Two different concepts held
the same field name in one registry. A log join across both contracts groups by
`trace_id` and silently conflates a source location with a request, so the
resulting "trace" collects every occurrence of one call site. Nothing errors;
the telemetry is simply wrong, and wrong in a way that looks plausible.

**Correction.** Renamed by origin: `ores_trace_id` and `ores_routine_id` are
static, `trace_id` and `span_id` are dynamic W3C context. `rpc_layer` was added
as a required discriminator. No alias was kept — see the policy for why an alias
would have preserved the ambiguity rather than easing it.

**Admissibility.** Corrected in place rather than versioned, because at the time
all three conditions held: the package is `private: true` and unpublished, the
family was five hours old with all three consumers still mid-integration, and
the change is semantic rather than additive.

The first condition is no longer prose. `corrections.json` declares this
correction, and `test/contract-corrections.test.mjs` fails unless the package is
`private`, `contracts/` is outside its released file set, and none of the
corrected declarations appears in anything the package ships. So the permission
lapses by itself the day this family is released. The second condition — that
no consumer had shipped — cannot be established from this repository;
`corrections.json` says so rather than implying otherwise.

### Negative fixtures repaired (same correction)

Making `rpc_layer` required invalidated nine existing negatives for the wrong
reason: they had been renamed but did not carry the new field, so each was
rejected whether or not its named defect was present. `legacy-dd-ores-trace-prefix`
carried three defects at once, and `header-and-meta-fields` two; the latter is
now `headers-field` and `meta-field`. Every negative has a
`valid/repaired-<name>.json` differing in the one field `negative-repairs.json`
names, so "rejected for the rule in its filename" is checked rather than
assumed.
