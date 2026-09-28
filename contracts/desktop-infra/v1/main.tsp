/**
 * Desktop local-infrastructure desired-state contract v1.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Generated schemas are comparison evidence only.
 */
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Desktop.Infra.V1;

enum RouteAuthority {
  erlang,
  rust,
}

enum LoopbackHost {
  ipv4: "127.0.0.1",
  ipv6: "::1",
}

model RouteTarget {
  host: LoopbackHost;

  @minValue(1)
  @maxValue(65535)
  port: int32;
}

model RouteSpec {
  @minLength(1)
  route_id: string;

  @minLength(1)
  host: string;

  @pattern("^/")
  path_prefix: string;

  target: RouteTarget;
  public: boolean;
}

model ServiceSpec {
  @minLength(1)
  service_id: string;

  @minLength(1)
  revision: string;

  @pattern("^[0-9a-fA-F]{64}$")
  digest: string;

  @minLength(1)
  command_id: string;

  health_endpoint?: RouteTarget;
  hot_reloadable: boolean;
}

model Labels is Record<string>;

model DesiredState {
  @minLength(1)
  product_id: string;

  @minValue(1)
  generation: integer;

  route_authority: RouteAuthority;
  routes: RouteSpec[];
  services: ServiceSpec[];
  labels: Labels;
}
