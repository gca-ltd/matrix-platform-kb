# Public MCP (`none`)

No credentials. Anyone who can reach the URL can call the tools. Use this for a catalogue that is already public, or for a server that runs on stdio inside a process that already holds its own credential.

Do not use it for anything that returns a person's data.

## Server

| Step | Rule |
|---|---|
| Streamable HTTP, loopback bind, Origin allowlist | T-1, T-2, T-3, T-4, T-5 |
| Every tool has `title`, `readOnlyHint`, `destructiveHint` | T-6 |
| Output caps, `isError` + `next_step`, instructions | T-7, T-8, T-10 |
| No Protected Resource Metadata. An anonymous call is **200**, not 401 | RS-1 does not apply |
| No sign-in link in a tool result | T-11 |
| Health body as in [routes.md](../routes.md), with `auth` omitted | — |

`QOBRIX_MCP_AUTH=none` on stdio is this scenario: the process uses its own env credential, and the MCP client sends nothing.

## Client

Register the URL with `auth_mode: "none"` and `auth_config: {}`. Send no `Authorization` header. Discovery (C-6) is not required.

## Probe

```bash
node tools/mcp-conformance/probe.mjs https://example.invalid/mcp --scenario none
```

Expect `initialize` 200 with no token, and no `/.well-known/oauth-protected-resource` document.

## Reference

No Matrix HTTP server is public. `qobrix-crm-mcp` uses `none` only on stdio.
