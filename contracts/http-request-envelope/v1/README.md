# HTTP request envelope v1

This contract owns the data-only request map shared by ORES HTTP/RPC middleware and server implementations. `ORESoftware/ores-middleware` owns lifecycle/orchestration; this directory owns the portable value shape.

## Wire rules

- Shared contract field names use `snake_case`.
- HTTP header names are matched case-insensitively on input and emitted/stored canonically in lowercase. ORES extension headers use the reserved lowercase `x-ores-*` namespace.
- `headers` is a string-key/string-value map after the framework has unfolded/normalized the values it is willing to expose.
- `query` preserves repeated values as string arrays.
- `json_payload` is present only when the decoded JSON root is an object. Array/scalar JSON roots stay in representation-specific runtime data rather than being coerced into a map.
- `raw_body_bytes` is the size of the bounded body at the canonical post-transform request boundary selected by middleware policy.
- `attributes` carries request-scoped correlation and verified identity IDs only; credentials, tokens, cookie bodies, encryption keys, and raw authorization headers must not be copied into it.

## Representations

The v1 envelope identifies the normalized representation selected by middleware:

- `application/json`
- `application/problem+json`
- `application/xml`
- `application/msgpack`
- `application/protobuf`

Representation-specific decoded values are runtime types because XML, MessagePack, and Protobuf have richer type systems than JSON objects. Protobuf requires a route/message descriptor; implementations must not pretend an arbitrary Protobuf message is schema-free.

## Authority

`main.tsp` and `authored.schema.json` are independently maintained peer authorities. They must be checked with `ORESoftware/typespec-json-schema-validator`; one must not be regenerated from the other merely to make the diff disappear.
