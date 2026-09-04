# Sharp Matrix Platform — Knowledge Base Index

> **© 2024–2026 Sharp Sotheby's International Realty and GCA Global.** Proprietary corporate knowledge base — authorized AI agents (Cursor, Lovable) acting for Sharp or GCA Global may read it; anyone unaffiliated may not reproduce or use it in any form, even with technical access. See [`LICENSE`](../LICENSE).
>
> Master index for the LLM-readable knowledge base.
> Each chapter is self-contained. Start here, then navigate to the chapter you need.
>
> **For Lovable**: Before building any app, read `platform/app-template.md` first.
>
> **For RESO-aligned navigation**: read [`integration/overview.md`](integration/overview.md) for the layered stack
> (Layer 1 RESO data model → Layer 2 source mappings → Layer 3 canonical state machines →
> Layer 5 cross-cutting per-resource views). Project-flavour CRM behaviour lives in
> [`product-specs/matrix-pipeline/`](product-specs/matrix-pipeline/INDEX.md) — not in this layer cake.

## Chapter 0: Platform Overview

What Sharp Matrix is, the three-platform architecture (Supabase + Databricks + Lovable), the app template, and the data pipeline.

| Document | Description |
|----------|-------------|
| [platform/app-template.md](platform/app-template.md) | **Read first** — How to build Matrix Apps: dual-Supabase, SSO, permissions, RLS, HRMS example |
| [platform/index.md](platform/index.md) | Platform overview, three-platform architecture, migration roadmap |
| [platform/mls-datamart.md](platform/mls-datamart.md) | MLS 2.0 data pipeline: Databricks ETL, CDC, Supabase CDL sync, phased migration |
| [platform/ecosystem-architecture.md](platform/ecosystem-architecture.md) | Full ecosystem: channels, apps, data & analytics, AI/ML, external services |
| [platform/app-catalog.md](platform/app-catalog.md) | All platform apps and components (11 live, 7 in progress, 6 planned) with delivery status |
| [platform/matrix-mcp-server.md](platform/matrix-mcp-server.md) | Matrix MCP server (MLS/property): AI-agent access layer over CDL — endpoint, 5 tools, JWT auth, integration guide |
| [platform/security-model.md](platform/security-model.md) | Security model: 5-level scope, 23 roles, JWT claims, RLS patterns A-E |
| [platform/security-audit-runbook.md](platform/security-audit-runbook.md) | Weekly infosec audit: Advisors + Matrix SQL + project inventory |
| [platform/operations.md](platform/operations.md) | Operations: CI/CD, deployment, monitoring, logging, audit trail, DR/backup |
| [platform/compliance.md](platform/compliance.md) | Compliance: GDPR, data protection, retention policy, DSAR procedures |
| [platform/kb-methodology.md](platform/kb-methodology.md) | KB design principles, versioning, contribution guidelines |
| [platform/testing-strategy.md](platform/testing-strategy.md) | Testing: unit (Vitest), integration, E2E (Playwright), contract testing |
| [platform/api-contracts.md](platform/api-contracts.md) | Edge Function API surface, OpenAPI reference, per-app dependencies |
| [platform/alignment-audit-playbook.md](platform/alignment-audit-playbook.md) | Harness-style audit playbook: eliminate DB ↔ types ↔ code ↔ UI ↔ EF ↔ permission-key drift |

## Chapter 1: Vision & Strategy

The digital strategy 2026-2028 and AI-driven sales model for three markets (Cyprus, Hungary, Kazakhstan).

| Document | Description |
|----------|-------------|
| [digital-strategy-2026-2028.md](vision/digital-strategy-2026-2028.md) | Full digital strategy: 3 markets, client segments, 7-phase roadmap, KPI targets |
| [ai-driven-sales-model.md](vision/ai-driven-sales-model.md) | 4-element AI-driven sales model with customer journeys and AI Copilot spec |
| [core-beliefs.md](vision/core-beliefs.md) | Operating principles, platform beliefs, agent-first design philosophy |

## Agent-First Governance

Engineering invariants, quality tracking, execution plans, and validation — structured for agent-first workflows.

