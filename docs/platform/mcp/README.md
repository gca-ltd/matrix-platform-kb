# Matrix MCP Profile

Normative contract for every Matrix MCP **resource server**, **authorization server**, and **client**. A new app that follows this folder is compliant with [MCP 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) and with the rest of the platform on day one.

Protocol version: **`2025-11-25`**, falling back to **`2025-06-18`**. Do not advertise `2026-07-28`.

Auth is named only by the four auth types in [glossary.md](glossary.md). Custom auth headers are not part of the profile.

| Role | Reference implementation |
|---|---|
| Server with a built-in authorization server | `gca-ltd/matrix-sa-mcp` |
| Server with a separate authorization server | `gca-ltd/qobrix-crm-mcp` + `gca-ltd/qobrix-crm-mcp-oauth` |
| Client | `gca-ltd/matrix-digital-employees` |

Related: [ADR-059](../../architecture/decisions/ADR-059.md). This profile supersedes the auth taxonomy in ADR-039, ADR-040 D1, the signed-header row in ADR-041, and the signed-header path in ADR-058.

## Contents

| Doc | What it fixes |
|---|---|
| [glossary.md](glossary.md) | One name per concept, including the retired-terms table |
| [ui-copy.md](ui-copy.md) + [mcp-strings.json](mcp-strings.json) | EN / RU / HU copy |
| [config.md](config.md) | Env suffixes, registry tables, enums, `auth_config` |
| [routes.md](routes.md) | HTTP surface and health shape |
| [tools.md](tools.md) | Names, `whoami`, annotations, output caps |
| [agent-guidance.md](agent-guidance.md) | How servers explain tools and how clients deliver that to the model |
| [flows.md](flows.md) | The 14 flows |
| [admin-ui.md](admin-ui.md) | Client Tools page and server MCP tab |
| [conformance.md](conformance.md) | Probe, evals, results |

## Server profile

Transport is Streamable HTTP (MCP 2025-11-25).

| Rule | Level |
|---|---|
| One endpoint supports POST and GET. GET returns `text/event-stream` or **405**. DELETE may return 405. | MUST |
| A session id that was issued keeps working for later requests. An unknown or expired session id returns **404**. A server that does not issue session ids is stateless and ignores `Mcp-Session-Id`. | MUST |
| `Origin`, when present, is allowlisted. Anything else returns **403** with a JSON-RPC error and no `id`. No `Origin` (server-to-server) is allowed. | MUST |
| An unsupported `MCP-Protocol-Version` returns **400**. A missing header is treated as `2025-03-26`. | MUST |
| The process binds to loopback. Apache is the only public listener. | MUST |
| Every tool has a `title` and `annotations` (`readOnlyHint`, `destructiveHint`). | MUST |
| Tool output is capped. Overflow uses `_truncated` or `result_too_large` (see [tools.md](tools.md)). | MUST |
| Tool failures set `isError: true` and include a one-line `next_step`. | MUST |
| Report and aggregate tools publish `outputSchema` and `structuredContent`. | SHOULD |
| `initialize` returns `instructions` shaped as [agent-guidance.md](agent-guidance.md). | MUST |

## Resource server auth

| Rule | Level |
|---|---|
| Protected Resource Metadata (RFC 9728) at `/.well-known/oauth-protected-resource/<app>/mcp`, with `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported: ["header"]`. | MUST |
| Unauthenticated requests get **401** and `WWW-Authenticate: Bearer resource_metadata="…", scope="<required>"`. | MUST |
| A present but invalid token gets **401** with `error="invalid_token"`. | MUST |
| A token that lacks the scope for the operation gets **403** with `error="insufficient_scope"` and the scopes required. | MUST |
| The token's audience / `resource` is this server (RFC 8707). Other tokens are rejected. | MUST |
| The token presented by the MCP client is never forwarded to an upstream API. Upstream credentials are a separate token. | MUST |

`none` and `api_key` servers skip the OAuth metadata. `api_key` is `Authorization: Bearer <key>` (RFC 6750). A custom header name is allowed only when the server is a third party that the client did not build.

## Authorization server profile

