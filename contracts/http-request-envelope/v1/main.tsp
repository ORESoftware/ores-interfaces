/**
 * Shared HTTP/RPC request-envelope value contract.
 *
 * This TypeSpec source and authored.schema.json are independent peer
 * authorities. Neither may be generated from the other to force parity.
 */
import "@typespec/json-schema";

namespace Ores.Interfaces.HttpRequestEnvelope.V1;

/** Canonical lowercase HTTP header names mapped to unfolded string values. */
model HeaderMap {
  [key: string]: string;
}

/**
 * JSON-object payload map. `unknown` is intentionally the JSON value slot:
 * generated/runtime language bindings narrow it to their native JSON value
 * union while preserving string keys.
 */
model JsonObjectMap {
  [key: string]: unknown;
}

/** Query values preserve repeated keys without framework-specific classes. */
model QueryMap {
  [key: string]: string[];
}

/** Supported decoded application representations. */
enum DecodedRepresentation {
  json: "application/json",
  problem_json: "application/problem+json",
  xml: "application/xml",
  message_pack: "application/msgpack",
  protobuf: "application/protobuf",
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model RequestAttributes {
  request_id: string;
  trace_id: string;
  span_id?: string;
  tenant_id?: string;
  user_id?: string;
  locale?: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model HttpRequestEnvelope {
  /** Canonical lowercase header-name map. */
  headers: HeaderMap;

  /** Parsed query values; repeated keys stay repeated. */
  query: QueryMap;

  /** Present only when the selected decoded root is a JSON object. */
  json_payload?: JsonObjectMap;

  /** Media type selected by content-type dispatch after normalization. */
  representation?: DecodedRepresentation;

  /**
   * Bounded raw-body byte count after permitted inbound transforms.
   * Four GiB is already above the supported per-request operating envelope and
   * keeps the JSON representation exact across JavaScript runtimes.
   */
  raw_body_bytes: uint32;

  /** Request-scoped identity/correlation metadata. */
  attributes: RequestAttributes;
}
