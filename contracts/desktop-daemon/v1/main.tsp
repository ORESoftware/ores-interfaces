/**
 * Desktop daemon public deployment/control evidence contract v1.
 *
 * Server-only adapter methods and process handles are intentionally excluded.
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities.
 */
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Desktop.Daemon.V1;

@pattern("^[0-9a-fA-F]{64}$")
scalar Sha256Hex extends string;

@pattern("^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$")
scalar GitObjectId extends string;

enum WorkerActivation {
  reuse,
  start_child,
  restart_child,
  beam_hot_load,
}

enum DevicePlatform {
  desktop,
  android,
  ios,
}

enum HostingRole {
  client_only,
  client_and_worker,
  client_and_server,
}

model ResolvedSourceEvidence {
  @minLength(1)
  source_id: string;

  @minLength(1)
  immutable_revision: string;

  content_sha256: Sha256Hex;
}

model WorkerDeployment {
  @minLength(1)
  service_id: string;

  @minLength(1)
  revision: string;

  content_sha256: Sha256Hex;
  activation: WorkerActivation;
}

model DocsArtifactPlan {
  api_docs_revision: GitObjectId;
  publication_mode: "consumer_owned";
  semantic_contract_sha256: Sha256Hex;
  route_catalog_sha256: Sha256Hex;

  @minLength(1)
  output_dir: string;
}

model DeploymentPlan {
  @minLength(1)
  deployment_id: string;

  @minLength(1)
  product_id: string;

  @minValue(1)
  generation: integer;

  @minItems(1)
  source_evidence: ResolvedSourceEvidence[];

  compose_sha256: Sha256Hex;
  route_catalog_sha256: Sha256Hex;
  workers: WorkerDeployment[];
  docs?: DocsArtifactPlan;
  full_appliance_restart_required: false;
}

model DeviceCapabilities {
  platform: DevicePlatform;
  hosting_role: HostingRole;
  supports_wasm: boolean;
  supports_native_workers: boolean;
  supports_persistent_service: boolean;
  supports_inbound_listener: boolean;
  background_execution_limited: boolean;
}
