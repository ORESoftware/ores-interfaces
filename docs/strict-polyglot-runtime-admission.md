# Strict polyglot runtime admission (TJSV)

`polyglot-contract-admission.yml` is the reusable peer-authority gate. Each
`contracts/**/contracts.config.json` identifies independently authored TypeSpec
and Draft 2020-12 JSON Schema sources. Both are required; neither is generated
from the other as an authority. The generated JSON Schema, Contract IR, and
TJSV report are comparison evidence only.

## One language does not imply one implementation

When `language_manifest` is passed, the workflow **does not** accept a list of
language names as conformance. It requires the exact
`ores.typespec-json-schema-validator.language-boundaries/v1` envelope and
**one independent TypeSpec/JSON Schema pair per invocation**. Its manifest must
list every implementation/runtime expected for the selected contract; every
listed target is required and must validate **both ingress and egress**. At
least two distinct languages are required, or more via `minimum_languages`.
Split multiple contract pairs into independent calling jobs rather than claiming
one runtime receipt verified unrelated schemas.

## Runtime evidence protocol

The *calling* workflow compiles and tests native implementations independently
and uploads an Actions artifact named `polyglot-runtime-evidence` **in the same
workflow run**. The reusable workflow downloads it before admission. Artifact
contents are JSON receipts relative to that artifact root, at each manifest
`targets[].evidence` path. Never commit generated green receipts, and never
use source comments as receipts.

Each native-language receipt must conform to TJSV's published
`language-boundary-evidence/v1` schema. It must bind the exact candidate head
SHA, language/runtime, immutable artifact digest, generator/toolchain identity,
TJSV parity `runId`, Contract IR `irId`, and explicit passed ingress/egress
validation. If a target lacks a receipt, reports failure, names a different SHA,
or reuses another runtime's evidence path, promotion stops. The canonical
`verifyLanguageBoundariesAgainstCurrentInputs` verifier recomputes IR freshness
from the checked-out TypeSpec, generated schema witness, and authored JSON
Schema. It returns a digest-bound verification decision, not an assumed pass.

The caller must generate native receipts **after** compiling and running
positive and negative cases. The reusable workflow checks the receipt envelope,
revision and cross-language binding; it does not execute or replace language
compilers by itself. Producers are responsible for attaching test-run evidence
and authentic artifact provenance. In particular, a green receipt cannot be
inferred from mere language presence or generated source files.

### Calling pattern

```yaml
jobs:
  native-contract-tests:
    # Your per-language matrix actually executes tests and uploads all
    # runtime receipts as polyglot-runtime-evidence in this run.
    runs-on: ubuntu-latest
    steps:
      # checkout; build; compile; test; emit receipts; upload artifact
      - run: echo 'Supply the real runtime test and receipt generation here'

  peer-and-runtime-admission:
    needs: native-contract-tests
    uses: ORESoftware/ores-interfaces/.github/workflows/polyglot-contract-admission.yml@<pinned-commit>
    with:
      minimum_pairs: 1
      language_manifest: conformance/languages.json
      minimum_languages: 2
```

The illustrative native job above is **not** executable validation; production
callers must replace it with actual compile/test/probe steps and immutable
artifact receipts. The gate fails if the artifact is missing.

## Escape hatches are not parity exemptions

Inline `@ores-contract-deviation` comments (or native equivalents) may be
review hints for a difficult implementation detail, but are **never** consumed
as a conformance bypass. Any future escape mechanism needs a separate,
versioned, human-reviewed declaration identifying language, implementation,
operation, rationale, expiry, and positive/negative evidence. Wire format,
operation identity, authentication/authorization, data visibility, and observable
error semantics must remain 100% conformant. Until there is an explicitly
admitted policy and executable conformance proof, a mismatch is a release block.

`minimum_pairs=0` is useful for inventory discovery but must not be treated
as a passing peer-contract certification. The strict runtime admission path
requires exactly one discovered peer pair and a passing IR/report for it.
