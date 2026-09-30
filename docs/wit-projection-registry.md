# WIT projection registry boundary

Tracking: #60.

WIT is registered as downstream interface/component projection evidence. Independently authored TypeSpec and Draft 2020-12 JSON Schema remain the structural peer authorities.

A registered WIT lane records the exact `ores-wit` producer revision, exact TJSV compatibility revision, admitted input/Contract-IR digests, WIT source/canonical/projection digests, compatibility mode, and retained baseline/receipt identity. Generated WIT never overwrites either authored peer.

Raw WIT parse/format/resolve/bindgen belongs to `ORESoftware/ores-wit`; normalized compatibility and promotion decisions belong to TJSV. `ores-interfaces` publishes the registry/provenance relationship so client generators and consumers can resolve one admitted closure instead of inventing independent WIT semantics.
