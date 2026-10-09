# Oreslang REST route contract v1

`RouteContract.ores` is the canonical, versioned Oreslang module contract for the minimal REST demo. A source module declares `define module Route conforms RouteContract as ... end` (or `conforms to RouteContract` once the parser compatibility spelling is available). Use `import contract RouteContract from "<pinned vendor path>";` in consumers and keep exact contract file identity.

The first version requires both public `get(String request) -> String` and `post(String request) -> String`. Generated RPC, Lambda and GraphQL adapters may wrap these names; transport layers are **not** implied by a contract.

This artifact is authoritative for an Oreslang source module, not a replacement for the TypeSpec/JSON Schema wire protocol contracts. Future revisions require independent compatibility tests before changes.
