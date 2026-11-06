# AttoLang shared interface target admission

Run `node scripts/attolang-target-admission.mjs` to emit a deterministic,
read-only **target** descriptor from the existing public source-package
provenance. This checks that separately authored TypeSpec and JSON Schema
digest identities, the pinned validator revision, the contract IR ID, the
parity run ID and the conformance corpus remain bound together.

The descriptor is NOT AttoLang source code and explicitly declares
`backendExecution: NOT_EXECUTED`; `.atto` is canonical, `.ores` is legacy.
It cannot be used as proof that any Java/GraalVM, LLVM, Wasm, Forge or .NET
AttoLang backend compiled and ran this interface.

The current source/validator authorities are not changed. Future AttoLang
client implementations must produce independent exact-head compiler and
runtime evidence (including invalid-input negatives), not merely pass this
deterministic provenance verifier. `npm test` runs mutation tests preventing
generated-witness authority promotion, missing authored-schema digests,
stale validator/source revisions and forged declaration admission.
