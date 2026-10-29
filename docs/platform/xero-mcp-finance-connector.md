# Xero Advanced MCP — finance connector (Sharp Matrix)

**Repo:** `gca-ltd/sharpsir-xero-mcp-server`  
**Production MCP:** `https://intranet.sharpsir.group/xero/mcp`  
**Conformance baseline:** [mcp/conformance.md](./mcp/conformance.md) (multi-org, tool groups)

## Role

Xero is the **finance ERP / system of record** for Sharp SIR holding entities. The MCP exposes Accounting API tools to Claude and Cursor under **per-user OAuth** (Modes C/D). It does **not** replace Xero UI for all tasks; it automates high-friction flows (bank statement coding, cross-org reads, reports).

## Bank statement loading (manual banks)

Revolut uses a native Xero feed. Other banks: operators attach statements in Claude; the agent:

1. `get-org-guide` — divisions, cost centres, manual vs feed accounts (`packages/mcp/data/org-guides/`).
2. `suggest-bank-coding` — history from past bank transactions (no Xero Bank Rules API).
3. `create-bank-transactions` — batch up to 50 lines; **dryRun defaults true**; Inclusive amounts; refuses feed accounts.
4. `verify-bank-load` — control totals vs statement.
5. `mark-bank-transactions-reconciled` — only after verify pass (30-minute gate).

**Anti-patterns:** posting to feed accounts; reconcile before verify; skipping dry-run approval.

## Scopes and reports

Default Web App uses **granular** scopes (March 2026+). Official **Profit and Loss** and **Balance Sheet** reports may require `accounting.reports.profitandloss.read` / App Partner Program on new apps. Fallback: `report-pnl-by-tracking` + `list-trial-balance` tie-out.

## Plan

Production app is on Xero **Core** (50 connections, 5k calls/org/day).

## KB sources

- Xero Limits FAQ, Bank Transactions API, granular scopes devblog (2026).
- Sharp Matrix meeting 2026-10-29 (Artur / Sergey) — pilot workflow.
