import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.RpcPayload;

enum PayloadCodec {
  json,
  messagepack,
  cbor,
  protobuf,
  raw,
}

enum TransportFraming {
  http_body,
  tcp_length_delimited,
  websocket_message,
}

model RpcPayloadPolicyV1 {
  schema: "ores.rpc-payload-policy/v1";
  default_codec: PayloadCodec;
  allowed_codecs: PayloadCodec[];
  framing: TransportFraming;
  @minValue(1)
  @maxValue(16777216)
  max_encoded_bytes: uint32;
  @minValue(1)
  @maxValue(67108864)
  max_decoded_bytes: uint32;
}
