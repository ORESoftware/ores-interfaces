# Shared environment-manifest contract

`contracts/env-manifest/v1/` defines the common metadata vocabulary used by repository-root service TOMLs and by `flags-2-env` environment discovery.

## Authority boundary

`main.tsp` and `authored.schema.json` are independent, human-authored peer authorities. TJSV compares and executes both. Generated TypeSpec JSON Schema, Contract IR, scan receipts, and `manifest.env` are evidence/projections only.

## Source declaration

A service-family TOML may expose a constrained `[[env]]` block with these normalized fields:

- `name`: stable local binding identifier;
- `key`: process environment variable name;
- `kind`: `string`, `bool`, `integer`, `double`, `json`, `url`, `duration-ms`, `string-list`, or `integer-list`;
- `required`: whether the runtime profile requires a value;
- `secret`: whether values must remain in the secret boundary;
- `exposure`: `env-only` or `argv-and-env`;
- `description`: human explanation, required so generated inventories remain understandable;
- `overrides`: one or more dotted config paths controlled by the variable;
- `environments`: exact subset of `dev`, optional `stage`, and `prod` where the key belongs;
- `defaultValue`: optional non-secret fallback encoded as text for the downstream type coercer.

Semantic consumers MUST reject `secret=true` together with `exposure=argv-and-env` or `defaultValue`. They MUST also reject duplicate declarations whose type/security metadata conflicts.

## Deterministic aggregation

`flags-2-env` owns discovery and resolution. The intended scan order is repository-root paths sorted bytewise, then declarations in source order, then final variables sorted by environment key. Repeated compatible declarations are merged by key; source paths and override paths are de-duplicated and sorted. Any incompatible declaration fails closed.

The generated `manifest.env` contains comments plus empty `KEY=` assignments only. Comments record type, security/exposure state, environments, override paths, source TOMLs, and description. It carries no runtime value and is safe to commit.

`.cli-flags.toml` remains the actual argv parser contract. The generated environment inventory in it is an index: only variables explicitly declared `argv-and-env` may also be backed by `[flags.*]`; `env-only` variables, especially secrets, must never acquire argv aliases or defaults.

## SOPS boundary

`env/enc/dev.env.enc`, optional `env/enc/stage.env.enc`, and `env/enc/prod.env.enc` remain the tracked `ores-sops` ciphertext authorities for values. `env/dec/*.env` remains ignored runtime plaintext. Audits compare key names and allowed profiles to `manifest.env` without printing values. A manifest generator never fabricates ciphertext or checked-in plaintext.
