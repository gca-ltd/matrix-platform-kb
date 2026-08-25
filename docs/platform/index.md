# Chapter 0: Sharp Matrix Platform — Overview

> The Sharp Matrix Platform is the target digital ecosystem for Sharp Sotheby's International Realty.
> It connects all business applications through a common data layer with Dash/Anywhere.com as the practical data model.
>
> **For Lovable**: To build apps, start with [app-template.md](app-template.md).

## What is Sharp Matrix?

Sharp Matrix is a **multi-app platform** where every application — from broker tools to client portals to AI engines — shares a single, consistent data layer. Dash/Anywhere.com provides the practical field definitions used for app development; RESO DD 2.0 serves as the interoperability standard for syndication and external APIs. Apps are built by **Lovable** using the `matrix-apps-template-2-1` starter kit and run on **Supabase**.

### Core Principle

> **Dash/Anywhere.com is the practical data core.** CDL-Connected apps use Dash-derived field names (e.g., `list_price`, `bedrooms`, `city`). RESO DD names are used for outbound syndication and the RESO Web API.

## Three-Platform Architecture

| Platform | Role | Why |
|----------|------|-----|
| **Supabase** | Common Data Layer — system of record for apps | Edge Functions, Realtime, Auth, RLS, Lovable integration |
| **Databricks** | DWH & ETL engine — data ingestion and analytics | Medallion architecture (Bronze/Silver/Gold), CDC, SQL analytics |
| **Lovable** | App builder — builds all Matrix Apps | Rapid development, native Supabase integration |

**Why Supabase over Databricks for CDL?** Databricks (with Lakebase) is a strong DWH but lacks Edge Functions and has no Lovable integration. Supabase provides the app-facing data layer with built-in auth, realtime, and edge compute.

## Two Types of Matrix Apps

| Type | CDL Usage | Live | In Progress | Planned |
|------|-----------|------|-------------|---------|
| **CDL-Connected** | Reads/writes shared RESO tables (`property`, `member`, `contacts`, `saved_search`, `showing_appointment`, `transaction_management`, …) | Agency Portal, Client Connect, Meeting Hub, Matrix Comms, Website CMS | Matrix Pipeline 2.0 (consolidates broker / manager / contact-center / listing-coordinator workflows), Integration Mgmt | Client Portal, Marketing App |
| **Domain-Specific** | Uses CDL only for auth/permissions; has own Supabase instance | SSO Console | HRMS, Matrix FM, ITSM, Notification Mgmt | Admin Console, BI Dashboard |

Both types share the same template patterns: dual-Supabase, SSO auth, permissions, RLS, shadcn/ui.
See [app-template.md](app-template.md) for full technical details.

**Platform infrastructure (Done):** App Builder Template, EDW + MLS Pipelines (Databricks).
**AI services (Done):** AI Web Assistant, Zoe AI Assistant, AI Blog Generator.

## Reference Sources

| Source | Role in Sharp Matrix | Location |
|--------|---------------------|----------|
| **Dash / Anywhere.com** | **Practical core** — concrete field definitions for app development | `raw/dash/BlankForm_*.docx`, Dash API |
| **RESO DD 2.0** | Interop standard — names for syndication and external APIs | [`reso-dd-kb/`](../data-models/reso-dd-kb/README.md) (canonical model: mirror + raw CSVs + DBML + agent-docs) |
| **Qobrix CRM** | Legacy migration source — being decommissioned | `raw/qobrix/qobrix_openapi.yaml` |

## Phased Migration

### Current → Target

| Aspect | Current | Target |
|--------|---------|--------|
| CRM | Qobrix | Matrix Apps on Supabase |
| Data direction (Dash) | Pull from Dash API/FILE | Push to Dash for syndication |
| System of record | Qobrix + Dash | Supabase CDL |
| Data warehouse | Databricks (ETL + DWH) | Databricks (analytics/BI only) |
| App builder | N/A | Lovable |

**Strategic goal**: Matrix Apps replace Qobrix CRM. Dash flips from pull to push. Supabase CDL becomes the sole system of record.

## Documents

| Document | What It Contains |
|----------|-----------------|
| [app-template.md](app-template.md) | **Start here** — How to build Matrix Apps: stack, auth, permissions, RLS, UI |
| [security-model.md](security-model.md) | Security model: 5-level scope, 23 roles, JWT claims, RLS patterns A-E |
| [security-audit-runbook.md](security-audit-runbook.md) | Weekly infosec audit: Advisors + Matrix SQL + inventory P0–P3 |
| [operations.md](operations.md) | Operations: CI/CD, deployment, monitoring, logging, audit, DR/backup |
| [compliance.md](compliance.md) | Compliance: GDPR, data protection, retention, DSAR procedures |
| [mls-datamart.md](mls-datamart.md) | MLS 2.0 data pipeline: sources, Databricks ETL, Supabase CDL sync |
| [ecosystem-architecture.md](ecosystem-architecture.md) | Full platform architecture: channels, apps, data layer, AI/ML |
| [app-catalog.md](app-catalog.md) | All apps in the platform: purpose, users, RESO resources consumed |
| [matrix-mcp-server.md](matrix-mcp-server.md) | MCP servers: Qobrix CRM reference stack (ADR-039) + legacy property `matrix-mcp` |
| [mcp-client.md](mcp-client.md) | Digital Employees MCP client contract (ADR-040) |
| [testing-strategy.md](testing-strategy.md) | Testing: unit (Vitest), integration, E2E (Playwright), contract testing |
| [api-contracts.md](api-contracts.md) | Edge Function API surface, OpenAPI reference, per-app dependencies |
| [new-app-auth-troubleshooting.md](new-app-auth-troubleshooting.md) | Troubleshooting: new app auth failures (401/400/403), stale sessions, Lovable preview issues |
| [alignment-audit-playbook.md](alignment-audit-playbook.md) | Harness-style audit playbook: eliminate DB ↔ types ↔ code ↔ UI ↔ EF ↔ permission-key drift |
| [kb-methodology.md](kb-methodology.md) | KB design principles, versioning, contribution guidelines |

## How Apps Share Data

CDL-Connected apps operate on the same RESO-named Supabase tables:

1. **Client Connect** registers a contact → stored in RESO `contacts` table
2. **Meeting Hub** records an appointment → linked to the same contact
3. **Matrix Comms** sends a WhatsApp message → conversation attached to the same contact
4. **Matrix Pipeline** (in progress) manages leads, deals, contacts → CDL `property`, `contacts` tables + own `opportunities`, `leads` tables
5. **Agency Portal** aggregates stats → reads from all CDL tables
6. **AI Web Assistant** captures leads from website → routes to CDL contacts
7. **BI Dashboard** (planned) reports KPIs → aggregates from Databricks (synced from CDL)

Domain-Specific apps use their own Supabase instances but share auth, permissions, and UI framework through the SSO instance:
- **HRMS** (`wltuhltnwhudgkkdsvsr`) — employee records, vacations, onboarding, performance, documents
- **Matrix FM** (`retujkznogwplfrbniet`) — financial reporting, budgeting, planning, CORE allocation
- **ITSM** (`irjrcskfcyierdbefrpk`) — IT service desk, assets, software licenses, vendors, projects
- **Notification Management** (in progress) — centralized notification engine for all apps
