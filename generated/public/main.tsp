import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Validation;

@id("RequestMeta")
@extension("additionalProperties", false)
model RequestMeta {
  @minLength(1) @maxLength(128) requestId: string;
  @minLength(1) @maxLength(128) traceId: string;
  @minLength(2) @maxLength(64) locale?: string;
}

@id("PageQuery")
@extension("additionalProperties", false)
model PageQuery {
  @minValue(1) @maxValue(100) limit: uint16 = 50;
  @minLength(1) @maxLength(512) cursor?: string;
}

@id("ProblemDetails")
@extension("additionalProperties", false)
model ProblemDetails {
  @minLength(1) @maxLength(512) type: string;
  @minLength(1) @maxLength(256) title: string;
  @minValue(400) @maxValue(599) status: uint16;
  @maxLength(4096) detail?: string;
  @minLength(1) @maxLength(128) requestId: string;
}

@id("GitHubActionsLogStream")
enum GitHubActionsLogStream {
  stdout,
  stderr,
}

@id("GitHubActionsBuildLogEvent")
@extension("additionalProperties", false)
model GitHubActionsBuildLogEvent {
  @minLength(1) @maxLength(64) schemaVersion: string;
  @minLength(1) @maxLength(128) organization: string;
  @minLength(1) @maxLength(256) repository: string;
  @minLength(1) @maxLength(256) workflow: string;
  @minLength(1) @maxLength(64) runId: string;
  @minValue(1) @maxValue(65535) runAttempt: uint16;
  @minLength(1) @maxLength(64) jobId: string;
  @minLength(1) @maxLength(256) jobName: string;
  @minLength(40) @maxLength(40) headSha: string;
  @minLength(1) @maxLength(512) ref: string;
  @minLength(1) @maxLength(64) runnerOs: string;
  @minLength(1) @maxLength(64) runnerArch: string;
  stream: GitHubActionsLogStream;
  @minValue(0) @maxValue(4294967295) sequence: uint32;
  @minLength(1) @maxLength(128) eventId: string;
  @minLength(20) @maxLength(64) observedAt: string;
  @maxLength(65536) text: string;
  redacted: boolean;
  truncated: boolean;
  @minLength(1) @maxLength(64) traceId?: string;
  @minLength(1) @maxLength(64) spanId?: string;
}

@id("PublicValidationContract")
@oneOf
union PublicValidationContract {
  RequestMeta,
  PageQuery,
  ProblemDetails,
  GitHubActionsBuildLogEvent,
}
