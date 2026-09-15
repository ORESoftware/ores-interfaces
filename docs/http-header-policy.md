# HTTP application-header admission

`contracts/http-header-policy/v1/` defines the shared shape used to document and audit accepted request headers across ORES services.

The routing identity remains **HTTP method + path template**. Headers, query parameters, path values, and payloads validate a selected operation; they never select a different operation.

## Two header views

A server has two deliberately different views of request headers:

1. **Raw transport view** — owned by HTTP, authentication, tracing, proxy, CORS, and content-framing middleware. Runtime-owned headers such as `authorization`, `cookie`, `content-type`, forwarding headers, W3C trace context, and hop-by-hop fields are handled here.
2. **Application view** — passed to RPC/business handlers after transport middleware has run. This view contains exactly the operation's declared application headers. Unknown application headers are removed before dispatch.

This avoids the unsafe interpretation of “strip unknown headers” that would delete credentials or framing metadata before the middleware responsible for them can validate them.

## Where accepted names come from

`api-docs` route contracts are the operation inventory. For RIDL v2, the keys of `header_params` are the accepted application header names. The generated per-service admission manifest is a projection of those route declarations into `ServiceHeaderPolicy`; it is not another editable authority.

Header names are canonical lower-case HTTP field names. Business contracts may not claim runtime/protocol-owned namespaces or names, including authentication/cookies, content framing, forwarding, trace context, hop-by-hop headers, or `grpc-*`.

An operation with no declared application headers therefore exposes an empty application-header view.

## Enforcement contract

Clients should be generated with typed header arguments so an undeclared header cannot be expressed through the normal RPC API. Servers must validate required declared headers and their values, construct the declared-only application view, and remove unknown application headers before invoking the business handler.

Raw headers must not be copied wholesale into logs, error bodies, downstream requests, or RPC metadata. Cross-origin forwarding remains deny-by-default and belongs to an explicit proxy/security policy rather than this business-header contract.