| Document | Description |
|----------|-------------|
| [platform/golden-principles.md](platform/golden-principles.md) | Engineering invariants and taste rules — token, scope, client, and Lovable maintenance rules |
| [exec-plans/quality-score.md](exec-plans/quality-score.md) | Domain quality grades (A-D) across docs, tests, reliability, architecture |
| [exec-plans/index.md](exec-plans/index.md) | Execution plan format, lifecycle, and usage guide |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) | Known technical debt by domain with severity and ownership |

## Chapter 2: System Architecture

Three-platform architecture: Supabase (CDL), Databricks (DWH), Lovable (app builder). Phased data flow evolution.

| Document | Description |
|----------|-------------|
| [architecture/overview.md](architecture/overview.md) | Technology map, three-platform architecture, dual-Supabase, data flow |
| [architecture/decisions/index.md](architecture/decisions/index.md) | Architecture Decision Records (ADR-001…); latest: [ADR-055](architecture/decisions/ADR-055.md) Immutable github-watcher releases + atomic symlink publish |
| [architecture/intelligence-layer.md](architecture/intelligence-layer.md) | **Phase-2 roadmap** — semantic + algebraic search, recsys, MCP server, syndication channels. Phase-1 → Phase-2 contract (pgvector + embeddings + `marketing_metadata`). |
| [architecture/data-distribution-and-stewardship.md](architecture/data-distribution-and-stewardship.md) | **Phase-2.5 roadmap** — source-of-record & listing lifecycle, channel distribution rules, multi-source merge precedence, field-level overrides (data stewardship). Four source kinds: `internal` (matrix-internal — target state), `legacy-internal` (Qobrix CY — sunsetting), `brand-network` (Anywhere Dash — bidirectional SIR-affiliate primary; covers HU + KZ inbound today), `external` (developers, partner brokerages). Phase-1 → Phase-2.5 contract (`mls_sources.kind` + `is_sunsetting` + `sunset_at` + `lifecycle_state` + `property_lifecycle_events` + `locked_fields` + `property_field_overrides` + `cdl_lock_field` RPCs). |

## Chapter 3: Data Models

Dash/Anywhere.com as the practical core data model. RESO DD 2.0 as interop standard. ETL pipeline. Platform extensions.

| Document | Description |
|----------|-------------|
| [dash-data-model.md](data-models/dash-data-model.md) | **Start here for Dash field names** — Dash/Anywhere.com practical field reference (50+ fields, 30+ features, media) |
| [data-models/reso-dd-kb/USAGE.md](data-models/reso-dd-kb/USAGE.md) | **Start here for any RESO DD 2.0 question** — canonical model, 41 resources, 1,745 fields, 222 lookups, DBML schema, agent-facing per-resource docs |
| [data-models/source-mappings/USAGE.md](data-models/source-mappings/USAGE.md) | **Cross-source mapping** — bridge Dash / Qobrix / SIR to RESO DD: 96 curated rows across 6 resources, `x_*` extension governance, 5 hard-fail join gates |
| [reso-dd-overview.md](data-models/reso-dd-overview.md) | REDIRECT → `data-models/reso-dd-kb/` (kept for inbound link compatibility) |
| [reso-canonical-schema.md](data-models/reso-canonical-schema.md) | REDIRECT → `data-models/reso-dd-kb/` (kept for inbound link compatibility) |
| [platform-extensions.md](data-models/platform-extensions.md) | All 28 `x_*` extensions: fields and lookup values not in RESO DD |
| [cdl-schema.md](data-models/cdl-schema.md) | **CDL Schema** — canonical listings + 8 RESO resource tables + stewardship + lifecycle + SIR brand markers + 7 `v_dash_*` projection views + Phase-2 pgvector placeholders |
| [read-path-performance.md](data-models/read-path-performance.md) | **Read-path performance contract** — `properties_published` indexes, `listings-search` keyset pagination + ETag/Cache-Control + estimated counts + p50/p95/p99 budgets |
| [etl-pipeline.md](data-models/etl-pipeline.md) | Bronze/Silver/Gold ETL pipeline: table schemas, notebooks, CDC |
| [data-contracts.md](data-models/data-contracts.md) | ETL schema contracts: layer boundaries, JSON Schema, validation |
| [data-quality.md](data-models/data-quality.md) | Data quality: verification scripts, RESO validation, email reporting |
| [reso-web-api.md](data-models/reso-web-api.md) | RESO Web API (OData 4.0): endpoints, queries, auth, office filtering |
| [qobrix-data-model.md](data-models/qobrix-data-model.md) | Qobrix CRM reference & legacy migration source |
| [property-field-mapping.md](data-models/property-field-mapping.md) | Cross-reference: Dash ↔ RESO ↔ Qobrix ↔ SIR field mapping |

