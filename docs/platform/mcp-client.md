# Matrix MCP client (Digital Employees)

> Companion to [matrix-mcp-server.md](matrix-mcp-server.md) and
> [ADR-040](../architecture/decisions/ADR-040.md).
> Server-side reference: [ADR-039](../architecture/decisions/ADR-039.md).

## Role

`matrix-digital-employees` is an MCP **client**. Tenants register remote MCP
servers; admins enable tools per digital employee; agents call tools under an
explicit **principal** with governance (Allow / Ask / Deny, rate limits, audit).

## Auth modes

| `auth_mode` | Maps to Qobrix | Notes |
|-------------|----------------|-------|
| `none` | — | Public / open servers |
| `api_key` | Mode B | Arbitrary header set; secrets encrypted or env `secret_ref` |
| `server_managed` | Mode C | No client credential; relay server's connect URL verbatim |
| `oauth_user` | Mode D | Per-principal OAuth 2.1 + PKCE; PRM discovery (Qobrix production path) |
| `oauth_service` | — | Client-credentials |

## Agent contract

The agent receives **exactly** the tool catalogue each MCP server publishes via
`tools/list` (cached in `mcp_tools`). Policy, rate limits, audit and session
handling wrap those tools — we do **not** inject synthetic tools.

### `oauth_user` (Qobrix and remote Mode D connectors)

The client is an OAuth 2.1 + PKCE user agent; callback
`{SUPABASE_URL}/functions/v1/mcp-oauth/callback`.

Token storage is keyed by `(server_id, principal_kind, principal_id)`:

| Caller | `principal_kind` | `principal_id` |
|--------|------------------|----------------|
| Signed-in Playground | `sso_user` | Matrix SSO user uuid |
| Teams / WhatsApp with linked `sso_user_id` | `sso_user` | that uuid |
| Channel caller with a channel-asserted email | `person` | `principals.id` (email-verified human) |
| Unlinked channel identity | `channel_identity` | `channel_identities.id` |

`person` unifies grants across every Teams thread for the same human so one
sign-in covers all group chats. See [ADR-043](../architecture/decisions/ADR-043.md).

Auth failures surface as `AuthRequiredError` when:

- the remote MCP server returns HTTP 401/403, **or**
- an `oauth_user` / `oauth_service` tool result is `isError` with an auth-shaped
  body (`Unauthorized`, `401`, `invalid_token`, …). In that case the client
  force-refreshes once; on a second failure it clears the stored grant and
  raises `auth_required`.

Group threads never receive a sign-in link (that is how a grant was previously
bound to the wrong human). Private threads get a one-time authorize URL.

#### Consent binding (`auth_config.identityProbe`)

Optional on `oauth_user` servers. After the OAuth callback stores a grant, the
client calls `identityProbe.tool` and reads `identityProbe.emailPath` from the
JSON result. If it does not match `mcp_oauth_states.expected_email`, the grant
is deleted and the user sees "Wrong account". Qobrix uses
`qobrix_whoami` → `profile.user.username`.

### `server_managed` (Mode C servers)

The MCP server returns its own connect URL inside the tool result text. The client
relays that text **verbatim** to the model. No platform `AUTH_REQUIRED:` prefix
and no chat sign-in UI.

### System prompt

The Playground chat system prompt is composed only from operator-edited employee
fields (`job_title`, `responsibilities`, `system_prompt`, etc.) plus bare runtime
facts (current date/time, caller profile when `identity_required`, RAG chunks and
memory blocks when enabled). No platform-injected directive strings.

## Module layout

```
supabase/functions/_shared/mcp/
  types.ts, errors.ts, crypto.ts, transport.ts, client.ts, registry.ts, principal.ts
  auth/apikey.ts
  auth/oauth/{discovery,client,flow,tokens,consent-bind}.ts
```

## Schema

See `supabase/migrations/` in `matrix-digital-employees` for `mcp_servers`,
`mcp_tools`, `mcp_tool_policies`, `mcp_tool_calls`, `mcp_oauth_*`.
