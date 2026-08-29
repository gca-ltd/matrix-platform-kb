# Sharp Matrix Platform — App Catalog

> All applications and platform components in the Sharp Matrix ecosystem, with current delivery status.
> Last updated: June 2026
>
> **Development model**: Most Matrix business apps are **Lovable-managed projects** — changes flow through structured Lovable prompts, not direct code edits. SSO/CDL Edge Functions and database migrations are managed directly. See [app-template.md — Lovable-Managed Apps](app-template.md#lovable-managed-apps--development--maintenance-model) for details.
>
> **Exceptions (Cursor-managed, not Lovable-linked):**
> - `matrix-mls` (app DB `wckwfbbqiupvallmhqbu`) — detached from Lovable after the CDL cutover (ADR-013/014). Changes go through Cursor + git directly.
> - `matrix-cdl-studio` — **read-only CDL schema inspector** (retired as a CDL *write* surface per ADR-012/013; see `matrix-cdl-studio/RETIREMENT.md` if present). Auto-deployed by `github-watcher` on push to `main` (config key `sharpsir-group/matrix-cdl-studio`, secret env `WEBHOOK_SECRET_CDL_STUDIO`, Apache path `/cdl-studio/`). Production URL: `https://intranet.sharpsir.group/cdl-studio/`. OAuth client `pfyRzrbf1jkSVcPBW9E0uvWk2E80AH_5` — ensure redirect URI `https://intranet.sharpsir.group/cdl-studio/auth/callback` is registered (migration `20260622230000`). **RESO DD audit:** the Data Model Studio applies the platform **4-tier governance model** (canonical RESO · `x_` extension · project-flavour · infrastructure) from [`reso-crm-opportunity-lifecycle-model.md`](../data-models/reso-crm-opportunity-lifecycle-model.md) §4. Tier 1 tables are scored on **column fidelity** (present cols vs assigned RESO resource) and **resource coverage** (materialized vs full canonical field set from `reso_field_descriptions` / `reso-dd-kb`). Tier 3 tables (`referral`, `document`, `showing_participation`) and Tier 4 infra (`mls_*`, `field_mappings`, …) are labelled explicitly — not penalized as RESO drift. Corpus source: CDL `reso_field_descriptions` (seeded from [`reso-dd-kb`](../data-models/reso-dd-kb/USAGE.md)). See also [`cdl-schema.md`](../data-models/cdl-schema.md#cdl-studio-reso-dd-audit).

## Delivery Status Summary

### Done (Live)

| # | Component | KB Name | Type | Primary Users |
|---|-----------|---------|------|---------------|
| 1 | Identity & Access Management | **SSO Console** | Platform | Admins |
| 2 | Home Dashboard & App Launcher | **Agency Portal** | App | Everyone |
| 3 | App Builder Starter Kit | **App Builder Template** | Infrastructure | Developers (Lovable) |
| 4 | Contact Registration | **Client Connect** | App | Brokers, Contact Center, Sales Managers |
| 5 | Meeting Registration | **Meeting Hub** | App | Brokers, Sales Managers |
| 6 | WhatsApp & Messaging | **Matrix Comms** | App | Brokers, Marketing, Sales |
| 7 | Data Warehouse & MLS Pipelines | **EDW + MLS Pipelines** | Infrastructure | Data Engineers, BI |
| 8 | Public Website & CMS | **Website CMS** | App | Content Managers |
| 9 | AI Assistant for Web Channel | **AI Web Assistant** | AI Service | Website visitors |
| 10 | AI Assistant for Internal Support | **Zoe AI Assistant** | AI Service | All internal users (multi-role) |
| 11 | AI Assistant for Blog Generation | **AI Blog Generator** | AI Service | Marketing, Content Managers |
| 11a | MLS Data Studio (CDL admin) | **Matrix Atlas (`matrix-atlas-mls`)** | App (CDL admin, served at `/mls`) | Data ops, system_admin / org_admin |
| 11b | Observability & Monitoring | **Nyx Monitoring** | Infrastructure | CORE Team (ops / leadership) |

> **Atlas** is the Lovable-managed CDL admin SPA that drives `mls-sync` / `mls-sync-orchestrator` / `listings-search`. It's the operator UI for the 5-stage ingestion pipeline + the 8 RESO resource toggles + the source-of-record / lifecycle taxonomy + the data-stewardship `locked_fields` surface. See [`cdl-schema.md`](../data-models/cdl-schema.md) and the matrix-atlas-mls repo. Production path: `https://intranet.sharpsir.group/mls/`.

### In Progress

| # | Component | KB Name | Type | Primary Users |
|---|-----------|---------|------|---------------|
| 12 | Pipeline Management | **Matrix Pipeline** | App (CDL-Connected) | Brokers, Sales Managers, Call Center Staff |
| 13 | Contact Management | **Contact Management** | App (CDL-Connected) | Brokers, Sales Managers, Contact Center |
| 14 | IT Service & Asset Management | **ITSM** | App (Domain-Specific) | IT Staff, All internal users |
| 15 | Human Resources Management | **HRMS** | App (Domain-Specific) | All Employees, HR, Managers, Finance |
| 16 | Financial Management | **Matrix FM** | App (Domain-Specific) | Finance Team, Entity Managers, Senior Mgmt |
| 17 | Integration Management for External MLS and Portals | **Integration Management** | App / Service | Data Engineers, Admins |
| 18 | Notification Management | **Notification Management** | App / Service | All internal users, Admins |
| 18a | Matrix Stardom | **Matrix Stardom** | App (AI workspace for digital peers & people) | All internal users |
| 18b | Digital Employees | **Digital Employees (AI Agents)** | App (Domain-Specific) | All internal users |
| 18c | Matrix Datacore | **sharp-matrix-datacore** | Infrastructure (data plane) | Data / digital initiatives 005–006 |
| 18d | Chart Rendering MCP | **Sharp SIR Charts** | Infrastructure (MCP utility) | Agents, reporting and leadership |

> **Matrix Datacore** — `gca-ltd/matrix-datacore`, Cursor-managed (not Lovable, not github-watcher). Supabase Pro project [`zcajghoohycimpubufsy`](https://supabase.com/dashboard/project/zcajghoohycimpubufsy) in `eu-central-1` (Frankfurt). Schemas: `raw` (Qobrix photograph, service_role only), `insights`, `compliance` (initiative 005), `referral` (initiative 006). `public` has dashboard-only views over `raw` (no `anon`/`authenticated` grants; ingest still writes `raw`). Qobrix access via REST API (MCP design-only). EU-only personal data; RUSIR/amoCRM must not land here. Ingest worker is `sync/` CLI, **on-demand only** (no pm2/cron cadence). Oneshot 2026-08-21 loaded ~130k rows; OpenAPI completeness audit + KPI columns 2026-08-24 (`docs/005-006-qobrix-ingest.md` §8). **KB divergence:** 005/006 ingest bypasses Databricks (ADR-004 update pending).
>
> **Sharp SIR Charts** — `gca-ltd/sharpsir-charts`, public MIT Chart.js rendering MCP. Local stdio is the default; hosted Streamable HTTP is operator-managed at `https://intranet.sharpsir.group/charts/mcp` on port 3512 with static output under `/charts/o/`. The caller supplies JSON data; the server has no data connector. The default `sothebys` design is session-scoped and agent-configurable, with Sharp Matrix, mono-print and neutral references. See [`matrix-mcp-server.md`](matrix-mcp-server.md#sharp-sir-charts).

> **Qobrix Sales Automation (RLS)** — `sharpsir-group/matrix-qobrix-sales-automation-rls`, Apache path `/qobrix-rls/`, production URL `https://intranet.sharpsir.group/qobrix-rls/`. Thin sales-CRM over the Qobrix v2 API (edge functions on Supabase project `ycbwgnihbrqammkgngum`), read-mostly with write-mode-gated mutations. **Canonical vocabulary (as of 2026-07-01 hardening): the app manages `Contact`, `Opportunity`, and `Contract` — there are no "lead" or "deal" resources.** A sales-qualified lead is a *Contact* that holds one or more *Opportunities*; a closed sale is a *Contract*. UI labels, FE identifiers/types, routes (`/contacts`, with `/clients` kept as a legacy redirect), `qobrix-write` actions (`opportunity.*`, `offer.create`, `contract.*`), and EF payload field names all use this vocabulary. Qobrix-native names remain source-of-truth and are **not** renamed: the `/opportunities` + `/contracts` API paths, the `lead-lost-reasons` reference resource, `leads_search_expression`, and the RESO `ContactStatus` enum value `Lead`. Audit history is back-compatible: `qobrix-audit-log` treats legacy `entity_type: 'lead'` rows as `opportunity`. **Supabase-primary CRUD (2026-07-01):** the Qobrix v2 API is now treated as **read-only** (historical + dual-run); **new** resources and new fields/metadata on existing Qobrix entities are created/updated/deleted directly against the app DB (`ycbwgnihbrqammkgngum`) via an SSO-JWT PostgREST client under RLS (SSO helper functions installed; Third-Party Auth registration required — see the app's `docs/supabase/third-party-auth.md`). Two patterns (brand-new resource; sidecar keyed by the Qobrix UUID, merged at read time) with a reference slice `sales_entity_notes`; see `matrix-qobrix-sales-automation-rls/docs/supabase/app-owned-data.md`. New data stays local to this app DB (not a system of record for cross-app-shared entities). See `matrix-qobrix-sales-automation-rls/docs/qobrix-api/coverage-audit.md`. **App DB CRUD mirror (2026-07-02):** the Sales-CRM entities are now **mirrored** into app tables (`contacts`, `opportunities`, `opportunity_properties`, `contracts`, `offers`, `contract_parties`, `campaigns`, and a single polymorphic `activities`) so the UI does **full CRUD in the app DB** while Qobrix stays **read-only history** (strangler, strict). Writes go via PostgREST + SSO-claim RLS (no new write EFs); the existing `api.ts` writer signatures are unchanged (internals repointed) and the generic `crud.*` facade routes mirrored resources to the App DB. Reads **merge** App DB rows (source=app, editable) ahead of Qobrix history (source=qobrix, read-only); only App-DB rows are editable (`isEditable` gate + "read-only history" badges). Reference slice: **Contacts** end-to-end. Relationship columns are **loose keys** (may point at either store). Aggregated read EFs (pipeline/dashboard/analytics) still reflect Qobrix history only — folding App DB rows in is the tracked follow-up. **KB divergence:** these mirror tables use **Qobrix-native** field names (not RESO DD 2.0 canonical) — justified because this is a Domain-Specific/legacy Qobrix-native app (not CDL-connected), the goal is a 1:1 strangler over a sunsetting (`legacy-internal`) surface, and the data stays app-local; do **not** replicate Qobrix-native naming on CDL-connected/strategic apps. Migration `supabase/migrations/20260701130000_appdb_crud_mirror.sql`; toolkit `src/lib/sales/appData.ts`.
>
> **Qobrix canonical vs native vocabulary map (2026-07-07 zero-drift):**
>
> | Sharp Matrix canonical | Qobrix / app-native | Notes |
> |---|---|---|
> | Contact | `contacts` (app DB), `/contacts` (Qobrix API) | Route `/clients` is legacy redirect only |
> | Opportunity | `opportunities`, `/opportunities` | Legacy audit `entity_type: 'lead'` maps to opportunity |
> | Contract | `contracts`, `/contracts` | |
> | Property (catalog entity) | `properties` (app DB), `/properties` (Qobrix API) | UI copy uses "property" for entity-level labels |
> | Project (catalog entity) | `projects` (app DB), `/projects` (Qobrix API) | |
> | Listing Date (domain field) | `listing_date` | RESO/Qobrix domain term — **keep** in UI |
> | Private property (visibility) | `is_private` on `properties` | Not "private listing" in UI copy |
> | Audit log | `readonly_audit_log` | Renamed from legacy typo `redonaly_audit_log` |
> | Live UAT catalog seed | `properties.source` / `projects.reference_code` = `SYNTHTEST-ACME-*` | No parallel `synthetic_*` tables; tests seed real catalog rows only |

> **Matrix Sales Automation** — `gca-ltd/matrix-sales-automation` (was `sharpsir-group/matrix-qobrix-sales-automation-v1-0`, archived as `…-v1-0-superseded` on 2026-08-20). Qobrix-strangler sales CRM (Domain-Specific). App DB / Edge Functions on Supabase project `rpoeezssicpzexarmwqq`. OAuth `client_id` `Dk4cIY3~VvwYYgFIU.2gCdAfewWb34AZ` (portal title **Matrix Sales Automation**, subtitle *Staging — pipeline, leads & listings*, `display_order` 33). Two equal github-watcher targets: `gca-ltd/matrix-sales-automation@main` → `/msa-staging-main/` (business user; portal `app_url`) and `@cdto` → `/msa-staging-cdto/` (Cursor). Redirect URIs include both `/msa-staging-main/auth/callback` and `/msa-staging-cdto/auth/callback`. Legacy `/qobrix-v1.0/` 301s to `/msa-staging-main/`. **Sharp SIR portal access** (migration `20260824110000_msa_staging_main_portal_and_sales_access.sql`): Broker, Senior Broker, Area Manager, Team Leader, Sales Manager, Sales Director, Call Centre, and CORE Team have the client in `apps_allowed`; sales/CORE roles have `pages/actions='*'` (Call Centre keeps leads/approvals/analytics). **Cyprus office teams** (32-person roster → `CSIR Sales Paphos` / `Limassol` / `Larnaca`; leads Iness Karayianni, Olga Khokhlova, Liza Kazares): `20260824130000_cy_roster_office_group_align.sql` — see [security-model.md](security-model.md). **Hungary variant:** `gca-ltd/matrix-sales-automation-hungary`, app DB `ykgyzqnuqpwasxvesxva`, watcher path `/msa-hungary-staging-main/`. Do not confuse with the thin-client sibling `-rls` above (`/qobrix-rls/`, project `ycbwgnihbrqammkgngum`).

> **Matrix Stardom** — AI workspace for digital peers & people. `sharpsir-group/matrix-stardom`, Lovable-managed Matrix app shell. Auto-deployed by `github-watcher` on push to `main` (config key `sharpsir-group/matrix-stardom`, secret env `WEBHOOK_SECRET_STARDOM`, Apache path `/stardom/`). Production URL: `https://intranet.sharpsir.group/stardom/`. Ensure the OAuth app’s redirect URIs in the SSO Console include `https://intranet.sharpsir.group/stardom/auth/callback` (and Lovable preview URIs if used). **Intranet-only:** root Apache `htdocs/.htaccess` 301-redirects shareable paths that omit the `/stardom/` prefix (e.g. `/shared-conversation/…` → `/stardom/shared-conversation/…`) — same pattern as Pipeline `/list` → `/pipeline/list`; the Lovable repo stays at `/` with no committed `base`.
>
> **Digital Employees** (SSO title **AI Agents**) — `gca-ltd/matrix-digital-employees`, remixed from `matrix-apps-template-2-2`. Auto-deployed by `github-watcher` on push to `main` (config key `gca-ltd/matrix-digital-employees`, secret env `WEBHOOK_SECRET_DIGITAL_EMPLOYEES`, Apache path `/digital-employees/`). Production URL: `https://intranet.sharpsir.group/digital-employees/`. OAuth client `eXN8sUlGHJGHkcizgZNC0bdvOhSfbtst` — intranet redirect `https://intranet.sharpsir.group/digital-employees/auth/callback` (migration `20260818100000`). App DB / EFs on Supabase project `mihslqjjclbrqelnjjpb`. The leftover GitHub Actions rsync `deploy.yml` is unused (no `DEPLOY_*` secrets), same as ITSM. **Teams channel:** see [teams-channel.md](teams-channel.md). **Public Conversations API** (`/functions/v1/converse`, OpenAPI 1.1.0): stateful chat, `stateless` one-shots, `/transcribe`, `/suggest` (broker drafts), `/translate` — the in-platform replacement surface for Matrix Comms' HumaticAI RAGChat usage (SR000518; cutover map in the app repo `docs/public-api-comms-integration.md`).

### Planned

| # | Component | KB Name | Type | Primary Users |
|---|-----------|---------|------|---------------|
| 19 | Buyer/Seller Self-Service | **Client Portal** | App (CDL-Connected) | Buyers, Sellers |
| 20 | Campaign & Marketing Automation | **Marketing App** | App (CDL-Connected) | Marketing Team |
| 21 | Leadership KPI Dashboards | **BI Dashboard** | App | Leadership (CDSO, CDTO) |
| 22 | Platform Configuration | **Admin Console** | App | System Admins |

> **Consolidation note**: the previously-planned **Broker App** (daily dashboard + AI copilot) and **Manager App** (Kanban + analytics) are **consolidated into matrix-pipeline 2.0** as a single CRM serving both broker and manager personas (see [`product-specs/matrix-pipeline/wiki/personas`](../product-specs/matrix-pipeline/wiki/overview.md#personas) and [`phases.md`](../product-specs/matrix-pipeline/phases.md)). The canonical 5-stage funnel projection (Qualification → Matching → Viewing → Contracting → Payment) replaces both the old broker daily-dashboard view and the old manager Kanban as a single funnel-state UI projection.

---

## App Access Control (portal tile visibility)

Portal **tile visibility is access-controlled** by the user's `allowed_apps` set (the union of `sso_roles.apps_allowed` across the user's assigned roles, resolved live by `oauth-userinfo`). The Agency Portal launcher (`AppLauncher.tsx`) only renders a `show_in_portal` app when its OAuth `client_id` is in the signed-in user's `allowed_apps` — a strict intersection with **no admin bypass**. Managing access is therefore pure configuration: add a `client_id` to a role's `apps_allowed` (SSO Console → Roles) to grant the tile; remove it to hide it.

### CORE-exclusive apps

Seven apps are reserved for the **`CORE Team`** role and are intentionally hidden from every other role:

| App | OAuth `client_id` |
|---|---|
| HR Management (HRMS) | `JxeA~kJKxPVvRHLNYjbH9euCaVSUSsEX` |
| Financial Management (Matrix FM) | `LAmZA9MrZSpJ3NV~a5zyZI8W0.DYscHl` |
| Management Console | `sso-console-4e9b74a604a83d16` |
| Matrix Stardom | `372fff71-241c-4130-9f1f-614a3400b2a2` |
| Matrix Comms | `WSvfGsovutXBHJfQOdL9uPA4TnMIIVrZ` |
| Nyx Monitoring | `nyx-monitoring-vm-sso-v1` |
| Matrix Analytics 2.0 | `0c4ad723-0814-4a71-a6e1-63031be4ff5c` |

### Universal apps (available to all roles)

Four apps are backfilled into **every** role's `apps_allowed` so they stay broadly available. The Portal keeps `show_in_portal=false` (it is the launcher itself, never a tile) but is retained in `apps_allowed` for completeness:

| App | OAuth `client_id` | Tile? |
|---|---|---|
| Sharp Matrix Portal | `sharp-matrix-vm-sso-v2-3645cb7d428fbcbc` | No (launcher) |
| New Client Registration | `matrix-client-connect-vm-sso-v1-1c1de280d958ddbe` | Yes |
| Appointment Reports | `matrix-meeting-hub-vm-sso-v1-bac504231b61ad12` | Yes |
| IT Service & Asset Management (ITSM 2.1) | `n~~I~WvqoL3FuQ_nj~G6LClHKED1HsDK` | Yes |

> **2026-06-19:** ITSM 2.1 was promoted from CORE-exclusive to universal (available to all users) — supersedes the CORE-exclusive grant in `20260609101500_core_team_itsm_and_analytics_visibility.sql`. See `20260619140000_itsm_universal_app_access.sql`.

> Enforcement is **visibility-only**: `oauth-authorize` still gates app launches on the coarse `rw_*` permissions, so `allowed_apps` controls which tiles a user sees rather than hard-blocking deep links. See [security-model.md](security-model.md#portal-app-tile-visibility-allowed_apps).

---

## App Details — Done (Live)

### SSO Console (Identity & Access Management)
**Status**: Done
**Users**: System administrators
**URL**: `/sso-console/`
**Key Features**:
- OAuth 2.0 + PKCE authentication with custom JWT
- RBAC (role-based access control) with 5-level scope
- User and group management
- App registration and permissions
- Third-Party Auth (App DB) provisioning — one-click **Provision TPA** per app registers the SSO issuer/JWKS on the app's own Supabase project via the Management API (ADR-027)
- AD user synchronization
- "Act As" role switching for testing

### Agency Portal
**Status**: Done
**Users**: All Sharp Sotheby's staff
**URL**: `/agency-portal/`
**Key Features**:
- Central dashboard with KPI widgets (pipeline value, clients, meetings)
- App launcher with role-based visibility
- AI Advisor chat (powered by Zoe)
- Quick Access navigation bar
- Stats aggregation from Client Connect, Meeting Hub, and other apps
- Multi-language support (EN/RU)

### App Builder Template
**Status**: Done
**Repo**: `/home/bitnami/matrix-apps-template-2-1` (canonical; the prior `/home/bitnami/matrix-apps-template` is obsolete — do not use or update)
**Key Features**:
- Vite + React 18 + TypeScript + shadcn/ui starter kit
- Dual-Supabase architecture (SSO + App DB)
- OAuth 2.0 + PKCE authentication flow
- 5-level scope permissions with CRUD strings
- ProtectedRoute with `requiredPage` checks
- SidebarLayout, i18n (EN/RU), Sharp design system (Navy palette, Playfair Display + Inter)
- TanStack React Query data fetching patterns

### Client Connect (Contact Registration)
**Status**: Done
**Users**: Brokers, Contact Center (MLS Staff), Sales Managers
**URL**: `/client-connect/`
**Key Features**:
- Register new buyer, seller, tenant, and landlord leads
- Multi-step registration with role-specific forms
- MLS duplicate detection and deduplication
- Client verification and approval pipeline (Draft → Verified → Approved)
- RFI (Request for Information) workflow
- Role-based data visibility (self → team → global)

### Meeting Hub (Meeting Registration)
**Status**: Done
**Users**: Brokers, Sales Managers
**URL**: `/meeting-hub/`
**Key Features**:
- Record and manage appointments (buyer, seller, tenant, landlord)
- Four meeting types with dedicated forms
- Meeting analytics and reporting
- Calendar integration
- Role-based data visibility

### Matrix Comms (WhatsApp & Messaging)
**Status**: Done
**Users**: Brokers, Marketing, Sales
**URL**: `/comms/`
**OAuth client_id**: `WSvfGsovutXBHJfQOdL9uPA4TnMIIVrZ`
**App DB**: `ujowkipnqgtazmtdsnlm`
**Permissions model**: `app_permissions` table with `app_id = 'comms'` (ITSM pattern); universal Home at `/` excluded from permission matrix. Per-app SSO token storage (`:comms` suffix) — see ADR-032.
**Powered by**: Twilio + Meta WhatsApp Business API
**AI backend**: historically HumaticAI RAGChat (`humaticai.com/ragchat`); target replacement is the Digital Employees Conversations API (`converse` v1.1 — SR000518). Comms client cutover is a follow-up in `matrix-comms`.
**Key Features**:
- WhatsApp Business messaging (1:1 conversations)
- Pre-approved message templates with variable substitution
- Bulk campaigns to contact segments
- AI-powered reply suggestions (broker coach + visitor NBPS)
- Voice-note transcription and tap-to-translate
- Quick replies and snippets
- Conversation history and context
- Webhook-based real-time message delivery

### EDW + MLS Pipelines (Databricks)
**Status**: Done
**Repo**: `/home/bitnami/mls_2_0`
**Key Features**:
- Medallion architecture: Bronze → Silver → Gold (RESO DD 2.0)
- Ingests from Qobrix API (Cyprus), DASH API (Kazakhstan), DASH FILE (Hungary)
- CDC every 15 minutes for incremental updates
- Gold layer sync to Supabase CDL
- Data quality verification and validation reporting
- RESO Web API (OData 4.0) exposure for external consumers

### Website CMS
**Status**: Done
**Users**: Content managers
**Supabase Instance**: `yugymdytplmalumtmyct` (CY Web Site)
**Key Features**:
- Public website content management and SEO optimization
- Property listing pages synced from CDL
- Lead capture integration with AI Web Assistant
- Multi-language content (EN/RU)

### AI Web Assistant
**Status**: Done
**Users**: Website visitors (anonymous and authenticated)
**Key Features**:
- Conversational AI embedded on public website
- Property search assistance and recommendations
- Lead capture via webhook (name, email, phone, notes, transcript)
- Visitor context: IP geolocation, device, language, referrer
- Automatic lead routing to Client Connect / Contact Management

### Zoe AI Assistant (Internal Multi-Role Support)
**Status**: Done
**Users**: All internal users (brokers, managers, admins, support staff)
**Key Features**:
- 1st line support: how-to guidance, troubleshooting, incident triage
- 2nd line support: architecture context, deep-dive doc pointers, incident qualification
- RAG-powered knowledge retrieval from platform KB
- Multi-role awareness (adapts responses to broker vs. manager vs. admin)
- Cross-app workflow guidance
- Incident reporting assistance

### AI Blog Generator
**Status**: Done
**Users**: Marketing team, Content Managers
**Key Features**:
- AI-powered blog article generation for real estate content
- SEO-optimized output
- Multi-language generation (EN/RU)
- Integration with Website CMS publishing workflow

### Nyx Monitoring (Observability)
**Status**: Done
**Users**: CORE Team (ops / leadership) — CORE-exclusive tile
**Repo**: `sharpsir-group/nyx-monitoring`
**URL**: `https://nyx.intranet.sharpsir.group/grafana` (Grafana; own login — opened as a portal link tile, not an OAuth/SSO client)
**SSO registration**: `sso_applications.client_id = nyx-monitoring-vm-sso-v1` (`client_type=public`, `show_in_portal=true`); not part of the OAuth/PKCE flow.
**Key Features**:
- Prometheus + Alertmanager + Grafana + Blackbox/Node exporters on AWS Lightsail
- HTTP/HTTPS uptime + TLS-cert-expiry probes (30/14/7-day warnings) for production sites and CMDB services
- CMDB-driven targets; alerts routed to the ITSM webhook, email, and an external watchdog (dead man's switch)
- Git-provisioned Grafana dashboards — no manual UI state / config drift

---

## App Details — In Progress

### Pipeline Management (Matrix Pipeline)
**Status**: In Progress (rebuild on the matrix-pipeline 2.0 spec)
**Spec (single source of truth)**: [`product-specs/matrix-pipeline/`](../product-specs/matrix-pipeline/INDEX.md) — wiki + phases + cdl-crud-contract
**Users**: Brokers, Sales Managers, Call Center Staff, Listing Coordinators, Marketing, Finance
**RESO Resources** (canonical, strict DD 2.0): `Property`, `Media`, `Contacts`, `Member`, `Office`, `OUID`, `Teams`, `TeamMembers`, `SavedSearch`, `Prospecting`, `Activity`, `ContactListings`, `ContactListingPreference`, `ContactListingNotes`, `ShowingAvailability`, `ShowingRequest`, `ShowingAppointment`, `Showing`, `LockOrBox`, `Caravan`, `CaravanStop`, `TransactionManagement`, `HistoryTransactional`, `Document`, `Field`, `Lookup`, `OpenHouse`, `InternetTracking`, `PropertyDetailAttachment`, plus a documented project-flavour `Referral` entity (one of two escape hatches).
**App Type**: CDL-Connected (canonical reads + writes via dedicated CDL EFs under SSO JWT)
**Supabase Instance**: `kzvhqgpedapzqmwgikrw` (CRM app DB — app-private state only: `role_configurations`, `activities`, `notifications`, drafts, workflow cache, Commission Engine ERP-lite tables). This is the project the frontend client targets (`src/integrations/supabase/client.ts` → `https://kzvhqgpedapzqmwgikrw.supabase.co`). **Not** to be confused with the legacy v1 Pipeline project `mydojctcewxrbwjckuyz` (leads/opportunities CRM, `smpipeline` era), which matrix-pipeline-2-0 does **not** use.
**Repo**: `sharpsir-group/matrix-pipeline-2-0` (GitHub, Lovable-managed) — local checkout `/home/bitnami/matrix-pipeline-2-0`. Supersedes the retired `sharpsir-group/smpipeline` repo (old local checkout `/home/bitnami/matrix-pipeline` has been removed).
**Production path**: `https://intranet.sharpsir.group/pipeline/` (Apache htdocs `/opt/bitnami/apache/htdocs/pipeline`).
**Deploy**: auto-deployed by `github-watcher` on push to `main` (config key `sharpsir-group/matrix-pipeline-2-0`, secret `WEBHOOK_SECRET_PIPELINE`, base path patched to `/pipeline/`).
**Key Features** (target — see [`wiki/requirements.md`](../product-specs/matrix-pipeline/wiki/requirements.md) FR-CON / PC / COM / CFL / FNL / PROS / ACT / SHOW / CARA / CL / TM / CMM / DOC / REF / REP and [`phases.md`](../product-specs/matrix-pipeline/phases.md)):
- Canonical `Contacts` lifecycle with `ContactType` graduation (Lead → Prospect → Ready-to-Buy → Buyer/Seller) — FR-CON
- Multiple parallel commercial intents per contact via canonical `SavedSearch` + `Prospecting` — FR-PC
- Canonical 5-stage funnel projection over `(Contacts × SavedSearch)` (Qualification / Matching / Viewing / Contracting / Payment) — FR-FNL-01..06; **no `pipeline_stages` table**, the projection is a view over canonical CDL state
- Activity / task / follow-up management — FR-ACT
- Canonical 5-resource `Showing` chain (`ShowingAvailability` → `ShowingRequest` → `ShowingAppointment` → `Showing` → `LockOrBox`) — FR-SHOW
- Curated luxury tours via `Caravan` + `CaravanStop` — FR-CARA
- Client engagement via `ContactListings` + `ContactListingPreference` + `ContactListingNotes` — FR-CL
- Offers and transactions via canonical `TransactionManagement` + `HistoryTransactional` audit — FR-TM
- **Commission Engine ERP-lite** (second project-flavour escape hatch, app-private only): per-deal cost attribution via `Activity` tagging, GCI forecasting per FR-FNL-12 precedence (`OfferAmount` (a) > `SavedSearch` budget mid-point (b)), broker compensation rule engine, reconciliation against external Finance ERP — see [`wiki/commission-engine.md`](../product-specs/matrix-pipeline/wiki/commission-engine.md)
- AI Brokerage Copilot — FR-AI-LQ Lead Qualification, FR-AI-MX Match Explanation, FR-AI-SC Showing Coach, FR-AI-DM Deal Margin Coach (each shipped as a small LLM-wrapper EF; see [`wiki/ai.md`](../product-specs/matrix-pipeline/wiki/ai.md))
- O365 email + calendar integration linked to `Activity` and `ShowingAppointment` rows
- Listing Module integration via canonical `Property` + `Property.StandardStatus` push events — see [`wiki/integration.md#listing-module`](../product-specs/matrix-pipeline/wiki/integration.md#listing-module)
- Role-based permissions via SSO `role_configurations` (app_id: `smpipeline`)

### Contact Management → consolidated into matrix-pipeline 2.0
**Status**: target-state contact management folds into matrix-pipeline 2.0 (FR-CON cluster). The deployed `Contact Management` app remains a transitional surface; new development goes into matrix-pipeline.
**Spec**: see [`product-specs/matrix-pipeline/wiki/requirements.md#fr-con-contacts`](../product-specs/matrix-pipeline/wiki/requirements.md#fr-con-contacts).
**RESO Resources** (canonical): `Contacts`, `Member`, `OUID`, plus AI-driven enrichment via FR-AI-LQ.
**Key target capabilities** (post-consolidation):
- Canonical `Contacts` lifecycle with `ContactType` graduation (Lead → Prospect → Ready-to-Buy → Buyer/Seller); no MQL/SQL labels
- FR-AI-LQ inbound qualification + routing (broker confirms, writes via `cdl-contacts-write`)
- Communication logging in `Activity` (canonical resource)
- Canonical contact deduplication via `Contacts.MatchKey` heuristics + admin merge tools
- Segmentation via canonical `ContactType` + `SavedSearch` parameters (no app-private tags layer)

### ITSM (IT Service & Asset Management)
**Status**: In Progress
**Users**: IT staff, IT Admins, All internal users (ticket submitters)
**App Type**: Domain-Specific (own Supabase instance)
**Supabase Instance**: `irjrcskfcyierdbefrpk`
**Repo**: `/home/bitnami/matrix-itsm` ([`gca-ltd/matrix-itsm`](https://github.com/gca-ltd/matrix-itsm))
**Key Features** (target):
- Service desk with ticket lifecycle (Incident, Service Request, Change, Problem)
- SLA tracking with priority-based breach time
- Multi-level agent assignment (L1/L2/L3 escalation)
- CMDB: hardware/software asset registry with classification tree and bill of materials
- Software asset and license management with seat allocation
- Vendor and IT project management
- IT budget management with categories
- Analytics dashboards (service desk + IT operations)
- IT architecture documentation
- Microsoft 365 integration (Graph API)
- Active Directory employee sync
- External incident ingestion via webhook
- MLS integration settings (inherited from template)
- Role-based permissions via SSO `sso_role_configurations` (app_id: `itsm`)

### HRMS (Human Resources Management)
**Status**: In Progress
**Users**: All employees, Managers, HR team, Finance team, Admins
**App Type**: Domain-Specific (own Supabase instance)
**Supabase Instance**: `wltuhltnwhudgkkdsvsr`
**Repo**: `/home/bitnami/matrix-hrms`
**Key Features** (target):
- Employee directory with public profiles and search
- Interactive organizational structure chart
- Multi-step vacation approval workflow (Employee → Manager → HR → Finance)
- Leave balance tracking and policy management
- Onboarding and offboarding checklists with templates
- Internal change requests (transfers, promotions) with approval
- Performance review cycles with goals and participant assignment
- Compensation history tracking
- Document management with templates, distribution, and signing
- Employee profile edit requests with HR approval
- Internal social feed (posts, comments, reactions, holiday auto-posts)
- Active Directory sync and employee linking
- Excel bulk upload for employee data
- Public holiday management by country
- HR reports (headcount, turnover, leave statistics)
- Finance module for vacation payroll processing
- Role-based permissions via `sso_role_configurations` (app_id: `hrms`)
- 25+ domain tables, 30+ hooks

### Financial Management (Matrix FM)
**Status**: In Progress
**Users**: Finance team, Entity Managers, Country Managers, Senior Management, CFO/Board
**App Type**: Domain-Specific (own Supabase instance)
**Supabase Instance**: `retujkznogwplfrbniet`
**Repo**: `/home/bitnami/matrix-fm`
**Key Features** (target):
- Monthly financial reporting (P&L, Cash Flow, Balance Sheet, Working Capital)
- Annual reporting with full-year actuals
- Multi-year annual planning (Y-1 Actual, Y Budget, Y+1/Y+2/Y+3 Budget)
- CORE cost allocation by entity and year
- Submission workflow (Draft → Submitted → Withdrawn)
- Submission deadline management and tracking
- Data entry progress monitoring across entities
- Financial analytics and variance analysis
- Clipboard paste from Excel into financial grids
- Audit log with export capability
- Built-in bilingual documentation (EN/RU)
- Test data generation for development
- Edge Function-backed reads/writes with SSO JWT validation
- Role-based permissions via `app_permissions` (app_id: `matrix-financial-management`)

### Integration Management (Sources and Channels)
**Status**: In Progress
**Users**: Data Engineers, Admins, Listing Coordinators
**Key Features** (target):
- Ingress source configuration — manages all four `mls_sources.kind` types: `internal` (matrix-internal), `legacy-internal` (Qobrix CY — sunsetting), `brand-network` (Anywhere Dash — bidirectional; covers HU + KZ inbound today), `external` (developer / partner-brokerage feeds)
- Per-source onboarding wizard (RESO Web API creds, scheduling, field mapping, locked-field defaults, sunset markers)
- Egress syndication controls (per-listing toggle for target channels; channel-distribution rules per source kind)
- Portal export configuration (SIR Global / Anywhere Dash, HomeOverseas, Zillow, etc.)
- Channel health monitoring and error reporting
- Deduplication and multi-source merge precedence (`source_field_priority`)

### Notification Management
**Status**: In Progress
**Users**: All internal users (recipients), Admins (configuration)
**Key Features** (target):
- Centralized notification engine for all Matrix apps
- Multi-channel delivery (in-app, email, push, WhatsApp)
- Notification templates and rules configuration
- User preference management (opt-in/opt-out per channel)
- Delivery tracking and retry logic

---

## App Details — Planned

### Broker App and Manager App → consolidated into matrix-pipeline 2.0

The previously-planned **Broker App** (broker daily dashboard + AI copilot) and **Manager App** (manager Kanban + analytics) are **superseded by the matrix-pipeline 2.0 product spec**, which consolidates broker, manager, contact-center, and listing-coordinator workflows into one CRM with role-based views over the same canonical 5-stage funnel projection (Qualification → Matching → Viewing → Contracting → Payment).

**Single source of truth**: [`product-specs/matrix-pipeline/`](../product-specs/matrix-pipeline/INDEX.md) (wiki + phases + cdl-crud-contract).

Capabilities previously listed under Broker App (personal dashboard, Next Best Action, Curated List generation, follow-up management, O365 integration) are realised in matrix-pipeline as:
- Broker home view = role-filtered canonical 5-stage funnel projection per `Member` ([`wiki/overview.md#pipeline`](../product-specs/matrix-pipeline/wiki/overview.md#pipeline))
- AI Copilot = FR-AI-LQ / MX / SC / DM clusters in [`wiki/ai.md`](../product-specs/matrix-pipeline/wiki/ai.md)
- Curated Lists = canonical `Caravan` + `CaravanStop` + `ContactListings` ([`wiki/requirements.md#fr-cara`](../product-specs/matrix-pipeline/wiki/requirements.md#fr-cara-caravans), [`wiki/requirements.md#fr-cl`](../product-specs/matrix-pipeline/wiki/requirements.md#fr-cl-contact-listings))
- Follow-up management = canonical `Activity` + reminders ([`wiki/requirements.md#fr-act`](../product-specs/matrix-pipeline/wiki/requirements.md#fr-act-activities))
- O365 integration = matrix-pipeline integration cluster ([`wiki/integration.md#o365`](../product-specs/matrix-pipeline/wiki/integration.md))

Capabilities previously listed under Manager App (revenue forecast, team productivity, intervention tools, pipeline monitoring) are realised in matrix-pipeline as:
- Revenue forecast = Commission Engine ERP-lite forecast precedence (FR-FNL-12 + FR-TM-13) — see [`wiki/commission-engine.md`](../product-specs/matrix-pipeline/wiki/commission-engine.md)
- Team productivity / broker comparisons = canonical reports over `Member` × `TransactionManagement` × `Activity` (FR-REP cluster)
- Intervention tools = canonical `Member` reassignment on `Contacts.OwnerMemberKey`, `Activity` creation, `HistoryTransactional` audit
- Real-time monitoring = view over canonical funnel state; no separate Kanban materialisation

### Client Portal
**Users**: Buyers and sellers (authenticated)
**RESO Resources**: Property, Media, ShowingAppointment, OpenHouse
**Key Features**:
- Personalized Curated Lists of properties
- Showing scheduling and confirmation
- Document exchange (contracts, title deeds)
- Communication with assigned broker
- Transaction status tracking

### Marketing App
**Users**: Marketing team
**RESO Resources**: Property, Contacts, Media
**Key Features**:
- Campaign management (email, SMS, social)
- Lead capture and auto-qualification
- Segmentation and triggers
- A/B testing
- Marketing funnel analytics

### BI Dashboard
**Users**: Leadership (CDSO, CDTO), managers
**Key Features**:
- KPI tracking against targets
- Revenue vs forecast
- Marketing funnel visualization
- Sales pipeline health
- Regional comparisons (Cyprus, Hungary, Kazakhstan)

### Admin Console
**Users**: System admins
**Key Features**:
- Platform configuration
- User management (bulk operations)
- System health monitoring

---

## RESO Resource Usage Matrix

> Matrix Pipeline = matrix-pipeline 2.0 (consolidates broker, manager, contact-center, and listing-coordinator workflows). Authoritative resource matrix in [`product-specs/matrix-pipeline/cdl-crud-contract.md`](../product-specs/matrix-pipeline/cdl-crud-contract.md).

| RESO Resource | Matrix Pipeline | Client Portal | Marketing | Finance | AI Services |
|---|:---:|:---:|:---:|:---:|:---:|
| `Property` | R/W (via Listing Module push) | R | R | R | R |
| `Contacts` | R/W | R (own) | R/W | R | R |
| `Member` | R/W | — | R | R | R |
| `Office`, `OUID` | R/W | — | R | R | R |
| `Teams`, `TeamMembers` | R/W | — | — | — | R |
| `Media` | R/W | R | R/W | — | R |
| `ShowingAvailability` / `Request` / `Appointment` / `Showing` / `LockOrBox` | R/W | R/W (own) | — | — | R |
| `Caravan`, `CaravanStop` | R/W | R (own) | — | — | R |
| `ContactListings`, `ContactListingPreference`, `ContactListingNotes` | R/W | R (own) | R | — | R |
| `SavedSearch`, `Prospecting` | R/W | R (own) | R/W | — | R |
| `Activity` | R/W | — | R | — | R |
| `OpenHouse` | R/W | R | R/W | — | R |
| `TransactionManagement` | R/W | R (own) | — | R | R |
| `HistoryTransactional` | R/W (emit) | — | R | R | R |
| `Document` | R/W | R (own) | — | R | R |
| `InternetTracking` | R | — | R/W | — | R |
| `PropertyDetailAttachment` | R | R | R/W | — | R |
| `Field`, `Lookup` (metadata) | R | R | R | R | R |
| `Referral` (project-flavour escape hatch) | R/W | — | — | R | R |

R = Read, W = Write, R/W = Read and Write

## Acme Corporation (UAT tenant)

Tenant ID: `025a9ba8-2b99-42a1-b6aa-cc573cbef1b5`. Dedicated tenant-scoped roles (`ac000001..ac000020`) grant CORE-exclusive apps without editing production Sharp SIR roles. Full role catalog and per-app permission matrix: [security-model.md — UAT exception](security-model.md#uat-exception-tenant-isolated).

**Permission stores by app (Acme):**

| App | Config store | `app_id` |
|-----|--------------|----------|
| HRMS | `sso_role_configurations` | `hrms` |
| ITSM | `sso_role_configurations` | `itsm` |
| Matrix Sales Automation (staging) | `sso_role_configurations` | `Dk4cIY3~VvwYYgFIU.2gCdAfewWb34AZ` |
| Qobrix RLS | `sso_role_configurations` | `yeBljGGVpyC96RljEDov8n-td2I52cgX` |
| Financial Management | App-local `role_configurations` | — (configure in FM Settings) |

Migration: `matrix-platform-foundation/supabase/sso/migrations/20260709150000_acme_cross_domain_roles.sql`.

## O365 Integration Matrix

> O365 integration is a matrix-pipeline 2.0 capability cluster ([`wiki/integration.md#o365`](../product-specs/matrix-pipeline/wiki/integration.md)). All capabilities below are role-filtered inside the same matrix-pipeline app — there is no separate Broker / Manager app surface.

| Capability | Matrix Pipeline (broker role) | Matrix Pipeline (manager role) | Other Apps |
|---|:---:|:---:|:---:|
| Exchange email read (own mailbox) | ✓ | — | — |
| Attach email to `Activity` / `TransactionManagement` row | ✓ | — | — |
| View attached emails (team) | ✓ (own) | ✓ (team) | — |
| Outlook calendar sync (own) → `ShowingAppointment` / `Activity` | ✓ | — | — |
| Team calendar view | — | ✓ | — |
| Free/busy conflict detection | ✓ | ✓ | — |

See [o365-exchange-integration.md](o365-exchange-integration.md) for full technical details.
