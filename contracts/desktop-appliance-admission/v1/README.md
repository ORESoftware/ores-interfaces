# Desktop appliance admission projection v1

This contract is the public, fleet-shared **wire shape** for admission facts that a product desktop appliance can project without exposing product-private configuration.

It deliberately does not replace `ORESoftware/ores-common-desktop-infra` runtime validation. The common desktop implementation remains responsible for cross-field and runtime rules such as Cloudflare mode consistency, stable-channel CI evidence, required capability membership, compose graph restrictions, and hot-reload policy.

The projection exists so a consumer repository does not need a private cross-organization GitHub token merely to prove basic contract shape in pull-request CI. A consumer should:

1. check out its own exact PR head with credentials disabled;
2. project these fields from its local appliance;
3. validate the projection against an **immutable commit** of public `ORESoftware/ores-interfaces`;
4. run its local semantic/runtime admission checks;
5. fail closed if the projection, public contract pin, or local semantic checks drift.

A mutable `main` reference is not release evidence. Generated schemas or copied validator implementations are not new authorities.
