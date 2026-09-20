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

Those cross-field rules are authored in **both** peers: as `allOf` in the JSON
Schema, and as `@extension("allOf", ...)` on the TypeSpec model. An earlier
version of this page said they lived only in the JSON Schema "because TypeSpec
cannot express conditional constraints", and called the asymmetry intended. It
was not harmless: five reviewed negative instances were rejected by one
authority and accepted by the other.

Nothing reported that, because nothing was comparing. While the plan was the
schema *root*, TJSV had no named declaration to match against
`Ores.Rpc.ClientPlan.V1.RpcRequestPlan` and ran **zero probes**. Every
declaration is now a named peer under `$defs` (the root is a `$ref` to
`RpcRequestPlan`), including the open records — `RpcHeaders`, `RpcQuery`,
`RpcPathFields` — which are declarations rather than inline `Record<unknown>`
for the same reason. Resolve any future divergence semantically rather than by
weakening either peer.

## Credentials

A plan never carries one. `with_bearer_token` records
`auth_mode: "bearer_override"` and the header is redacted; the real credential
reaches only the wire. The schema is a closed shape and declares no credential
property, and `test/rpc-client-plan.test.mjs` asserts both.

Redaction is a property of the plan boundary, not of an option, and it covers
every place a caller can put a credential:

- **headers** — judged by name, whatever wrote them;
- **query fields** — the same. `RpcQuery` holds the canonical lowercase
  spellings of the shared redaction list (`access_token`, `api-key`, `sig`,
  `token`, ...) to the placeholder. Clients match case-insensitively; a JSON
  Schema pattern cannot, so other casings are the client conformance suite's to
  prove;
- **`proxy_url`** — userinfo is replaced with the bare word `redacted`. Not
  `[redacted]`: square brackets are not valid RFC 3986 userinfo, so that
  spelling failed the `uri` format this field also asserts. Both peers assert
  the format (`url` in TypeSpec) and the pattern.

The all-zero W3C `trace_id` and `span_id` are excluded by both peers, as
`not: { const }` and `@extension("not", ...)`. A single pattern with a negative
lookahead would say the same thing in one keyword, but lookahead is not
available in every regex engine a consumer may validate with (RE2, Rust's
`regex`), and a contract that only some runtimes can evaluate is not shared.

## Instances

`instances/RpcRequestPlan/{valid,invalid}` is the reviewed corpus, discovered by
`polyglot-contract-admission` and handed to TJSV. Each invalid instance
demonstrates exactly one rule, named by its filename, so a regression reports
which guarantee broke rather than that "an instance failed".

That is checked, not asserted. For every `invalid/<name>.json` there is a
`valid/repaired-<name>.json`, and `negative-repairs.json` names the single
top-level field in which the two differ. TJSV proves both verdicts on both
authorities; `test/rpc-client-plan.test.mjs` proves the difference is confined
to that field. A negative that is rejected for some reason other than the one
in its name would have a twin that is rejected too. The all-zero ids are
repaired to their nearest valid neighbours (`0…01`).
