# MCP configuration

## Server environment variables

Prefix `<APP>_MCP_`. `<APP>` is the short product key (`MSA`, `QOBRIX`). A separate authorization server uses the same prefix.

| Suffix | Meaning | Default |
|---|---|---|
| `PUBLIC_URL` | Canonical resource URL, no trailing slash | required |
| `ISSUER` | Authorization-server issuer. Defaults to `PUBLIC_URL` when the authorization server is built in | `PUBLIC_URL` |
| `HOST` | Bind address | `127.0.0.1` |
| `PORT` | Bind port | per app |
| `ALLOWED_ORIGINS` | Comma-separated browser `Origin` allowlist | `https://intranet.sharpsir.group` |
| `REDIRECT_ALLOWLIST` | Comma-separated **exact** redirect URIs. See [README.md](README.md#redirect-allowlist). Loopback is always allowed on any port | the canonical list |
| `ACCESS_TTL_SEC` | Access-token lifetime | `3600` |
| `REFRESH_TTL_SEC` | Refresh-token lifetime | `2592000` |
| `RATE_LIMIT_PER_MIN` | Per-IP and per-token request budget | `300` |
| `REGISTER_RATE_LIMIT_PER_MIN` | Budget for dynamic registration | `30` |
| `MAX_RESULT_CHARS` | Tool output cap | `30000` |
| `CACHE_TTL_SEC` | Response cache | per app |
| `STATE_SECRET` | Encrypts the vault and signs cookies | required |
| `DATA_DIR` | SQLite (or equivalent) directory | required |
| `INTROSPECTION_SECRET` | Shared secret when the authorization server is a separate process | required in that layout |

Previous names are read for one minor release and log a warning at boot. A separate authorization server uses the same `<APP>_MCP_` prefix as its resource server. Qobrix reads the old `QOBRIX_OAUTH_*` names and warns: `QOBRIX_OAUTH_ACCESS_TTL` → `QOBRIX_MCP_ACCESS_TTL_SEC`, `QOBRIX_OAUTH_RATE_LIMIT` → `QOBRIX_MCP_RATE_LIMIT_PER_MIN`, `QOBRIX_OAUTH_INTROSPECTION_SECRET` → `QOBRIX_MCP_INTROSPECTION_SECRET`. `QOBRIX_MCP_AUTO_MODE` and `MSA_MCP_IDENTITY_SECRET` are removed and are not read.

`QOBRIX_MCP_AUTH` is a comma list of `none`, `api_key`, `oauth_user`. HTTP defaults to `api_key,oauth_user`. The old values `env`, `headers`, `oauth`, `oauth-claude` map to those types and warn at boot.

An empty `REDIRECT_ALLOWLIST` denies every non-loopback redirect.

## Client registry

Digital Employees is the reference schema. A new client copies these tables.

| Table | Role |
|---|---|
| `mcp_servers` | Registered tool server. Includes `server_instructions`, `instructions_hash`, `usage_notes` |
| `mcp_server_secrets` | Encrypted secrets (`value_enc` or `secret_ref`) |
| `mcp_oauth_clients` | CIMD, dynamic registration, or manual client per issuer |
| `mcp_oauth_states` | PKCE `state` rows |
| `mcp_principal_tokens` | User OAuth 2.1 tokens, encrypted |
| `mcp_service_tokens` | Service OAuth 2.1 tokens, encrypted |
| `mcp_tools` | Discovered catalogue (`annotations` jsonb) |
| `mcp_tool_defaults` | Workspace Allow / Ask / Deny |
| `mcp_tool_policies` | Per-employee override |
| `employee_mcp_servers` | Assignment |
| `mcp_tool_calls` | Audit and the approval queue |
| `mcp_server_health` | Circuit breaker |

### Enums

| Field | Values |
|---|---|
| `auth_mode` | `none`, `api_key`, `oauth_user`, `oauth_service` |
| `discovery_status` | `ok`, `needs_sign_in`, `failed` |
| Policy `mode` | `allow`, `ask`, `deny`. Effective policy is override, then default, then **deny** |
| `mcp_tool_calls.status` | `pending`, `running`, `succeeded`, `failed`, `rejected` (database CHECK) |
| `registration_source` | `cimd`, `dcr`, `manual` |
| Error codes | `auth_required`, `forbidden`, `insufficient_scope`, `transport`, `timeout`, `protocol`, `tool_error`, `circuit_open`, `ssrf`, `registration` |
| Connection state (derived) | `connected`, `expiring`, `expired`, `revoked` |

### `auth_config`

| `auth_mode` | JSON |
|---|---|
| `none` | `{}` |
| `api_key` | `{ "headers": [{ "name": "Authorization", "secretKey": "api_key", "scheme": "Bearer" }] }`. Another header name is allowed only for a third-party server. |
| `oauth_user` | `{ "presetClientId"?: string, "scopes"?: string[], "identityProbe"?: { "tool": "<prefix>_whoami", "emailPath": "email" } }` |
| `oauth_service` | `{ "clientId": string, "scopes"?: string[] }` with the secret stored under `client_secret` |

## Client environment

| Variable | Purpose |
|---|---|
| `MCP_ENC_KEY` | AES-GCM key for secrets and tokens. Required. |
| `MCP_ALLOW_LOOPBACK` | `1` allows a loopback tool-server URL. Labs only. |
| Client metadata URL | Fixed: `https://intranet.sharpsir.group/digital-employees/oauth/client-metadata.json`. Not an env var. |
