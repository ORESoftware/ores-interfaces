/**
 * Shared environment override metadata contract.
 *
 * This TypeSpec file and authored.schema.json are independent human-authored
 * peer authorities. Generated JSON Schema, manifest.env, and scan receipts are
 * evidence/projections only and never become editable authority.
 */
import "@typespec/json-schema";

namespace Ores.Config.EnvManifest;

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model EnvOverrideDeclaration {
  @minLength(1)
  @maxLength(64)
  @pattern("^[a-z][a-z0-9_]*$")
  name: string;

  @minLength(1)
  @maxLength(128)
  @pattern("^[A-Z_][A-Z0-9_]*$")
  key: string;

  kind: "string" | "bool" | "integer" | "double" | "json" | "url" | "duration-ms" | "string-list" | "integer-list";
  required: boolean;
  secret: boolean;
  exposure: "env-only" | "argv-and-env";

  @minLength(1)
  @maxLength(512)
  description: string;

  @minItems(1)
  @maxItems(32)
  overrides: string[];

  @minItems(1)
  @maxItems(3)
  environments: ("dev" | "stage" | "prod")[];

  @maxLength(8192)
  defaultValue?: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model ResolvedEnvVariable {
  @minLength(1)
  @maxLength(128)
  @pattern("^[A-Z_][A-Z0-9_]*$")
  key: string;

  kind: "string" | "bool" | "integer" | "double" | "json" | "url" | "duration-ms" | "string-list" | "integer-list";
  required: boolean;
  secret: boolean;
  exposure: "env-only" | "argv-and-env";

  @minLength(1)
  @maxLength(512)
  description: string;

  @minItems(1)
  @maxItems(64)
  overrides: string[];

  @minItems(1)
  @maxItems(3)
  environments: ("dev" | "stage" | "prod")[];

  @minItems(1)
  @maxItems(64)
  sources: string[];

  @maxLength(8192)
  defaultValue?: string;
}

@TypeSpec.JsonSchema.extension("additionalProperties", false)
model EnvManifest {
  schemaVersion: "ores.env-manifest.v1";
  @maxItems(512)
  variables: ResolvedEnvVariable[];
}