## Chapter 4: Business Processes

Canonical, RESO-aligned business process state machines. Project-flavour CRM behaviour lives in [`product-specs/matrix-pipeline/`](product-specs/matrix-pipeline/INDEX.md).

| Document | Description |
|----------|-------------|
| [business-processes/canonical-processes/USAGE.md](business-processes/canonical-processes/USAGE.md) | **Canonical baseline (vendor-neutral, RESO-aligned)** — 10 process docs (Listing, Showing, OpenHouse, Lead-Contact, Transaction, Member/Office/Team onboarding, Caravan, Media) with mermaid state diagrams, transition tables, and machine-validated RESO citations (709 citations) |

## Chapter 4.5: Integration views (Layer 5 cross-cutting)

Per-resource one-stop pages joining Layer 1 (canonical RESO), Layer 2 (source mappings),
and Layer 3 (canonical state machines). Generated, deterministic, zero-hand-edits under `wiki/agent-docs/`.

| Document | Description |
|----------|-------------|
| [integration/overview.md](integration/overview.md) | **Master layer-cake** — how the three substantive layers compose, decision tables for picking the right layer, harness-engineering invariants |
| [integration/USAGE.md](integration/USAGE.md) | Task-oriented entry points: "show me everything about resource X", re-emit instructions |
| [integration/wiki/agent-docs/_index.md](integration/wiki/agent-docs/_index.md) | Generated catalogue of 36 per-resource integrated views with layer-coverage matrix |

## Chapter 5: Product Specifications

Per-app product specs. The `matrix-pipeline/` subtree is the single source of truth for the CRM (canonical RESO DD 2.0 strict + two documented escape hatches: `Referral` entity + Commission Engine ERP-lite). Other rows describe distinct apps.

| Document | Description |
|----------|-------------|
| [product-specs/matrix-pipeline/INDEX.md](product-specs/matrix-pipeline/INDEX.md) | **`matrix-pipeline` CRM LLM Wiki** — compact Karpathy-pattern wiki for the Sharp SIR luxury sales CRM. 8 wiki pages (overview / architecture / entities / processes / requirements / ai / integration / commission-engine) + `phases.md` 8-week atomic build plan (Lovable + Cursor swimlanes) + [`roadmap.md`](product-specs/matrix-pipeline/roadmap.md) (**outcome-based long-term journey + agent coordination surface** — `O-*` milestones keyed to KPI groups + FR clusters) + `raw/context-v2.md` (immutable BRD) + `cdl-crud-contract.md`. Strictly canonical RESO DD 2.0 with two documented escape-hatch deviations: `Referral` entity + CRM-internal Commission Engine. **Single source of truth for CRM**. |
| [product-specs/sir-listing-forms.md](product-specs/sir-listing-forms.md) | SIR/Anywhere.com form field specs (reference for Listing Module field mapping) |
| [product-specs/client-portal.md](product-specs/client-portal.md) | Matrix Portal — buyer/seller self-service spec |
| [product-specs/marketing-platform.md](product-specs/marketing-platform.md) | Matrix Marketing — campaign management spec |
| [product-specs/personalization.md](product-specs/personalization.md) | Personalization & recommendation engine (Phase-4 cross-app feature) |

## Chapter 6: References

Raw API catalogs, data dictionary summaries, and source repositories.

| Document | Description |
|----------|-------------|
| [qobrix-api-summary.md](references/qobrix-api-summary.md) | Qobrix OpenAPI resource & endpoint catalog (83 resources, 149 schemas) |
| [reso-dd-fields-summary.md](references/reso-dd-fields-summary.md) | REDIRECT → `data-models/reso-dd-kb/wiki/agent-docs/_index.md` |
| [data-models/reso-dd-kb/wiki/agent-docs/_index.md](data-models/reso-dd-kb/wiki/agent-docs/_index.md) | **Canonical RESO DD 2.0 agent docs** — resource catalogue with FK counts, domain grouping, full field tables |

