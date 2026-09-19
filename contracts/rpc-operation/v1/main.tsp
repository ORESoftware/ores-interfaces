import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Rpc.Operation.V1;

enum HttpMethod {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
  HEAD,
  OPTIONS,
}

enum RpcAudience {
  browser,
  server,
}

enum RpcScope {
  regular,
  admin,
}

enum RpcPayloadCodec {
  json,
  protobuf,
  messagepack,
}

enum RpcStreamMode {
  unary,
  server_stream,
  client_stream,
  bidi,
}

model RpcSource {
  handlers_file: string;
  operation: string;
  route_file?: string;
  route_handler?: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
  repository?: string;
  commit_sha?: string;
}

model RpcHttpProjection {
  method: HttpMethod;
  path: string;
}

model RpcCodecSet {
  allowed: RpcPayloadCodec[];
  `default`: RpcPayloadCodec;
}

model RpcRequestShape {
  path_schema?: unknown;
  query_schema?: unknown;
  header_schema?: unknown;
  body_schema?: unknown;
}

model RpcResponseShape {
  header_schema?: unknown;
  trailer_schema?: unknown;
  body_schema?: unknown;
  error_schema?: unknown;
}

model RpcOperation {
  schema_version: 1;

  @minLength(3)
  @maxLength(200)
  operation_key: string;

  `namespace`: string[];
  source: RpcSource;
  rpc_transport_path: "/v1/rpc";
  stream?: RpcStreamMode;
  http?: RpcHttpProjection;
  scope: RpcScope;
  audiences: RpcAudience[];
  codecs: RpcCodecSet;
  request: RpcRequestShape;
  response: RpcResponseShape;

  @minLength(64)
  @maxLength(64)
  contract_sha256: string;
}

/**
 * Call-site trace identifier attached through the ores.otel.log seam
 * (`addTraceId`/`addTrace`, `add_trace_id`/`add_trace`, `AddTraceID`/`AddTrace`).
 * Always an inline literal fixed at generation time, never a variable assembled at
 * runtime: `ores-trace-` + 21-character nanoid.
 * Mirrors ores-otel/ores.otel.log `contracts/ores-ids` (PR #81).
 */
@pattern("^ores-trace-[A-Za-z0-9_-]{21}$")
scalar OresTraceId extends string;

/**
 * Routine identifier attached through `addRoutineId` (and language equivalents).
 * Declared once at the top of the generated dispatch function and reused by every
 * emit in that function: `ores-routine-` + 21-character nanoid.
 * Mirrors ores-otel/ores.otel.log `contracts/ores-ids` (PR #81).
 */
@pattern("^ores-routine-[A-Za-z0-9_-]{21}$")
scalar OresRoutineId extends string;

/**
 * Carrier that delivered the failed invocation. `rpc` is the POST /v1/rpc
 * transport, `http` an optional REST projection, `in_process` a direct call that
 * bypassed the wire.
 */
enum RpcErrorTransport {
  rpc,
  http,
  in_process,
}

/** What the guarded dispatch did, never why. */
enum RpcDispatchOutcome {
  error,
  panic,
  timeout,
  cancelled,
}

/** Coarse, language-neutral classification of the trapped failure. */
enum RpcErrorKind {
  transport,
  codec,
  validation,
  authorization,
  not_found,
  conflict,
  rate_limited,
  unavailable,
  timeout,
  cancelled,
  panic,
  internal,
}

/**
 * The single telemetry event a guarded RPC dispatch emits before re-raising.
 *
 * Deliberately payload-free: it carries operation identity, carrier, outcome,
 * error classification and the static correlation ids, and nothing else. There is
 * no field for a request or response body, for path or query values, for headers,
 * for `meta`, or for any user data, and the model is closed so a generator that
 * tries to add one fails admission instead of leaking.
 */
/// The seam that emitted an RPC error-log event.
enum RpcLayer {
  handler,
  dispatch,
  transport,
  client,
}

model RpcErrorLogEvent {
  schema_version: 1;

  @minLength(3)
  @maxLength(200)
  @pattern("^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)+$")
  operation_key: string;

  transport: RpcErrorTransport;
  outcome: RpcDispatchOutcome;
  error_kind: RpcErrorKind;

  /** Stable, generator-assigned code. Never an exception message or stack. */
  @minLength(3)
  @maxLength(128)
  @pattern("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$")
  error_code: string;

  /// Static call-site identity emitted as an inline literal by the generator.
  /// Distinct from trace_id, which identifies the invocation, not the site.
  ores_trace_id: OresTraceId;

  /// Static routine identity for the call site, when the generator assigns one.
  ores_routine_id?: OresRoutineId;

  /// W3C trace-context trace-id for the invocation: 32 lowercase hex digits.
  /// Optional, because an error can be logged outside any propagated trace.
  /// The all-zero id is invalid per the W3C spec. Both peers exclude it; this
  /// one used to constrain only the shape, so the two accepted different
  /// documents.
  @pattern("^[0-9a-f]{32}$")
  @extension("not", #{ `const`: "00000000000000000000000000000000" })
  trace_id?: string;

  /// W3C trace-context span-id for the invocation: 16 lowercase hex digits.
  @pattern("^[0-9a-f]{16}$")
  @extension("not", #{ `const`: "0000000000000000" })
  span_id?: string;

  /// Which seam emitted this event: a classification, not a correlation key.
  /// One error legitimately produces more than one log line as it crosses
  /// seams, and this says which of those a line is. It does NOT say that two
  /// lines describe the same failure. That takes the W3C trace_id and span_id;
  /// where they are absent, two independent failures at one call site and one
  /// layer are indistinguishable in this contract, and a consumer must not
  /// deduplicate on (ores_trace_id, rpc_layer) alone.
  rpc_layer: RpcLayer;

  /**
   * Records that the trapped error was re-raised (returned, rethrown,
   * `resume_unwind`-ed, re-panicked) rather than swallowed. Named `re_raised` to
   * match this contract's snake_case wire convention.
   */
  re_raised: boolean;

  /**
   * Explicit, machine-checkable declaration that no payload data travels with the
   * event. Always `true`; combined with the closed model it is the positive
   * statement of the negative rule.
   */
  payload_omitted: true;
}
