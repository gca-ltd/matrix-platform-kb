# API key MCP (`api_key`)

One shared secret. Every caller is the same principal. Use this for a server-to-server feed (charts, a public-catalogue function, a metrics endpoint) where there is no per-person consent.

## Server

| Step | Rule |
|---|---|
| Streamable HTTP profile | T-1 … T-8, T-10, T-11 |
| Require `Authorization: Bearer <key>` (RFC 6750). Reject a key in the query string | RS-7 |
| Missing or wrong key: **401**. Do not publish Protected Resource Metadata and do not send `resource_metadata` | RS-1 does not apply |
| Compare the key in constant time. Store it outside the repo | — |
| A custom header name is allowed only when this server is a third party the client did not build | [config.md](../config.md) |

## Client

`auth_mode: "api_key"` and

```json
{ "headers": [{ "name": "Authorization", "secretKey": "api_key", "scheme": "Bearer" }] }
```

The secret lives in `mcp_server_secrets`, encrypted. No OAuth discovery, no consent page, no chat link.

## Probe

```bash
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/charts/mcp --scenario api_key --token "$KEY"
```

Expect 401 with no `resource_metadata` when the key is absent, and 200 when it is present.

## Reference

`sharpsir-charts-mcp-server` (`https://intranet.sharpsir.group/charts/mcp`). `qobrix-crm-mcp` accepts `api_key` on the same endpoint as `oauth_user`; the header selects.
