# Xero Advanced MCP — finance connector (Sharp Matrix)

**Repo:** `gca-ltd/sharpsir-xero-mcp-server`  
**Production MCP:** `https://intranet.sharpsir.group/xero/mcp`  
**Conformance baseline:** [mcp/conformance.md](./mcp/conformance.md) (multi-org, tool groups)

## Role

Xero is the **finance ERP / system of record** for Sharp SIR holding entities. The MCP exposes Accounting (and related) APIs to Claude and Cursor under **per-user OAuth** (Modes C/D). It is **universal**: any user, any set of organisations — no per-org files in the repo.

## Organisation profile (live)

- `get-org-profile` builds a live profile from Xero (org details, BANK accounts, tracking, tax rates, currencies) plus encrypted **tenant settings** (bank modes, coding notes).
- Bank account modes: `unset` (default) | `manual` | `feed`. Real statement posts require `manual`. Dry runs allowed on `unset`. `feed` is always blocked.
- `set-bank-account-mode` (sensitive): gated by live Xero `OrganisationRole` (`ADMIN` / `FINANCIALADVISER` by default via `BANK_MODE_ROLES`). Preview + `confirmToken` (or elicitation).
- Legacy `packages/mcp/data/org-guides/*.md` files are optional one-time seed only; `_TEMPLATE.md` documents the format.

## Bank statement loading (manual banks)

1. `get-org-profile` — confirm bank mode.
2. Admin: `set-bank-account-mode` → `manual` if needed.
3. `suggest-bank-coding` → `preview-bank-transactions` (`confirmDryRunHash`) → `create-bank-transactions` → `verify-bank-load` → `mark-bank-transactions-reconciled`.

**Anti-patterns:** posting to feed / unset accounts; reconcile before verify; skipping dry-run approval.

## Search + execute (full coverage)

Default tool surface is compact (~15 tools). Registry-driven tools cover the rest:

| Tool | Group | Role |
|---|---|---|
| `xero-search` | read | Discover resources/actions + availability (scopes, country) |
| `xero-read` | read | list/get/pdf with pagination and field trimming |
| `xero-write` | write | create/update with confirmToken + Idempotency-Key |
| `xero-delete` | sensitive | void/delete with confirmToken |

Default surface is ~22 tools: org/profile, registry (`xero-*`), bank-statement flow, `report-pnl-by-tracking`, plus bank-flow reads (`list-accounts`, `list-contacts`, `list-tracking-categories`, `list-tax-rates`, `list-bank-transactions`, `list-organisation-details`). Other thin `list-*` / `create-*` / `update-*` / `holding-*` tools remain behind `XERO_TOOLSETS=all` (legacy). Payroll API region follows org `countryCode` (AU/NZ/UK/none). Deprecated classic expenses (receipts / expense claims) are excluded.

## Capabilities and scopes

- Granted scopes are read from the access-token claim when present; otherwise Xero errors decide availability.
- Default `XERO_SCOPES` is granular (contacts, settings, attachments, invoices, payments, banktransactions, manualjournals, budgets, reports subset, assets, files, projects, payroll.*). Journals / official P&L / finance stay out unless entitled — add via env.
- The server is **plan-agnostic**: no hardcoded connection/day quotas. It reads `X-*-Remaining` headers, honours `Retry-After` on 429, and surfaces connection-limit / scope errors verbatim. Concurrent calls per tenant are capped at 5 (Xero’s documented concurrency).

## Compliance

- No request/response payloads in logs. Optional tool-call audit JSONL (`XERO_MCP_AUDIT_LOG`).
- Connecting implies consent that data may pass to the MCP client (e.g. Claude). API data must not be used to train AI models (Xero Developer Platform Terms).

## KB sources

- Xero Limits FAQ, granular scopes changelog / FAQs (2026), Developer Platform Terms, Accounting Users endpoint.
- MCP tool-design guidance (search+execute above ~30 tools).
- Sharp Matrix meeting 2026-10-29 (Artur / Sergey) — pilot workflow.
