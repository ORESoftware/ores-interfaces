/**
 * Desktop local-control CLI wire contract v1.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Product CLIs remain free to choose their argv spelling.
 */
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Desktop.Cli.V1;

enum LifecycleCommand {
  doctor,
  status,
  plan,
  up,
  down,
  reload,
  update,
  rollback,
  routes,
  logs,
  deploy,
}

enum RouteDiscoveryMode {
  compose_authority,
  compose_and_build_metadata,
}

enum DocsGenerationMode {
  disabled,
  consumer_owned,
}

@pattern("^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$")
scalar GitObjectId extends string;

union ComposeFileName {
  ".ores-compose.yaml",
  "ores-compose.yaml",
}

model GitRepositorySource {
  kind: "git_repository";

  @minLength(1)
  repository: string;

  revision: GitObjectId;

  @minLength(1)
  subdir?: string;
}

model GitHubOrganizationSource {
  kind: "github_organization";

  @minLength(1)
  organization: string;

  @minLength(1)
  repository_filter?: string;

  @minLength(1)
  revision?: string;
}

model LocalFolderSource {
  kind: "local_folder";

  @minLength(1)
  path: string;
}

union DeploySource {
  GitRepositorySource,
  GitHubOrganizationSource,
  LocalFolderSource,
}

model DeployRequest {
  source: DeploySource;
  compose_file: ComposeFileName;
  route_discovery: RouteDiscoveryMode;
  docs_generation: DocsGenerationMode;
  api_docs_revision?: GitObjectId;
}

model ControlPayload {
  kind: "deploy";
  value: DeployRequest;
}

model ControlRequest {
  @minLength(1)
  request_id: string;

  @minLength(1)
  product_id: string;

  command: LifecycleCommand;

  @minValue(1)
  generation?: integer;

  payload?: ControlPayload;
}

model ControlResponse {
  @minLength(1)
  request_id: string;

  accepted: boolean;

  @minValue(1)
  generation?: integer;

  message?: string;
}
