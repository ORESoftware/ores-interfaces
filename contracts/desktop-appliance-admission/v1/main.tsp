/**
 * Portable desktop-appliance admission projection v1.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. The projection carries only fleet-shared admission facts;
 * runtime reconciliation and product-specific policy remain outside this wire
 * contract.
 */
import "@typespec/json-schema";

namespace Ores.Desktop.ApplianceAdmission.V1;

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model CommonLayerAdmission {
  repository: "ORESoftware/ores-common-desktop-infra";
  checkout_dir: "tmp/dev/ores-common-desktop-infra";
  status: "pinned";

  @pattern("^[0-9a-f]{40}$")
  revision: string;

  @minItems(1)
  @maxItems(128)
  capabilities: string[];
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model OrchestratorAdmission {
  engine: "ores-compose";
  config: ".ores-compose.yaml";
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model HostAdmission {
  daemon_host: "127.0.0.1";

  @minValue(1)
  @maxValue(65535)
  daemon_port: int32;

  requires_public_ip: false;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model CloudflareAdmission {
  mode: "not-required" | "gated" | "remotely-managed";
  credentials_in_repo: false;
  origin_auth: "outbound-agent-only" | "dedicated-remote-auth-required" | "dedicated-remote-auth";
  token_source?: "file";

  @pattern("^[A-Z][A-Z0-9_]*$")
  token_file_env?: string;

  @pattern("^[A-Z][A-Z0-9_]*$")
  hostname_env?: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model UpdateAdmission {
  mode: "exact-revision";
  allow_mutable_latest: false;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model PromotionGates {
  common_layer_pinned: true;
  common_layer_ci_verified: boolean;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model DesktopApplianceAdmission {
  schema: "ores.desktop-appliance-admission/v1";

  @minLength(1)
  @maxLength(128)
  product: string;

  @minLength(1)
  @maxLength(64)
  channel: string;

  common_layer: CommonLayerAdmission;
  orchestrator: OrchestratorAdmission;
  host: HostAdmission;
  cloudflare: CloudflareAdmission;
  update: UpdateAdmission;
  promotion_gates: PromotionGates;
}
