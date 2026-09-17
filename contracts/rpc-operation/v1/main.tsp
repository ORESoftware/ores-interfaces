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

  namespace: string[];
  source: RpcSource;
  rpc_transport_path: "/v1/rpc";
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
