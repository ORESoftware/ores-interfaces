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

enum SwitchPhase {
  confirmReady: "confirm_ready",
  drainActive: "drain_active",
  stopActive: "stop_active",
  fetchRevision: "fetch_revision",
  checkoutRevision: "checkout_revision",
  rebuild: "rebuild",
  configureNetwork: "configure_network",
  startSystem: "start_system",
  awaitReadiness: "await_readiness",
  publishIngress: "publish_ingress",
}

enum SwitchFailureCode {
  confirmReadyFailed: "confirm_ready_failed",
  drainActiveFailed: "drain_active_failed",
  stopActiveFailed: "stop_active_failed",
  fetchRevisionFailed: "fetch_revision_failed",
  checkoutRevisionFailed: "checkout_revision_failed",
  rebuildFailed: "rebuild_failed",
  configureNetworkFailed: "configure_network_failed",
  startSystemFailed: "start_system_failed",
  awaitReadinessFailed: "await_readiness_failed",
  publishIngressFailed: "publish_ingress_failed",
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model SwitchFailureDiagnostic {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  phase: SwitchPhase;
  code: SwitchFailureCode;

  @minLength(1)
  @maxLength(64)
  message: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineEnqueuedEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "enqueued";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  deduplicated: boolean;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineClaimedEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "claimed";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineSwitchPhaseEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "switch_phase";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  phase: SwitchPhase;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineReadinessEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "readiness";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  ready: boolean;
  active?: ActiveSystem;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineFailureEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "failure";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  phase: SwitchPhase;
  code: SwitchFailureCode;

  @minLength(1)
  @maxLength(64)
  message: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model MachineTerminalEvent {
  schema_version: "ores.compose.machine.v1";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  event_id: string;

  kind: "terminal";

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  job_id: string;

  @minLength(1)
  @maxLength(20)
  @pattern("^[1-9][0-9]{0,19}$")
  generation: string;

  state: "ready" | "failed";
  active?: ActiveSystem;
}

union MachineEvent {
  enqueued: MachineEnqueuedEvent,
  claimed: MachineClaimedEvent,
  switchPhase: MachineSwitchPhaseEvent,
  readiness: MachineReadinessEvent,
  failure: MachineFailureEvent,
  terminal: MachineTerminalEvent,
}
