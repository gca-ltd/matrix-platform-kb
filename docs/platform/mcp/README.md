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

## Pick your scenario

A new server or client starts here. One auth type per deployment, unless a single endpoint is documented as accepting both `api_key` and `oauth_user` (the `Authorization` header selects). Each scenario page is the checklist; this file is the rule set those checklists cite.

| Scenario | Auth type | Who holds the credential | Page |
|---|---|---|---|
| Public | `none` | Nobody | [scenarios/public.md](scenarios/public.md) |
| API key | `api_key` | One shared key, `Authorization: Bearer` | [scenarios/api-key.md](scenarios/api-key.md) |
| User | `oauth_user` | Each person, authorization code + PKCE | [scenarios/user.md](scenarios/user.md) |
| Server | `oauth_service` | The client process, client credentials | [scenarios/service.md](scenarios/service.md) |

User scenario, in one line: the server answers **401**. A Matrix chat client turns that into its own `<slug>__connect` tool, whose result is the one-time authorize URL, and the agent shows that URL only in a private chat. The server never puts a link in a tool result.

## Contents

| Doc | What it fixes |
|---|---|
| [scenarios/](scenarios/public.md) | One page per auth type: checklists, probe, reference code |
| [glossary.md](glossary.md) | One name per concept, including the retired-terms table |
| [ui-copy.md](ui-copy.md) + [mcp-strings.json](mcp-strings.json) | EN / RU / HU copy |
| [config.md](config.md) | Env suffixes, registry tables, enums, `auth_config` |
| [routes.md](routes.md) | HTTP surface and health shape |
| [tools.md](tools.md) | Names, `whoami`, annotations, output caps |
| [agent-guidance.md](agent-guidance.md) | How servers explain tools and how clients deliver that to the model |
| [flows.md](flows.md) | The 14 flows |
| [admin-ui.md](admin-ui.md) | Client Tools page and server MCP tab |
| [auth-pages.md](auth-pages.md) | Consent, success, and error pages |
| [conformance.md](conformance.md) | Probe, evals, results |

## Server profile

Transport is Streamable HTTP (MCP 2025-11-25).

| ID | Rule | Level |
|---|---|---|
| T-1 | One endpoint supports POST and GET. GET returns `text/event-stream` or **405**. DELETE may return 405. | MUST |
| T-2 | A session id that was issued keeps working for later requests. An unknown or expired session id returns **404**. A server that does not issue session ids is stateless and ignores `Mcp-Session-Id`. | MUST |
| T-3 | `Origin`, when present, is allowlisted. Anything else returns **403** with a JSON-RPC error and no `id`. No `Origin` (server-to-server) is allowed. | MUST |
| T-4 | An unsupported `MCP-Protocol-Version` returns **400**. A missing header is treated as `2025-03-26`. | MUST |
| T-5 | The process binds to loopback. Apache is the only public listener. | MUST |
| T-6 | Every tool has a `title` and `annotations` (`readOnlyHint`, `destructiveHint`). | MUST |
| T-7 | Tool output is capped. Overflow uses `_truncated` or `result_too_large` (see [tools.md](tools.md)). | MUST |
| T-8 | Tool failures set `isError: true` and include a one-line `next_step`. | MUST |
| T-9 | Report and aggregate tools publish `outputSchema` and `structuredContent`. | SHOULD |
| T-10 | `initialize` returns `instructions` shaped as [agent-guidance.md](agent-guidance.md). | MUST |
| T-11 | A server never puts a sign-in link in a tool result. URL mode elicitation (2025-11-25, error `-32042`) is only for upstream third-party credentials, never for authorizing the MCP client itself. A client that does not support elicitation answers `-32601`. | MUST |

## Resource server auth

| ID | Rule | Level |
|---|---|---|
| RS-1 | Protected Resource Metadata (RFC 9728) at `/.well-known/oauth-protected-resource/<app>/mcp`, with `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported: ["header"]`. | MUST |
| RS-2 | Unauthenticated requests get **401** and `WWW-Authenticate: Bearer resource_metadata="…", scope="<required>"`. | MUST |
| RS-3 | A present but invalid token gets **401** with `error="invalid_token"`. A token with no `resource` is invalid. | MUST |
| RS-4 | A token that lacks the scope for the operation gets **403** with `error="insufficient_scope"`, the scopes required, and `resource_metadata` on `WWW-Authenticate`. | MUST |
| RS-5 | The token's audience / `resource` is this server (RFC 8707). Other tokens are rejected. | MUST |
| RS-6 | The token presented by the MCP client is never forwarded to an upstream API. Upstream credentials are a separate token. | MUST |
| RS-7 | Access tokens travel only in the `Authorization` header. A token in the query string is rejected. | MUST |

