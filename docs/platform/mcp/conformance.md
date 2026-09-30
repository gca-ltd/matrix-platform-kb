# MCP conformance

## Probe

From this repo:

```bash
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/qobrix-crm/mcp
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/msa/mcp --token "$TOKEN"
node tools/mcp-conformance/probe.mjs https://intranet.sharpsir.group/qobrix-crm/mcp --consent-url 'https://intranet.sharpsir.group/qobrix-crm/mcp-oauth/login?login_id=<open-login>'
```

Qobrix consent is served by the authorization server. `/qobrix-crm/mcp/consent` is 404, so the probe skips that check unless `--consent-url` points at a rendered login page. An unknown login id returns the card.

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
| Auth page | `GET <mcp-url>/consent?e=invalid` HTML contains `data-matrix-auth-page="1"`. A 404 is SKIP. Pass `--consent-url` when consent is served by a separate authorization server. |
| Sign-in landing | `GET {appBaseUrl}/oauth/mcp-callback.html?ok=1` returns 200 and contains `data-matrix-auth-page="1"` (`--app-base`). The old path redirects to this page. |

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

## Compliance matrix

Filled from the 2026-09-30 review after the fixes in that change. `pass` means the code follows the rule. `gap` means a follow-up is still open.

| Rule | MSA | Qobrix | Digital Employees |
|---|---|---|---|
| T-1 … T-5 transport | pass | pass | pass (client) |
| T-6 annotations | pass | pass | pass (policy) |
| T-7 output caps | pass | pass | n/a |
| T-8 isError + next_step | pass | pass | n/a |
| T-10 instructions shape | pass | pass | pass when the client stores them |
| T-11 no link in a tool result | pass | pass | n/a (the client owns the link) |
| RS-1 … RS-7 | pass | pass | n/a |
| AS-1 … AS-9 | pass | pass | n/a |
| AS-10 consent memory | pass (browser cookie) | pass (signed cookie when a key is stored) | n/a |
| AS-11 shared card | pass | pass | pass (landing page) |
| C-1 … C-18 | n/a | n/a | pass, including instructions and the step-up gate |
| C-19 connect tool | n/a | n/a | pass |

## Drift register

These servers are outside this change. A follow-up plan tracks them.

| Server | Where | Drift |
|---|---|---|
| Xero | `sharpsir-xero-mcp-server` | Still documents Modes A–D. Terminology check fails. |
| Ask Google | `ask-google-mcp-server` | Still documents Mode D. Terminology check fails. |
| Charts | `sharpsir-charts-mcp-server` | `api_key` Streamable HTTP. Missing `destructiveHint` and `whoami`. |
| Topixe | `topixe/mcp` | Retired signed-header connect. Not on the intranet. |
| ITSM `mcp-server` | `matrix-itsm` | Chat identity headers are still documented. |
| datacore MCP | Supabase | Header comment still says Mode B. |
| curated-list MCP | Supabase | Custom `x-mcp-api-key` header. |
| HU site MCP functions | Supabase | `api_key`. Closer to the profile. |

## Server probe results

| Server | Date | Probe | Notes |
|---|---|---|---|
| `qobrix-crm/mcp` | 2026-09-30 | 9 pass, 3 skipped, 0 failed (`--scenario oauth_user`) | Health, metadata, foreign redirect, and the Russian problem card passed. Session follow-up and protocol version need a bearer token. |
| `msa/mcp` | 2026-09-30 | 9 pass, 3 skipped, 0 failed (`--scenario oauth_user`) | Same anonymous checks, including the consent card at `/msa/mcp/consent`. |
| DeepWiki / Linear / GitHub / legacy SSE | 2026-09-29 | not run | Needs a signed-in Digital Employees session. |
| Claude / Cursor | 2026-09-29 | not run | Needs an operator browser login. |