---

## Chapter 7: Zoe AI Assistant Knowledge Base

RAG-optimized support documentation for the Zoe AI assistant — 1st line support for end users and 2nd line technical reference.

| Document | Description |
|----------|-------------|
| [zoe-ai-assistant-kb/index.md](zoe-ai-assistant-kb/index.md) | Zoe AI KB index — purpose, audience, document list |
| [zoe-ai-assistant-kb/platform-overview.md](zoe-ai-assistant-kb/platform-overview.md) | Platform overview for users — all apps, getting started, cross-app troubleshooting, incident guide, glossary |
| [zoe-ai-assistant-kb/portal.md](zoe-ai-assistant-kb/portal.md) | Agency Portal — dashboard, app launcher, AI Advisor, stats, Quick Access |
| [zoe-ai-assistant-kb/client-connect.md](zoe-ai-assistant-kb/client-connect.md) | Client Connect — registration, verification, MLS duplicate check, approval workflow |
| [zoe-ai-assistant-kb/meeting-hub.md](zoe-ai-assistant-kb/meeting-hub.md) | Meeting Hub — appointments, buyer/seller/tenant/landlord forms, analytics, reports |
| [zoe-ai-assistant-kb/comms.md](zoe-ai-assistant-kb/comms.md) | Matrix Comms — WhatsApp messaging, conversations, templates, campaigns, AI replies |
| [zoe-ai-assistant-kb/pipeline.md](zoe-ai-assistant-kb/pipeline.md) | Matrix Pipeline — leads, deal pipeline, contacts, MLS data, M365 email/calendar, call center |
| [zoe-ai-assistant-kb/hrms.md](zoe-ai-assistant-kb/hrms.md) | Matrix HR Management — employee directory, vacations, onboarding/offboarding, performance, documents |
| [zoe-ai-assistant-kb/itsm.md](zoe-ai-assistant-kb/itsm.md) | ITSM — IT service desk, assets, software licenses, vendors, projects, budgets |
| [zoe-ai-assistant-kb/financial-management.md](zoe-ai-assistant-kb/financial-management.md) | Matrix Financial Management — monthly/annual reporting, budgeting, planning, CORE allocation |
| [zoe-ai-assistant-kb/platform-sso-auth.md](zoe-ai-assistant-kb/platform-sso-auth.md) | SSO & Auth — login, roles, permissions, scope, SSO Console, user management |
| [zoe-ai-assistant-kb/second-line-tech-reference.md](zoe-ai-assistant-kb/second-line-tech-reference.md) | 2nd Line Support — technology overview, architecture, links to deep-dive docs |
| [zoe-ai-assistant-kb/kb-generation-guide.md](zoe-ai-assistant-kb/kb-generation-guide.md) | How to generate a support KB article for any new Matrix app |
| [zoe-ai-assistant-kb/ai-chat-webhook-spec.md](zoe-ai-assistant-kb/ai-chat-webhook-spec.md) | Website AI chat lead-webhook spec |

---

## How to Use This Knowledge Base

**For Lovable (building Matrix Apps):**
1. Read `platform/app-template.md` — the template patterns you must follow
2. Determine if your app is CDL-Connected or Domain-Specific
3. If CDL-Connected: read `data-models/dash-data-model.md` for practical field names
4. Read the relevant `business-processes/` doc for workflow logic
5. Use Dash-derived field names for all CDL table columns (RESO names for syndication only)
6. Follow the dual-Supabase, SSO, RLS patterns from the template
7. For security model details: see `platform/security-model.md`
8. For deployment and operations: see `platform/operations.md`
9. For data protection (GDPR): see `platform/compliance.md`

**For general context:**
1. Start with `AGENTS.md` (repository root) for quick navigation
2. Read Chapter 0 (Platform) to understand the three-platform architecture
3. Read Chapter 1 (Vision) for strategic context
4. Navigate to the specific chapter relevant to your task
