# Matrix MCP servers

> **Platform reference (2026-08-21):** the production MCP stack is
> [`qobrix-crm-mcp`](https://github.com/gca-ltd/qobrix-crm-mcp) +
> [`qobrix-crm-mcp-oauth`](https://github.com/gca-ltd/qobrix-crm-mcp-oauth).
> See [ADR-039](../architecture/decisions/ADR-039.md). Digital Employees' client
> contract is [ADR-040](../architecture/decisions/ADR-040.md) /
> [mcp-client.md](mcp-client.md).

## Reference: Qobrix CRM MCP

| Property | Value |
|---|---|
| Resource Server | `gca-ltd/qobrix-crm-mcp` (Apache-2.0) |
| Authorization Server | `gca-ltd/qobrix-crm-oauth` (proprietary) |
| Live Mode D URL | `https://intranet.sharpsir.group/qobrix-crm/mcp` |
| AS issuer (intranet) | `https://intranet.sharpsir.group/qobrix-crm/mcp-oauth` |
| Transport | Streamable HTTP (JSON-RPC) |
| Tools | 64 read-only CRM + analytics tools |
| Auth modes | A stdio · B headers · C server-managed OAuth · D remote Bearer (Claude/Dust) |

### Mode summary

- **B** — trusted callers send `X-Api-User` / `X-Api-Key` per request.
- **C** — northbound clients send no bearer; tools return a `/connect` URL; MCP holds per-user sessions.
- **D** — unauthenticated `/mcp` returns `401` + `WWW-Authenticate: Bearer resource_metadata=…`; client completes OAuth against the AS; subsequent calls carry `Authorization: Bearer`.

Protected Resource Metadata is published at path-aware well-known URLs (RFC 9728). Tokens are opaque and audience-bound; the RS introspects with a shared secret. Revoking the vaulted Qobrix API key makes introspection return `credentials_revoked` → RS 401 → clients must re-authorize with a **real** URL.

Full install/user guides live in the two repos' `docs/`.

---

## Legacy: property-side `matrix-mcp` (MLS / CDL)

> **Status: legacy demo.** Do not use as a template for new remote MCP servers.
> Auth is a shared HS256 JWT (`SUPABASE_JWT_SECRET`) on `/mcp`, which is
> **non-compliant** with MCP remote authorization since 2025-03-26 and conflicts
> with ADR-011's ES256 direction.

| Property | Value |
|---|---|
| Repo | [`matrix-mcp`](https://github.com/sharpsir-group/matrix-mcp) |
| Role | Read-only MCP over CDL listings / brokers / geo |
| Public endpoint | `https://mls.sharpsir.group/matrix/mcp/` |
| Auth | Shared HS256 bearer (legacy) |

Tools include `search_listings`, `search_by_text`, `get_listing_details`, `geo_search`, `broker_directory`. Schema alignment follows [cdl-schema.md](../data-models/cdl-schema.md). Ops: `matrix-ops` → `runbooks/matrix-mcp.md`.

---

## Sharp SIR Charts

[`gca-ltd/sharpsir-charts`](https://github.com/gca-ltd/sharpsir-charts) is a
public MIT-licensed, local/server-side Chart.js rendering MCP. It is an
image-output utility rather than a data-resource server: callers supply JSON
data and receive PNG, SVG, PDF, or resolved JSON configuration plus an inline
preview.

| Property | Value |
|---|---|
| Repository | `gca-ltd/sharpsir-charts` |
| Transport | stdio; Streamable HTTP on the operator-managed port 3512 |
| Hosted endpoint | `https://intranet.sharpsir.group/charts/mcp` |
| Output path | `/charts/o/` static fallthrough for full-resolution images |
| Default design | `sothebys` — warm paper, SIR Blue, restrained gold, Playfair Display + Inter |
| Design state | Session-scoped, memory-only; server default → session base → per-call override |
| Tools | Five render tools plus strict design discovery/configuration tools |

The server follows the chart-selection and reduced-chrome guidance in the
Sharp SIR repository's design-system documentation. Agents should render
without configuration first; they may call `describe_design_schema`,
`get_design_reference`, `configure_design`, and `preview_design` when a
controlled variation is needed. JavaScript callbacks and inline styling are
stripped or warned.

### Deliberate divergence from ADR-039

This utility does **not** implement the Qobrix data Resource Server /
Authorization Server split from [ADR-039](../architecture/decisions/ADR-039.md).
That architecture is normative for public MCP servers exposing protected
Matrix data. Sharp SIR Charts is a local rendering helper with no data access,
no per-user upstream credentials, and no private business-data tools. Stdio
uses process-local trust; hosted HTTP uses an operator-managed bearer token
behind loopback-bound Apache. If the service later gains protected data tools,
it must adopt ADR-039's OAuth Resource Server contract before that expansion.