`none` and `api_key` servers skip the OAuth metadata (RS-1). `api_key` is `Authorization: Bearer <key>` (RFC 6750). A custom header name is allowed only when the server is a third party that the client did not build.

## Authorization server profile

| ID | Rule | Level |
|---|---|---|
| AS-1 | RFC 8414 metadata, including `code_challenge_methods_supported: ["S256"]`, `grant_types_supported`, `scopes_supported`, and `client_id_metadata_document_supported: true`. `token_endpoint_auth_methods_supported` includes `"none"` whenever public clients are accepted, and a confidential method (`client_secret_post`, `client_secret_basic`, or `private_key_jwt`) whenever Server OAuth is accepted. The authorization server itself serves the path-suffixed well-known URL. | MUST |
| AS-2 | Client ID Metadata Documents (CIMD) for an `https` `client_id` that has a path: exact `client_id` match, required `client_name` and `redirect_uris`, SSRF-guarded fetch (https only, no private addresses, 5 s, 64 KB), cache per `Cache-Control`. | SHOULD |
| AS-3 | Dynamic client registration (RFC 7591) against the [redirect allowlist](#redirect-allowlist). A disallowed redirect is `invalid_redirect_uri`. Other bad metadata, including an empty `client_name`, is `invalid_client_metadata`. | MUST |
| AS-4 | PKCE S256 is required. `plain` is rejected. | MUST |
| AS-5 | The authorize `redirect_uri` matches a registered URI exactly. | MUST |
| AS-6 | `resource`, when present, matches this server's canonical URL (case-insensitive scheme and host, no trailing slash, no fragment). A missing `resource` defaults to that URL. A mismatch is `invalid_target` on authorize, token, and refresh. | MUST |
| AS-7 | Public clients get a refresh token on every authorization-code grant. Each refresh rotates it. Reuse of the old refresh token is `invalid_grant`. `REFRESH_TTL_SEC` bounds the refresh token. | MUST |
| AS-8 | Access tokens live at most 1 hour. `ACCESS_TTL_SEC` defaults to 3600 and is capped at 3600. | MUST |
| AS-9 | `/revoke` invalidates the access token and its refresh token. | MUST |
| AS-10 | Before the user is sent to the upstream login, a consent page shows the client name and the redirect host, and warns when the redirect is loopback-only. When the authorization server can recognise the returning user before that login (a signed session cookie), approval is remembered per user and `client_id` and the page is skipped. Otherwise the page is shown every time. Deny redirects with `error=access_denied`. | MUST |
| AS-11 | Every browser page an MCP server or authorization server shows uses the shared auth-page shell in [auth-pages.md](auth-pages.md). | MUST |
| AS-12 | `/register` and `/token` are rate-limited per client IP. | MUST |

## Client profile

| ID | Rule | Level |
|---|---|---|
| C-1 | POST every JSON-RPC message with `Accept: application/json, text/event-stream`. Handle a JSON body and an SSE stream. Read every SSE event: match the response `id`, answer `ping`, answer unsupported server requests (`sampling`, `elicitation`, `roots`) with `-32601`, and invalidate the tool cache on `notifications/tools/list_changed`. The legacy HTTP+SSE fallback does the same. | MUST |
| C-2 | Store `Mcp-Session-Id` and send it back. HTTP 404 with a session id starts a new `initialize`. | MUST |
| C-3 | Send `MCP-Protocol-Version` on every request after `initialize`, using the negotiated version. Prefer `2025-11-25`, then `2025-06-18`. | MUST |
| C-4 | On timeout or abort, send `notifications/cancelled` with the request id. | MUST |
| C-5 | When POST `initialize` returns 400, 404, or 405, fall back to the legacy HTTP+SSE transport (GET, then the `endpoint` event). | SHOULD |
| C-6 | Discovery: `resource_metadata` from `WWW-Authenticate`, then the path-suffixed protected-resource well-known, then the origin root. Authorization-server metadata: RFC 8414 path-insert, then OpenID path-insert, then path-append. | MUST |
| C-7 | Refuse to continue when `code_challenge_methods_supported` does not include `S256`, and when the field is absent. | MUST |
| C-8 | The metadata `issuer` equals the issuer URL used to fetch it. Metadata with no `issuer` is refused. | MUST |
| C-9 | Send canonical `resource` (lowercase scheme and host, no trailing slash, no fragment) on authorize, token, and refresh. Never put a token in a query string. | MUST |
| C-10 | Scope selection: the `scope` on the 401 challenge, otherwise every `scopes_supported`, otherwise omit `scope`. | MUST |
| C-11 | Client registration: a pre-registered `client_id`, then CIMD when the server advertises it, then dynamic registration. | MUST |
| C-12 | PKCE S256 and a `state` parameter on every authorization. | MUST |
| C-13 | On refresh, store a new refresh token when one is returned. When the response has none, keep the stored refresh token. | MUST |
| C-14 | HTTP 403 with `error="insufficient_scope"` starts one step-up authorization per server per principal per hour, then surfaces the error. The hour counts step-up attempts only. | MUST |
| C-15 | Tokens travel only in `Authorization`. A token issued for server A is never sent to server B. | MUST |
| C-16 | Every outbound fetch (MCP, metadata, dynamic registration, token, refresh) goes through the SSRF guard. | MUST |
| C-17 | `readOnlyHint` / `destructiveHint` are untrusted hints. A tool is Ask unless the server sets `readOnlyHint: true` and does not set `destructiveHint: true`. An admin policy may override. The deferred catalogue marks each tool read-only or mutating. | MUST |
| C-18 | Persist `initialize.instructions` and inject them as [agent-guidance.md](agent-guidance.md) describes. | MUST |
| C-19 | For `oauth_user`, a chat client exposes a synthetic `<slug>__connect` tool. Its result is the one-time authorize URL in a private chat, and a "use a private chat" sentence in a group chat. It is not a remote `*_sign_in` tool. | MUST |

## Profile choices beyond the spec

The profile follows MCP 2025-11-25. These rows are deliberate differences, each named so a review can see them.

| Choice | Spec | Profile |
|---|---|---|
| Dynamic client registration | MAY in 2025-11-25. Deprecated in 2026-07-28 in favour of Client ID Metadata Documents | MUST (AS-3). Cursor and Claude still register this way. CIMD stays available (AS-2, C-11) |
| `cursor://anysphere.cursor-mcp/oauth/callback` | Redirects must be HTTPS or localhost (OAuth 2.1), in both 2025-11-25 and 2026-07-28 | Kept, exact match only, under the native-app exception in RFC 8252 §7.1. Cursor desktop sends it in the same registration as its HTTPS callback and `http://localhost:8787/callback`; rejecting one URI rejects the registration. Reviewed at each minor release |
| Client credentials | Optional extension, draft, in `modelcontextprotocol/ext-auth` (`specification/draft/oauth-client-credentials.mdx`) | Adopted for `oauth_service`. The extension's metadata bullet requires `private_key_jwt` or `client_secret_basic`. Its own example sends `client_secret` in the body, which is `client_secret_post`. Matrix lists `client_secret_post` (AS-1) and sends `resource` on the token request |
| URL mode elicitation | New in 2025-11-25, for upstream credentials | Allowed only for that (T-11). The retired "URL-mode authorization" (a server-minted connect link inside a tool result) stays retired |

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

`tools/mcp-conformance/redirect-allowlist.json` is the machine-readable copy of this table. Authorization servers load it when `REDIRECT_ALLOWLIST` is unset. Each server keeps a byte-identical copy, and `check-auth-pages.mjs` fails when a copy drifts. Loopback is not in the file: the rule allows it on any port.

## Spec status

The profile pins protocol **`2025-11-25`**, with fallback **`2025-06-18`**. Do not advertise `2026-07-28`.

`2026-07-28` is the current MCP revision and is not a compatible extension of `2025-11-25`. It removes the `initialize` handshake and `Mcp-Session-Id`, and it requires `server/discover` on every server. Cursor, Claude, and Digital Employees still speak the handshake. Advertising `2026-07-28` from a handshake server would make those clients fail version negotiation.

The gaps against `2026-07-28` are listed in [conformance.md](conformance.md#2026-07-28-gap-register). Closing them is a separate migration. This pin is the reason, not an omission.

## Onboarding

**A third-party server into Digital Employees**

1. Confirm Streamable HTTP and one of `none`, `api_key`, `oauth_user`, `oauth_service`.
2. Run `node tools/mcp-conformance/probe.mjs <url>`.
3. Register it on the Tools page. Set Agent usage notes when the server sends no `instructions`.
4. Discover tools. On a server assigned to an employee, each new tool is Allow when `readOnlyHint` is true and `destructiveHint` is not true, otherwise Ask. An existing choice is kept. Deny is the default only for a server that is not assigned.
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
