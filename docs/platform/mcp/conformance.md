# MCP conformance

## Probe

From this repo:

```bash
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/qobrix-crm/mcp
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/msa/mcp --token "$TOKEN"
```

The probe is read-only. It checks:

| Check | Expectation |
|---|---|
| `initialize` then a second request with `Mcp-Session-Id` | 200, or 200 without a session id when the server is stateless |
| Unknown session id | 404 |
| `GET` | `text/event-stream` or 405 |
| `Origin: https://evil.example` | 403 |
| `MCP-Protocol-Version: 1999-01-01` | 400 |
| No token | 401, `resource_metadata` and `scope` on `WWW-Authenticate` |
| Protected resource metadata | `resource`, `authorization_servers`, `scopes_supported` |
| Authorization server metadata | `code_challenge_methods_supported` includes `S256`, `client_id_metadata_document_supported` |
| Every tool | `title` and `annotations.readOnlyHint` |
| Dynamic registration with a foreign redirect | `invalid_redirect_uri` |
| Agent guidance | Headings, sentence-1 length, description length, described parameters, discovery tools, `tools/list` size |

Where the official `@modelcontextprotocol/conformance` package covers the same check, run it and record that result next to the probe. The package is optional; this probe is the one CI can run without a browser login.

## Terminology guardrail

```bash
node tools/mcp-conformance/check-mcp-terminology.mjs [repo-root]
```

Fails when a banned term from [glossary.md](glossary.md#retired-terms) appears outside the history allowlist (applied migrations, changelogs, `.lovable/plan/`, and the retired-terms table itself).

## Tool-selection evals

Digital Employees scores about 20 questions per server (Qobrix and MSA). Target: at least 90% correct first tool. Fill the table when a run finishes.

| Server | Date | First-tool accuracy | Notes |
|---|---|---|---|
| Qobrix | — | not run | Baseline before instruction injection |
| MSA | — | not run | After description rewrite |

## Server probe results

Filled by the verify pass. Until then every row is "not run".

| Server | Date | Probe | Notes |
|---|---|---|---|
| `qobrix-crm/mcp` | 2026-09-30 | 6 pass, 2 skipped (need token) | Anonymous probe. Session follow-up and protocol-version need a bearer token. |
| `msa/mcp` | 2026-09-30 | 6 pass, 2 skipped (need token) | Anonymous probe. Session follow-up and protocol-version need a bearer token. |
| `matrix-dsf-mcp` (HU `bpaxqtxaysolzaeguwvg`) | 2026-09-30 | 8 pass, 1 fail (PRM) | Token run after the catalogue merge. 14 tools. Auth `api_key`: protected resource metadata N/A. |
| `matrix-dsf-leads-mcp` (HU) | 2026-09-30 | 8 pass, 1 fail (PRM) | Same as site. 3 tools. Terminology guardrail clean on Storefront. |
| DeepWiki / Linear / GitHub / legacy SSE | 2026-09-29 | not run | Needs a signed-in Digital Employees session. |
| Claude / Cursor | 2026-09-29 | not run | Needs an operator browser login. |
