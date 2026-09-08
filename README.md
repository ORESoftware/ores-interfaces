# ores-interfaces

Shared interface entry point for ORESoftware repositories.

This repository duplicates shared contracts without extracting or removing them
from their originating repositories. The first snapshot contains the existing
public RequestMeta, PageQuery, and ProblemDetails contracts from
`ores-otel/ores-interfaces`, with both original TypeSpec and independently
maintained JSON Schema bytes preserved. The original schema identity is retained.
Do not register both copies of the same `$id` as competing resolver resources.

## Acceptance boundaries

`provenance/shared-public.json` binds the source repository, immutable commit,
source paths, Git blob hashes, and SHA-256 digests. `node --test test/*.test.mjs`
checks complete copied-file inventory, content, path safety, and tamper rejection.
With `UPSTREAM_ROOT` set, it also compares against the actual source checkout.
These checks prove copy integrity, not source correctness or semantic equivalence.

CI separately invokes pinned `ORESoftware/typespec-json-schema-validator` (TJSV)
on both copied authorities and the positive/negative corpus. Generated witnesses,
receipts, and Contract IR go outside the authored source directory and are retained
as CI artifacts. No source wins by fallback; unsupported comparisons or disagreement
must stop admission. The legacy TypeSpec alias and numeric emitter semantics must
be reconciled explicitly if TJSV reports them; no ignore mapping is pre-authorized.

This bootstrap is not a fleet-wide conformance certificate. No accepted receipt,
registry release, resolver-generated lock, or language-runtime parity is invented.
Existing consumers remain on their existing packages until those gates pass.

## Zed dependency graph

`.zpkg.toml` declares the original `ores-otel/ores-interfaces` as a transition
source dependency and exposes real repository/contract targets. `zed-env.toml`
provides the check task. No placeholder `.zpkg.lock` is committed.

After reviewed publication and genuine registry resolution, consumers in
Shared Auth, ORES middleware, rate limiting, telemetry, and other orgs can add
`oresoftware/ores-interfaces` through Zed and commit the resolver-produced lock.
CI then uses `zed install --frozen`; do not substitute a handwritten lock or
metadata-only declaration for an executed dependency installation.

## Ownership

TypeSpec and JSON Schema are independent human-maintained sources. Language
validators and validated construction APIs belong in the corresponding shared
`*-lib-core` / `*-pub-lib-core` libraries. `*-clients` consume them rather than
inventing another ruleset. Authentication, verified tenant identity, authorization,
database checks, and private business invariants remain server-side. Public
RequestMeta is not trusted actor context. Serde/JSON conversion alone is not a
semantic validation boundary; client checks never replace server revalidation.

Next acceptance work: actual Zod/Rust/Dart runtime fixtures; constructor and
Serde bypass rejection; missing/null/value PATCH semantics; Unicode units;
format-assertion policy; normalized error redaction; native/web Dart execution;
paired test-org consumers and genuine frozen Zed resolution. Scope and current
findings are tracked in DEN-3958, not marked complete by this bootstrap.

Parent engineering policy: https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md
