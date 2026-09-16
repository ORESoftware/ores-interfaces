/**
 * ores-compose local machine control contract v1.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Generated schemas/types are comparison/runtime evidence
 * only and never become editable authority.
 */
import "@typespec/json-schema";

namespace Ores.Compose.Machine;

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model EnsureRequest {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(63)
  @pattern("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
  project: string;

  @minLength(1)
  @maxLength(63)
  @pattern("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
  session: string;

  @minLength(1)
  @maxLength(63)
  @pattern("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
  service: string;

  @minLength(1)
  @maxLength(255)
  @pattern("^(?![-/])(?!.*\\.\\.)(?!.*//)(?!.*@\\{)(?!.*\\/\\.)(?!.*\\.lock(?:/|$))[A-Za-z0-9._/-]*[A-Za-z0-9_/-]$")
  revision: string;

  rebuild: boolean;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model EnqueueResponse {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  deduplicated: boolean;
  state: "queued" | "running";
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineIngress {
  kind: "tcp" | "unix";

  @minLength(1)
  @maxLength(4096)
  @pattern("^(?:127\\.|\\[::1\\]:|/)")
  authority: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model ActiveSystem {
  @minLength(1)
  @maxLength(63)
  @pattern("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
  project: string;

  @minLength(1)
  @maxLength(63)
  @pattern("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
  session: string;

  @minLength(1)
  @maxLength(255)
  @pattern("^(?![-/])(?!.*\\.\\.)(?!.*//)(?!.*@\\{)(?!.*\\/\\.)(?!.*\\.lock(?:/|$))[A-Za-z0-9._/-]*[A-Za-z0-9_/-]$")
  revision: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  ingress?: MachineIngress;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model JobStatusResponse {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  state: "queued" | "running" | "ready" | "failed";
  active?: ActiveSystem;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model ReadinessResponse {
  schema_version: "ores.compose.machine.v1";
  ready: boolean;
  active?: ActiveSystem;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineErrorResponse {
  schema_version: "ores.compose.machine.v1";
  code:
    | "invalid_request"
    | "unknown_project"
    | "unknown_service"
    | "lazy_start_denied"
    | "queue_full"
    | "machine_busy"
    | "job_not_found"
    | "stale_generation"
    | "activation_failed"
    | "ingress_unavailable"
    | "internal_state_poisoned"
    | "server_busy"
    | "request_timeout"
    | "headers_too_large";

  @minLength(1)
  @maxLength(512)
  message: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id?: string;
}
