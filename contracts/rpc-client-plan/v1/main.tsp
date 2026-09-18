namespace Ores.Rpc.ClientPlan.V1;

/// Which client surface produced a plan.
///
/// The unary and streaming clients are separate types in every generated
/// language: a unary chain terminates in `make_call`, a streaming chain in
/// `stream`, and neither carries the other's terminal. The discriminator makes
/// that split checkable on the wire as well as in the type system.
enum RpcSurface {
  unary,
  stream,
}

/// Wire serialization strategy. Selected at most once per chain.
enum RpcSerialStrategy {
  json,
  message_pack,
  protobuf,
}

/// Request-payload compression.
enum RpcCompression {
  identity,
  gzip,
  brotli,
  zstd,
}

/// Per-call credential handling.
///
/// `bearer_override` records only that a per-call credential was supplied. The
/// credential itself is never serialized into a plan; the header carries a
/// redaction placeholder instead.
enum RpcAuthMode {
  default: "default",
  omitted,
  bearer_override,
}

/// Behaviour when a stream consumer falls behind its producer.
enum RpcBackpressure {
  buffer,
  drop_oldest,
  drop_newest,
  error,
}

/// Address-family pin for one request.
enum RpcIpVersion {
  v4,
  v6,
}

/// Carrier the envelope travels on. HTTP is the fleet default; the others are
/// used by the streaming surface and by in-process test harnesses.
enum RpcTransport {
  http,
  tcp,
  websocket,
  nats,
}

/// Exponential backoff schedule applied between retries.
model RpcRetryBackoff {
  @minValue(1)
  @maxValue(60000)
  base_millis: int32;

  @minValue(1.0)
  @maxValue(10.0)
  factor: float64;
}

/// Canonical, transport-free serialization of a fully built RPC client chain.
///
/// A plan is the cross-language conformance unit: the same chain in Rust,
/// TypeScript, Dart, Go and Gleam must serialize to a byte-identical plan.
/// Options are grouped so that contradictory selections are unrepresentable in
/// a typed client; the plan is the untyped backstop for producers that are not.
model RpcRequestPlan {
  plan_version: "1.0.0";
  kind: RpcSurface;

  /// Canonical dotted rpc_key, identical to rpc-operation/v1's operation_key
  /// grammar. A plan names an operation, so the two contracts must agree on
  /// what an operation may be called.
  @minLength(3)
  @pattern("^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)+$")
  key: string;

  /// Absolute path carrying the envelope. `/v1/rpc` fleet-wide.
  rpc_path: string;

  transport?: RpcTransport;

  serial_strategy: RpcSerialStrategy;
  compression?: RpcCompression;

  /// Redaction is applied at the plan boundary, not per option: any header
  /// whose name matches the client redaction lists is replaced with the
  /// placeholder before serialization, whatever wrote it.
  headers?: Record<unknown>;
  path?: Record<unknown>;
  query?: Record<unknown>;
  body?: unknown;

  @minValue(1)
  @maxValue(600000)
  timeout_millis?: int32;

  /// Bounded by Number.MAX_SAFE_INTEGER: the plan is JSON and must round-trip
  /// exactly in runtimes with double-precision numbers, or plans stop comparing
  /// equal across languages.
  @minValue(0)
  @maxValue(9007199254740991)
  deadline_unix_millis?: int64;

  @minValue(0)
  @maxValue(16)
  retry_count?: int32;

  retry_backoff?: RpcRetryBackoff;

  /// Registered retry observers, recorded as a count: callbacks are not data.
  @minValue(0)
  retry_hook_count?: int32;

  auth_mode?: RpcAuthMode;

  skip_local_cache?: boolean;
  require_fresh?: boolean;
  skip_edge_cache?: boolean;

  /// W3C trace-context trace-id: 32 lowercase hex digits. Dynamic
  /// per-invocation context, distinct from the static ores_trace_id source
  /// identity carried by the RPC error-log contract.
  @pattern("^[0-9a-f]{32}$")
  trace_id?: string;

  /// W3C trace-context parent span-id: 16 lowercase hex digits.
  @pattern("^[0-9a-f]{16}$")
  span_id?: string;

  debug?: boolean;

  new_agent?: boolean;
  /// Userinfo is stripped and replaced with the redaction placeholder before
  /// serialization, so `user:password@host` cannot appear.
  @pattern("^[a-zA-Z][a-zA-Z0-9+.-]*://(?:\\[redacted\\]@)?[^@/?#]*(?:[/?#].*)?$")
  proxy_url?: string;
  ip_version?: RpcIpVersion;
  keep_alive?: boolean;
  skip_tls_verify?: boolean;

  @minValue(0)
  @maxValue(4)
  queue_priority?: int32;

  @minLength(1)
  @maxLength(128)
  concurrency_key?: string;

  drop_if_busy?: boolean;

  @minValue(0)
  @maxValue(60000)
  delay_millis?: int32;

  @minValue(1)
  @maxValue(60000)
  jitter_millis?: int32;

  @minValue(0)
  upload_progress_hook_count?: int32;

  @minValue(0)
  download_progress_hook_count?: int32;

  // Unary-only shaping. A streaming plan must not carry these.
  fallback?: unknown;

  @minValue(0)
  @maxValue(86400)
  cache_ttl_seconds?: int32;

  @minValue(1)
  @maxValue(86400)
  stale_while_revalidate_seconds?: int32;

  dry_run?: boolean;
  dedupe?: boolean;

  @minValue(1)
  @maxValue(60000)
  throttle_millis?: int32;

  @minValue(1)
  @maxValue(60000)
  debounce_millis?: int32;

  // Stream-only shaping. A unary plan must not carry these.
  backpressure?: RpcBackpressure;

  @minValue(1)
  @maxValue(65536)
  stream_buffer_capacity?: int32;

  @minValue(1)
  @maxValue(3600000)
  stream_idle_timeout_millis?: int32;

  @minValue(1)
  @maxValue(60000)
  sample_each_millis?: int32;

  @minValue(1)
  @maxValue(60000)
  throttle_each_millis?: int32;

  @minValue(1)
  @maxValue(60000)
  debounce_each_millis?: int32;
}
