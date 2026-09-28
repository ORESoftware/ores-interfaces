/**
 * Desktop FaaS runtime/security fleet contract v1.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Cross-entry invariants such as unique daemon ports,
 * exact product inventory membership, org binding, and runtime-specific reuse
 * semantics are admission rules layered on top of this wire shape.
 */
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Desktop.Runtime.V1;

enum ProductId {
  iso_lattes: "iso-lattes",
  pony_expres: "pony-expres",
  lunatic_lorry: "lunatic-lorry",
  graal_show: "graal-show",
  scintilla: "scintilla",
  wasm_xprs: "wasm-xprs",
  indiebuild: "indiebuild",
  beamscale: "beamscale",
}

enum ReuseModel {
  tenant_generation_cell: "tenant_generation_cell",
  fresh_process: "fresh_process",
  fresh_actor: "fresh_actor",
  fresh_store: "fresh_store",
  runtime_managed: "runtime_managed",
  delegated: "delegated",
}

@minValue(1)
@maxValue(65535)
scalar DaemonPort extends integer;

@minValue(1)
@maxValue(16777216)
scalar ClientResponseByteLimit extends integer;

model ClientSecurity {
  local_bearer_only: true;
  literal_loopback_http: true;
  explicit_port: true;
  redirects_allowed: false;
  max_response_bytes: ClientResponseByteLimit;
  token_file_regular_non_symlink: true;
  token_file_private_on_unix: true;
}

model ExecutionContract {
  reuse_model: ReuseModel;

  @maxItems(2)
  reuse_key: string[];

  runtime_host_reuse_allowed: boolean;
  direct_worker_launch_from_client: false;
  delegates_to: ProductId | null;
}

model RuntimeContract {
  product_id: ProductId;

  @minLength(1)
  org: string;

  daemon_port: DaemonPort;
  client_security: ClientSecurity;
  execution: ExecutionContract;
}

model RuntimeContractDocument {
  schema: "ores.desktop-runtime-contracts/v1";

  @minItems(1)
  contracts: RuntimeContract[];
}
