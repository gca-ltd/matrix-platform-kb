# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Sharp Matrix platform. Each ADR documents a significant architectural choice, its context, and consequences.

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001.md) | Why Supabase over Firebase/Hasura for CDL | Accepted |
| [ADR-002](ADR-002.md) | Why dual-Supabase (SSO + per-app DB) over schema-based multi-tenancy | Accepted |
| [ADR-003](ADR-003.md) | Why Lovable as the app builder | Accepted |
| [ADR-004](ADR-004.md) | Why Databricks for ETL over dbt/Airbyte/Fivetran | Accepted |
| [ADR-005](ADR-005.md) | Why RESO DD 2.0 as interop layer with Dash as practical core | Accepted |
| [ADR-006](ADR-006.md) | Why FastAPI + OData 4.0 for the RESO Web API | Accepted |
| [ADR-007](ADR-007.md) | Why Edge Functions over traditional backend (Deno runtime) | Accepted |
| [ADR-008](ADR-008.md) | Why 5-level scope hierarchy over simpler RBAC | Accepted |
| [ADR-009](ADR-009.md) | Why medallion architecture (Bronze/Silver/Gold) for ETL | Accepted |
| [ADR-010](ADR-010.md) | Why PM2 + cron over Kubernetes/ECS for pipeline orchestration | Accepted |
| [ADR-011](ADR-011.md) | ES256 JWT Signing — Migration from HS256 | Accepted (in progress) |
| [ADR-012](ADR-012.md) | Dedicated Matrix CDL Supabase project (separate from SSO) | Accepted |
| [ADR-013](ADR-013.md) | `matrix-platform-foundation` owns both SSO and CDL projects | Accepted |
| [ADR-014](ADR-014.md) | Unified MLS ingestion pipeline (sources → staging → merge) | Accepted |
| [ADR-015](ADR-015.md) | CDL Pipeline EF Surface — broker-scope CRUD for Matrix Pipeline | Proposed (largely folded into ADR-016) |
| [ADR-016](ADR-016.md) | Canonical-into-CDL acceleration for matrix-pipeline 2.0 | Accepted |
| [ADR-017](ADR-017.md) | Browser SSO token storage — localStorage now, BFF/httpOnly remediation path | Accepted |
| [ADR-018](ADR-018.md) | SSO issuer URL + Supabase Third-Party Auth for own-DB apps (ES256 completion) | Accepted |
| [ADR-019](ADR-019.md) | Server-managed PKCE for first-party public clients (webview-proof login) | Accepted |
| [ADR-020](ADR-020.md) | Per-tenant, per-locale UI label/terminology overrides (tenant_key axis + `App.*` namespace + Hungarian) | Accepted |
| [ADR-021](ADR-021.md) | Runtime DB-driven i18n: single bundled English baseline + CDL `app_ui_strings` corpus + `app-i18n` EF (platform standard) | Accepted |
| [ADR-022](ADR-022.md) | Buyer-to-showing linkage as a Sharp Matrix platform extension (`x_contact_key`) | Accepted |
| [ADR-023](ADR-023.md) | Platform extension prefix `x_` (supersedes `x_sm_`) | Accepted |
| [ADR-024](ADR-024.md) | CDL lookup-value normalization layer (canonical RESO StandardValues) | Accepted |
| [ADR-025](ADR-025.md) | Referral + Document as project-flavour CDL resources; offer-economics deferred (zero-`x_`) | Accepted |
| [ADR-026](ADR-026.md) | Event-sourced transaction model on canonical homes; Pipeline owns the Property transaction phase | Accepted |
| [ADR-027](ADR-027.md) | Console-managed Third-Party Auth provisioning for own-DB apps | Accepted |
| [ADR-028](ADR-028.md) | CRM-internal Commission Engine (ERP-lite); app-private, per-country rules, role-config + JWT-scope authz, Finance-ERP reconciliation | Accepted |
| [ADR-029](ADR-029.md) | "Contract agreed" = Pending edge; close = settlement; pipeline stage projection; per-country collection anchor | Accepted |
| [ADR-030](ADR-030.md) | Promote transaction linkage from `HistoryTransactional.raw` to a governed `x_transaction_key` extension | Proposed |
| [ADR-031](ADR-031.md) | matrix-pipeline may provision and AD-sync a CDL Member from Active Directory via `cdl-write` (canonical `member_alternate_id` + `office_name`) | Accepted |
| [ADR-032](ADR-032.md) | Chat-identity binding + delegated minting for the ITSM MCP (chat agent) | Obsolete — see ADR-039 |
| [ADR-033](ADR-033.md) | Buyer↔showing linkage as the `showing_participation` project-flavour resource (supersedes the `x_contact_key` extension / ADR-022) | Accepted |
| [ADR-034](ADR-034.md) | Opportunity as a stored CDL super-resource (`opportunity`/`opportunity_link`) with a calculated (never materialized) pipeline stage; amends ADR-029; demotes `transaction_management` to a sub-resource | Superseded by ADR-035 |
| [ADR-035](ADR-035.md) | Opportunity (`opportunity`/`opportunity_link`) relocated from the CDL to the Pipeline App DB (Lovable-owned), accessed directly via the supabase client under SSO-claim RLS; stage still calculated, links still loose-key; supersedes ADR-034 | Accepted |
| [ADR-036](ADR-036.md) | Qobrix-vanilla-inside: internal naming traces to the Qobrix OpenAPI spec, deviations are `x_` extensions (dictionary + registry), UI terminology is an app-local i18n label layer (`qobrix.*`/`x.*`/`app.*`) in the app's own DB | Accepted |
| [ADR-037](ADR-037.md) | Interactive term definitions: Qobrix → RESO → custom priority, Definitions mode + click-through term sidebar (label + definition governance) | Accepted |
| [ADR-038](ADR-038.md) | ITSM is ES256-only (SSO bearer + MCP issuer) | Obsolete — see ADR-039 |
| [ADR-039](ADR-039.md) | MCP reference architecture: the Qobrix stack (modes A–D, RS/AS split, introspection + vault) | Accepted |
| [ADR-040](ADR-040.md) | Digital Employees MCP client contract (five auth modes, principal model, encrypted tokens) | Accepted |
| [ADR-041](ADR-041.md) | Single-path Qobrix MCP (auto routing on `/mcp`); vanilla chat baseline | Accepted |
| [ADR-042](ADR-042.md) | Per-client_id SSO localStorage namespacing for co-hosted Matrix SPAs | Accepted |
| [ADR-043](ADR-043.md) | Person-keyed MCP grants and OAuth consent binding (Digital Employees) | Accepted |
| [ADR-044](ADR-044.md) | Qobrix Opportunity surface partition (Leads vs Pipeline) + copy-on-write | Accepted (D3c/D3d → ADR-050) |
| [ADR-045](ADR-045.md) | Permission reads fail loud, not fail closed/open (ProtectedRoute three-state + telemetry) | Accepted |
| [ADR-046](ADR-046.md) | Qobrix broker → SSO identity as a persisted map; only exact-email and confirmed matches own a deal | Accepted |
| [ADR-047](ADR-047.md) | Qobrix copy ownership preserved; manager-approved claims on mismatch | Accepted |
| [ADR-048](ADR-048.md) | Agent-configured chart rendering and image-output conventions | Accepted |
| [ADR-049](ADR-049.md) | HU listings MCP on Supabase Edge Function (Mode B) | Accepted |
| [ADR-050](ADR-050.md) | Retire Qobrix service account — MSA thin client under caller tokens | Accepted |
| [ADR-051](ADR-051.md) | Live Qobrix read for CRM lists — supersede ADR-050 D1 read half | Accepted |
| [ADR-052](ADR-052.md) | Two-source virtual dataset — Qobrix + App DB merge contract | Accepted |
| [ADR-053](ADR-053.md) | In-app build-status surface — repo Markdown, structure-agnostic renderer, `alwaysVisible` nav | Accepted |
| [ADR-054](ADR-054.md) | Pipeline board visibility prefs — `saved_here_only` + Won/Lost column toggle | Accepted |
| [ADR-055](ADR-055.md) | Immutable github-watcher releases + atomic symlink publish + classified timeouts | Accepted |
