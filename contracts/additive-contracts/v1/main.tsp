import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.AdditiveContracts;

enum AdditiveKind {
  protobuf,
  wit,
  dafny,
}

@minLength(64)
@maxLength(64)
@pattern("^[0-9a-f]{64}$")
scalar Sha256 extends string;

model AdditiveArtifact {
  kind: AdditiveKind;
  source_path: string;
  source_sha256: Sha256;
}

model AdditiveContractManifestV1 {
  schema: "ores.additive-contract-manifest/v1";
  artifacts: AdditiveArtifact[];
}

model AdditiveVerificationReceiptV1 {
  schema: "ores.additive-contract-receipt/v1";
  status: "passed" | "failed" | "partial";
  manifest_sha256: Sha256;
  verifier_sha256: Sha256;
  artifact_count: uint32;
}
