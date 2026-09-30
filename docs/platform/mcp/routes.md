# MCP HTTP surface

A Matrix tool server is public at `https://intranet.sharpsir.group/<app>/mcp`. `<app>` is the Apache subpath (`msa`, `qobrix-crm`).

## Resource server

| Method and path | Purpose |
|---|---|
| `POST` `/<app>/mcp` | Streamable HTTP. One JSON-RPC message per request. |
| `GET` `/<app>/mcp` | SSE stream, or **405** when the server does not push. |
| `DELETE` `/<app>/mcp` | End the session, or **405**. |
| `GET` `/<app>/mcp/health` | Health. |
| `GET` `/.well-known/oauth-protected-resource/<app>/mcp` | RFC 9728 metadata. Omitted when auth is `none` or `api_key` only. |

Health body:

```json
{
  "ok": true,
  "name": "msa",
  "version": "1.2.3",
  "protocolVersions": ["2025-11-25", "2025-06-18"],
  "auth": {
    "resource": "https://intranet.sharpsir.group/msa/mcp",
    "issuer": "https://intranet.sharpsir.group/msa/mcp",
    "scopes": ["msa.read", "offline_access"]
  },
  "contractVersion": "optional",
  "drift": null
}
```

`version` is the server package version. `auth.scopes` lists what the server enforces.

## Built-in authorization server

Same process, same public origin.

| Method and path | Purpose |
|---|---|
| `GET` `/.well-known/oauth-authorization-server/<app>/mcp` | RFC 8414 metadata. |
| `GET` `/<app>/mcp/oauth/authorize` | Authorization code + PKCE. |
| `POST` `/<app>/mcp/oauth/token` | `authorization_code` and `refresh_token`. |
| `POST` `/<app>/mcp/oauth/register` | Dynamic client registration. |
| `POST` `/<app>/mcp/oauth/revoke` | Revocation. |
| `GET` `/<app>/mcp/consent` | Consent page. Shows the client name and the redirect host before any upstream login. |

## Separate authorization server

The resource server's protected-resource metadata points `authorization_servers` at the issuer. The authorization server serves the same relative paths under its own base, including the path-suffixed well-known URL from the Node process (Apache must not be the only place that maps it).

## Admin API (optional)

`/<app>/mcp/admin/{status,connections,tools,calls,settings}`.

The caller presents a Matrix SSO access token. `client_id` matches the server's SSO app. Scope is `global`, `org_admin`, or `system_admin`.

| Path | Purpose |
|---|---|
| `GET status` | Health plus vault counts |
| `GET connections`, `POST connections/:id/revoke`, `POST connections/revoke-all` | Connection roster |
| `GET tools`, `PATCH tools/:name` | Enable or disable a tool |
| `GET calls` | Recent calls |
| `GET` / `PATCH settings` | `max_result_chars`, `cache_ttl_sec` |

## Client redirect

Digital Employees uses exactly:

`https://mihslqjjclbrqelnjjpb.supabase.co/functions/v1/mcp-oauth/callback`

The landing page is the static card `{appBaseUrl}/oauth/mcp-callback.html`. It takes `ok` and `code` (`expired`, `used`, `already_connected`, `cancelled`, `wrong_account`, `failed`). `appBaseUrl` is the browser origin plus the SPA base path (`https://intranet.sharpsir.group/digital-employees`). Join the path relatively (`oauth/mcp-callback.html` against a base that ends in `/`). A browser `Origin` header has no path and is never a base URL. The old `{appBaseUrl}/oauth/mcp-callback` path redirects to the static page. `tools-oauth` is legacy and is removed once no `mcp_oauth_clients` row references it.
