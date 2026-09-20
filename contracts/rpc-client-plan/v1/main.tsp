import "@typespec/json-schema";
using TypeSpec.JsonSchema;

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

/// Normalized request headers: lowercase RFC 9110 field names.
///
/// A named declaration rather than an inline `Record<unknown>` so both peers
/// declare it and TJSV compares it. Credential-bearing names are constrained to
/// the placeholder here as well as in the client: the contract must make the
/// "plans never carry credentials" guarantee machine-checkable, not descriptive.
@extension("propertyNames", #{ type: "string", maxLength: 128, pattern: "^[!#$%&'*+.^_\`|~0-9a-z-]+$" })
@extension(
  "patternProperties",
  #{
    `^(?:(?:authentication|authorization|cookie|proxy[-_]authorization|set[-_]cookie|www[-_]authenticate|x[-_]amz[-_]security[-_]token|x[-_]auth[-_]token|x[-_]csrf[-_]token|x[-_]session[-_]token|x[-_]xsrf[-_]token)|.*(?:access[-_]token|api[-_]?key|auth[-_]token|credential|id[-_]token|password|private[-_]key|refresh[-_]token|secret|session[-_]id|signature).*)$`: #{ `const`: "[redacted]" },
  }
)
model RpcHeaders is Record<unknown>;

/// Path-template fields, by placeholder name.
model RpcPathFields is Record<unknown>;

/// Request query fields, redacted at the plan boundary exactly as the client.
///
/// The client normalizes `_` to `-`, lowercases names and then redacts either
/// exact sensitive names or any name containing a shared sensitive-name
/// pattern. This peer therefore constrains canonical lowercase spellings such
/// as `access_token`, `x_refresh_token`, `tenant-api-key`, `client_secret` and
/// `signature_version`. Casing variants remain a client-conformance concern.
@extension(
  "patternProperties",
  #{
    `^(?:.*(?:access[-_]token|api[-_]?key|auth[-_]token|credential|id[-_]token|password|private[-_]key|refresh[-_]token|secret|session[-_]id|signature).*|auth|sig|token)$`: #{ `const`: "[redacted]" },
  }
)
model RpcQuery is Record<unknown>;

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
/// A plan is the cross-language conformance unit: the same chain built in Rust,
/// TypeScript, Dart, Go and Gleam must serialize to a byte-identical plan.
/// Options are grouped so that contradictory selections are unrepresentable in
/// a typed client; the plan is the untyped backstop for producers that are not.
///
/// The cross-field rules below are authored HERE as well as in the JSON Schema
/// peer. They used to live only there, and the two peers were never compared:
/// the authored schema had no named declarations, so TJSV matched nothing and
/// reported zero probes. Five reviewed negative instances were rejected by one
/// authority and accepted by the other without anything noticing.
@extension("dependentRequired", #{ span_id: #["trace_id"] })
@extension(
  "allOf",
  #[
    // A streaming plan rejects unary-only shaping.
    #{
      `if`: #{ properties: #{ kind: #{ `const`: "stream" } }, required: #["kind"] },
      then: #{
        not: #{
          anyOf: #[
            #{ required: #["fallback"] },
            #{ required: #["cache_ttl_seconds"] },
            #{ required: #["stale_while_revalidate_seconds"] },
            #{ required: #["dry_run"] },
            #{ required: #["dedupe"] },
            #{ required: #["throttle_millis"] },
            #{ required: #["debounce_millis"] }
          ],
        },
      },
    },
    // A unary plan rejects stream-only shaping.
    #{
      `if`: #{ properties: #{ kind: #{ `const`: "unary" } }, required: #["kind"] },
      then: #{
        not: #{
          anyOf: #[
            #{ required: #["backpressure"] },
            #{ required: #["stream_buffer_capacity"] },
            #{ required: #["stream_idle_timeout_millis"] },
            #{ required: #["sample_each_millis"] },
            #{ required: #["throttle_each_millis"] },
            #{ required: #["debounce_each_millis"] }
          ],
        },
      },
    },
    // Unary outbound rate shaping is mutually exclusive.
    #{ not: #{ required: #["throttle_millis", "debounce_millis"] } },
    // Stream inbound rate shaping is mutually exclusive.
    #{
      allOf: #[
        #{ not: #{ required: #["sample_each_millis", "throttle_each_millis"] } },
        #{ not: #{ required: #["sample_each_millis", "debounce_each_millis"] } },
        #{ not: #{ required: #["throttle_each_millis", "debounce_each_millis"] } }
      ],
    },
    // A retry backoff schedule requires a retry budget.
    #{ `if`: #{ required: #["retry_backoff"] }, then: #{ required: #["retry_count"] } }
  ]
)
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
  @pattern("^/.*")
  rpc_path: string;

  transport?: RpcTransport;

  serial_strategy: RpcSerialStrategy;
  compression?: RpcCompression;

  /// Redaction is applied at the plan boundary, not per option: any header
  /// whose name matches the client redaction lists is replaced with the
  /// placeholder before serialization, whatever wrote it.
  headers?: RpcHeaders;
  path?: RpcPathFields;

  /// Redacted at the plan boundary exactly as the client: canonical lowercase
  /// exact names and sensitive-name substrings carry the placeholder. Clients
  /// normalize `_` to `-` and match case-insensitively before serializing.
  query?: RpcQuery;
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
  @extension("not", #{ `const`: "00000000000000000000000000000000" })
  trace_id?: string;

  /// W3C trace-context parent span-id: 16 lowercase hex digits. A span is only
  /// meaningful inside a trace, so the model-level dependency above requires
  /// trace_id whenever span_id is present.
  @pattern("^[0-9a-f]{16}$")
  @extension("not", #{ `const`: "0000000000000000" })
  span_id?: string;

  debug?: boolean;

  new_agent?: boolean;
  /// Userinfo is replaced before serialization with the literal `redacted`, so
  /// `user:password@host` cannot appear. Not `[redacted]`: square brackets are
  /// not valid RFC 3986 userinfo, so that spelling made every redacted proxy
  /// URL fail the `uri` format this field also asserts.
  @pattern("^[a-zA-Z][a-zA-Z0-9+.-]*://(?:redacted@)?[^@/?#]*(?:[/?#].*)?$")
  proxy_url?: url;
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
