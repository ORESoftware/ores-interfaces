# rpc-client-plan v1

Fleet-shared contract for a **request plan**: the canonical, transport-free
serialization of a fully built RPC client chain.

## Why this is a registry contract and not an api-docs detail

`ORESoftware/api-docs` owns the option catalog that *produces* plans and the
generator that projects it into documentation, schemas and per-language clients.
Until now the plan shape was defined only inside that one consumer, which made
it a de-facto contract with no peer authority and no fleet-visible home.

This family supplies the missing peer. `main.tsp` and `authored.schema.json` are
independently authored authorities; TJSV owns semantic comparison between them.
Generated schemas, generated clients and api-docs' own consumer-side copy remain
evidence, never a third authority.

## What a plan is for

A plan is the cross-language conformance unit. The same chain built in Rust,
TypeScript, Dart, Go or Gleam must serialize to a byte-identical plan, so client
agreement is checked against bytes rather than asserted in prose. Plans are also
inspectable without opening a socket, which is what makes the surface testable
at all.

## The two client surfaces

`kind` discriminates the unary and streaming surfaces, which are separate types
in every generated client: a unary chain terminates in `make_call`, a streaming
chain in `stream`, and neither carries the other's terminal.

The schema peer carries that split as conditional constraints, so it also holds
for producers that are not using a typed client:

- a `stream` plan is rejected if it carries `fallback`, `cache_ttl_seconds`,
  `stale_while_revalidate_seconds`, `dry_run`, `dedupe`, `throttle_millis` or
  `debounce_millis`;
- a `unary` plan is rejected if it carries `backpressure`,
  `stream_buffer_capacity`, `stream_idle_timeout_millis`, `sample_each_millis`,
  `throttle_each_millis` or `debounce_each_millis`.

Contradictory rate shaping is excluded pairwise, and `retry_backoff` requires a
`retry_count` so an inert schedule cannot be recorded.

Those cross-field rules live in the JSON Schema peer because TypeSpec cannot
express conditional constraints. The TypeSpec peer owns the field set, the
enums and the bounds. That asymmetry is intended; resolve any TJSV divergence
over it semantically rather than by weakening either peer.

## Credentials

A plan never carries one. `with_bearer_token` records
`auth_mode: "bearer_override"` and the header is redacted; the real credential
reaches only the wire. The schema is a closed shape and declares no credential
property, and `test/rpc-client-plan.test.mjs` asserts both.

## Instances

`instances/RpcRequestPlan/{valid,invalid}` is the reviewed corpus, discovered by
`polyglot-contract-admission` and handed to TJSV. Each invalid instance
demonstrates exactly one rule, named by its filename, so a regression reports
which guarantee broke rather than that "an instance failed".
