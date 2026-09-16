# Generated interface distribution contract

`ORESoftware/ores-interfaces` is the distribution boundary for admitted shared contracts. Editable contract authority remains in independently authored TypeSpec and JSON Schema/OpenAPI sources; this repository packages only admitted, read-only projections and provenance.

The build now emits `generated/public/interface-release.json`. Its `releaseId` is SHA-256 over the deterministic release body, which includes immutable source and validator commits, the complete admitted declaration inventory, the TJSV admission run identifier, and SHA-256 digests for every exported artifact. Consumers can therefore bind to an exact semantic package independently of mutable tags.

Rules:

1. No file under `generated/public` is hand-authored. The owned-output builder replaces the directory atomically and rejects unexpected files, symlinks, partial builds, and concurrent writers.
2. `main.tsp` and `schema.json` remain independent admitted source snapshots; generated comparison artifacts never become editable authority.
3. Generated Rust, Rust/WASM, Dart/Flutter, TypeScript, Go, Python, Protobuf/gRPC, and other SDK projections must bind to one `releaseId` and record their own artifact digest in the same release lineage before publication.
4. Semver tags are distribution labels, not the cryptographic identity. Audit/change-management evidence should record repository commit plus `releaseId` plus the source/validator pins.
5. A consumer must fail closed if its expected release ID or artifact digest does not match the materialized package.

This lets opto-sync and other generators publish cross-language projections without turning generated code into a second source of truth.
