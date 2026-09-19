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

`instances/<Declaration>/{valid,invalid}/` holds the positive and negative cases.
Every file is a single JSON value. The negative cases include the legacy
`dd-trace-` prefix, wrong suffix lengths, a non-string id, and payload-bearing
fields.

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

## Identity fields: static versus dynamic

`RpcErrorLogEvent` carries two kinds of identity, and they are not
interchangeable:

| Field | Kind | Shape | Required |
| --- | --- | --- | --- |
| `ores_trace_id` | **static** call-site identity, emitted as an inline literal by the generator | `ores-trace-<21-char nanoid>` | yes |
| `ores_routine_id` | **static** routine identity for the call site | `ores-routine-<21-char nanoid>` | no |
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
transport. Without a layer discriminator a deduplicator cannot tell that from a
double-log bug, so it either hides real duplication or silently drops
legitimate events.

## Corrections to this version

Per [Correcting an admitted family](../../../docs/contract-stack.md#correcting-an-admitted-family).

### `trace_id` → `ores_trace_id` (static call-site identity)

**What the old shape meant.** `RpcErrorLogEvent.trace_id` was required and
`$ref`ed `OresTraceId` — the `ores-trace-<21-char nanoid>` literal the generator
emits inline at a source location. It identified *a line of code*.

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