| Rule | Level |
|---|---|
| RFC 8414 metadata, including `code_challenge_methods_supported: ["S256"]`, `grant_types_supported`, `token_endpoint_auth_methods_supported: ["none"]`, `scopes_supported`, and `client_id_metadata_document_supported: true`. The authorization server itself serves the path-suffixed well-known URL. | MUST |
| Client ID Metadata Documents (CIMD) for an `https` `client_id` that has a path: exact `client_id` match, required `client_name` and `redirect_uris`, SSRF-guarded fetch (https only, no private addresses, 5 s, 64 KB), cache per `Cache-Control`. | SHOULD |
| Dynamic client registration (RFC 7591) against the [redirect allowlist](#redirect-allowlist). A disallowed redirect is `invalid_redirect_uri`. Other bad metadata is `invalid_client_metadata`. | MUST |
| PKCE S256 is required. `plain` is rejected. | MUST |
| The authorize `redirect_uri` matches a registered URI exactly. | MUST |
| `resource`, when present, matches this server's canonical URL (case-insensitive scheme and host, no trailing slash, no fragment). A missing `resource` defaults to that URL. A mismatch is `invalid_target`. | MUST |
| Public clients get a refresh token on every authorization-code grant. Each refresh rotates it. Reuse of the old refresh token is `invalid_grant`. | MUST |
| Access tokens live at most 1 hour (`ACCESS_TTL_SEC`, default 3600). | MUST |
| `/revoke` invalidates the access token and its refresh token. | MUST |
| Before the user is sent to the upstream login, a consent page shows the client name and the redirect host, and warns when the redirect is loopback-only. Approval is remembered per user and `client_id`. Deny redirects with `error=access_denied`. | MUST |
| `/register` and `/token` are rate-limited per client IP. | MUST |
| Registration order advertised to clients: pre-registered client, then CIMD, then dynamic registration. | MUST |

## Client profile

| Rule | Level |
|---|---|
| POST every JSON-RPC message with `Accept: application/json, text/event-stream`. Handle a JSON body and an SSE stream. Read every SSE event: match the response `id`, answer `ping`, answer unsupported server requests (`sampling`, `elicitation`, `roots`) with `-32601`, and invalidate the tool cache on `notifications/tools/list_changed`. | MUST |
| Store `Mcp-Session-Id` and send it back. HTTP 404 with a session id starts a new `initialize`. | MUST |
| Send `MCP-Protocol-Version` on every request after `initialize`, using the negotiated version. Prefer `2025-11-25`, then `2025-06-18`. | MUST |
| On timeout or abort, send `notifications/cancelled` with the request id. | MUST |
| When POST `initialize` returns 400, 404, or 405, fall back to the legacy HTTP+SSE transport (GET, then the `endpoint` event). | SHOULD |
| Discovery: `resource_metadata` from `WWW-Authenticate`, then the path-suffixed protected-resource well-known, then the origin root. Authorization-server metadata: RFC 8414 path-insert, then OpenID path-insert, then path-append. | MUST |
| Refuse to continue when `code_challenge_methods_supported` does not include `S256`. | MUST |
| The metadata `issuer` equals the issuer URL used to fetch it. | MUST |
| Send canonical `resource` (lowercase scheme and host, no trailing slash, no fragment) on authorize, token, and refresh. | MUST |
| Scope selection: the `scope` on the 401 challenge, otherwise every `scopes_supported`, otherwise omit `scope`. | MUST |
| Client registration: a pre-registered `client_id`, then CIMD when the server advertises it, then dynamic registration. | MUST |
| PKCE S256 and a `state` parameter on every authorization. | MUST |
| On refresh, store a new refresh token when one is returned. When the response has none, keep the stored refresh token. | MUST |
| HTTP 403 with `error="insufficient_scope"` starts one step-up authorization per server per principal per hour, then surfaces the error. | MUST |
| Tokens travel only in `Authorization`. A token issued for server A is never sent to server B. | MUST |
| Every outbound fetch (MCP, metadata, dynamic registration, token, refresh) goes through the SSRF guard. | MUST |
| `readOnlyHint` / `destructiveHint` are untrusted hints. A tool is Ask unless the server sets `readOnlyHint: true` and does not set `destructiveHint: true`. An admin policy may override. | MUST |
| Persist `initialize.instructions` and inject them as [agent-guidance.md](agent-guidance.md) describes. | MUST |

## Redirect allowlist

One list, shared by every Matrix authorization server. Entries are **exact URIs**. The only pattern is loopback, which accepts any port (RFC 8252 §7.3).

| Client | Redirect URI |
|---|---|
| Digital Employees | `https://mihslqjjclbrqelnjjpb.supabase.co/functions/v1/mcp-oauth/callback` |
| Digital Employees (legacy, remove with `tools-oauth`) | `https://mihslqjjclbrqelnjjpb.supabase.co/functions/v1/tools-oauth` |
| Claude | `https://claude.ai/api/mcp/auth_callback` |
| Cursor web and cloud agents | `https://www.cursor.com/agents/mcp/oauth/callback` |
| Cursor desktop and CLI | `http://localhost:8787/callback` (covered by loopback) |
| Dust | `https://dust.tt/oauth/mcp/finalize`, `https://dust.tt/oauth/mcp_static/finalize`, `https://eu.dust.tt/oauth/mcp/finalize`, `https://eu.dust.tt/oauth/mcp_static/finalize`, `https://app.dust.tt/oauth/mcp/finalize`, `https://app.dust.tt/oauth/mcp_static/finalize` |
| Loopback | `http://127.0.0.1` and `http://localhost`, any port |
| Legacy, outside the spec, exact match only, review at each minor release | `cursor://anysphere.cursor-mcp/oauth/callback` |

An empty allowlist denies every non-loopback redirect. A prefix such as `cursor://` is not an entry.

## Onboarding

**A third-party server into Digital Employees**

1. Confirm Streamable HTTP and one of `none`, `api_key`, `oauth_user`, `oauth_service`.
2. Run `node tools/mcp-conformance/probe.mjs <url>`.
3. Register it on the Tools page. Set Agent usage notes when the server sends no `instructions`.
4. Discover tools. Set Allow / Ask / Deny. Default is Deny.
5. For `oauth_user`, confirm the first chat sends the sign-in link only in a private chat, then `<prefix>_whoami` matches the expected email.

**A third-party client into a Matrix server**

1. The client performs protected-resource and authorization-server discovery.
2. It registers with CIMD or dynamic registration. Its redirect URI is on the allowlist, exactly.
3. The user sees the consent page (client name and redirect host) before any upstream login.
4. Tool calls use the issued bearer token. Refresh rotates.

## KB sources consulted

- MCP specification 2025-11-25, Authorization and Transports
- RFC 9728, RFC 8414, RFC 8707, RFC 7591, RFC 6750, RFC 8252
- `docs/platform/security-model.md`
- `docs/platform/api-contracts.md`
- ADR-039, ADR-040, ADR-041, ADR-043, ADR-058
