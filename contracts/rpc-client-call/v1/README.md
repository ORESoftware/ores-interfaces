# RPC client call contract v1

This family is the fleet-generic semantic contract between generated RPC clients and reusable client runtimes.

It intentionally models values and invariants, not a single object-oriented implementation. TypeScript and Dart may realize the capability through base classes; Rust may use traits and typed builders; Gleam may use opaque records and pipeline-friendly functions.

A generated operation starts with an `RpcOperationDescriptor`, accumulates immutable `RpcCallOptions`, and reaches the network only through a terminal action:

- unary: `makeCall()` / `make_call()` language-idiomatic alias
- server stream: `doStream()` / `do_stream()` language-idiomatic alias or pipeline equivalent

`doStream` is deliberately the streaming analog of `makeCall`: configuration methods remain non-terminal and perform no network I/O, while the explicit terminal opens the server stream.

Headers are canonical lowercase names. `timeout_ms` and codec selection are portable call options. Runtime-only cancellation handles/signals are deliberately not serialized into this contract.

The authored TypeSpec and Draft 2020-12 JSON Schema are independent peer authorities and must remain semantically convergent through TJSV.
