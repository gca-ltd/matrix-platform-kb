# MCP glossary

One name per concept. UI, docs, code, env values, logs, and tests use these names. Auth is named only by the four auth types.

| Term | Definition | Do not say |
|---|---|---|
| Tool server | An MCP server a client registers and calls. "MCP server" stays the technical term in specs and code. | connector, integration, plugin |
| Tool | One MCP tool (`tools/list` entry). | function, action, skill |
| Connection | One person's, or the service account's, authorised link to a tool server. | session, grant, vault (those are internal) |
| Sign in | The user action that starts User OAuth 2.1. | Authorize, Authorise, Connect (as the verb on a button) |
| Consent | The Allow / Deny page shown before upstream login. | approval (that word is reserved) |
| Access policy | Allow, Ask, or Deny for one tool. | permission mode |
| Approval | A tool call paused because the policy is Ask. | consent |
| Discovery | Loading the tool list from the server. | sync, refresh (refresh is the token grant) |
| Revoke | Ending a connection. | disconnect, sign out (those are page titles only when the copy says so) |

## Auth types

| Key | Label | Standard |
|---|---|---|
| `none` | None | No credentials |
| `api_key` | API key | `Authorization: Bearer <key>` (RFC 6750) |
| `oauth_user` | User OAuth 2.1 | Authorization code + PKCE, RFC 9728 / 8414 / 8707, CIMD or dynamic registration |
| `oauth_service` | Service OAuth 2.1 | Client credentials (RFC 6749 §4.4) |

Labels are exact. Do not shorten them to "OAuth", "Per-user", or "Service account" in UI.

## Retired terms

This is the only place these strings are allowed. ADR-059 records why they were removed. A guardrail fails the build if they appear anywhere else outside the history allowlist.

| Retired term | Replacement |
|---|---|
| Mode A | `none` on stdio, using the server's own credential |
| Mode B | `api_key` |
| Mode C | Removed. It was signed `X-Chat-*` headers plus an out-of-band connect link. User OAuth 2.1 replaces it. |
| Mode D | `oauth_user` |
| Modes A–D | The four auth types |
| `server_managed` | Removed. User OAuth 2.1 replaces it. |
| Server-managed sign-in | User OAuth 2.1 |
| URL-mode authorization | Removed with the signed-header path |
| `oauth-claude` | `oauth_user` |
| dual mode / auto mode | The server accepts `api_key` and `oauth_user` on one endpoint; the `Authorization` header selects the type |
