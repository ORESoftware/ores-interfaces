/**
 * Shared HTTP application-header admission contract.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Per-service manifests are projections of route contracts,
 * not a third editable authority.
 *
 * Raw transport headers are owned by HTTP/auth/tracing/proxy middleware. The
 * application view passed to RPC/business handlers contains only headers that
 * the operation explicitly declares; unknown application headers are stripped.
 */
import "@typespec/json-schema";

namespace Ores.Http.HeaderPolicy;

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model HeaderDeclaration {
  @minLength(1)
  @maxLength(128)
  @pattern("^(?!(?:accept|authorization|proxy-authorization|cookie|set-cookie|host|content-length|content-type|transfer-encoding|connection|keep-alive|te|trailer|upgrade|forwarded|traceparent|tracestate|baggage)$)(?!x-forwarded-)(?!grpc-)[!#$%&'*+.^_`|~0-9a-z-]+$")
  name: string;

  value_kind: "string" | "boolean" | "integer" | "number" | "date-time" | "string-list";
  required: boolean;
  repeated: boolean;

  @minLength(1)
  @maxLength(512)
  description: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model OperationHeaderPolicy {
  @minLength(1)
  @maxLength(128)
  @pattern("^[A-Za-z][A-Za-z0-9_]*$")
  operation_key: string;

  @maxItems(64)
  accepted_headers: HeaderDeclaration[];

  unknown_application_headers: "strip";
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model ServiceHeaderPolicy {
  schema_version: "ores.http-header-policy.v1";

  @minLength(1)
  @maxLength(128)
  @pattern("^[a-z0-9][a-z0-9._-]*$")
  service: string;

  routing_identity: "method-and-path";
  application_header_view: "declared-only";
  runtime_owned_headers: "preserve-before-application-projection";

  @maxItems(1024)
  operations: OperationHeaderPolicy[];
}
