# Server MCP (`oauth_service`)

The client process signs in as itself. No person, no consent page, no chat link. Use this for a worker that calls a Matrix server with its own client credentials.

This adopts the MCP OAuth Client Credentials extension (draft, `modelcontextprotocol/ext-auth`, `specification/draft/oauth-client-credentials.mdx`) with the one difference recorded in [README.md](../README.md#profile-choices-beyond-the-spec): Matrix sends `client_secret` in the token-request body (`client_secret_post`).

## Server

| Step | Rule |
|---|---|
| Everything in the User scenario's resource-server column | RS-1 … RS-7 |
| `grant_types_supported` includes `client_credentials` | AS-1 |
| `token_endpoint_auth_methods_supported` includes `client_secret_post` (or `client_secret_basic`, or `private_key_jwt`) | AS-1 |
| The token request carries `resource` (RFC 8707). The audience check is the same as for a user token | RS-5 |
| No consent page and no authorize redirect for this grant | — |

Dynamic registration is not used for this grant. The operator registers the client out of band and shares the secret.

## Client

`auth_mode: "oauth_service"` and

```json
{ "clientId": "the-client-id", "scopes": ["optional"] }
```

The secret is stored under `client_secret` in `mcp_server_secrets`. The client posts:

```text
grant_type=client_credentials&client_id=…&client_secret=…&resource=<canonical resource>
```

Tokens live in `mcp_service_tokens`. A 401 starts one fresh client-credentials call, not a chat link. Step-up (C-14) does not apply: there is no user to send to a browser.

## Probe

```bash
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/msa/mcp --scenario oauth_service
```

Expect `client_credentials` in `grant_types_supported`.

## Reference

Client: `matrix-digital-employees`, `supabase/functions/_shared/mcp/tokens.ts` (`clientCredentials`). No reference server is `oauth_service`-only yet. A server that accepts this grant lists `client_credentials` in `grant_types_supported` and a confidential method in `token_endpoint_auth_methods_supported` (AS-1).
