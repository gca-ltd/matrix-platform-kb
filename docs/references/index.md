# Chapter 6: References — Index

> Raw API catalogs, data dictionary summaries, source repositories, and live endpoints.
> These are **reference and migration sources** for the Sharp Matrix Platform —
> not the platform itself. The canonical data layer is RESO DD 2.0.

## Documents

| Document | What It Contains | Role |
|----------|-----------------|------|
| [qobrix-api-summary.md](qobrix-api-summary.md) | All 83 Qobrix API resource groups and 149 schemas | Reference: current CRM capabilities to replicate |
| [`../data-models/reso-dd-kb/`](../data-models/reso-dd-kb/) | **Canonical RESO DD 2.0 model** — verified mirror of `dd.reso.org/DD2.0/`, 41 resources, 1,745 fields, 222 lookups, DBML schema, agent-facing per-resource docs. Start at `docs/data-models/reso-dd-kb/USAGE.md`. | Canonical: the standard Sharp Matrix builds on |
| [reso-dd-fields-summary.md](reso-dd-fields-summary.md) | REDIRECT → `docs/data-models/reso-dd-kb/wiki/agent-docs/_index.md` | Compatibility stub |

## Source Repositories

| Repo | Path | Purpose |
|------|------|---------|
| **matrix-apps-template-2-1** | `/home/bitnami/matrix-apps-template-2-1` | **Canonical** app starter kit: dual-Supabase, SSO, permissions, RLS, UI conventions. Always scaffold from / sync to this one. |
| ~~matrix-apps-template~~ | ~~`/home/bitnami/matrix-apps-template`~~ | **OBSOLETE** — superseded by `matrix-apps-template-2-1`. Do not use or update. |
| **matrix-hrms** | `/home/bitnami/matrix-hrms` | Working example: Domain-Specific app (25+ tables, 30+ hooks) |
| **mls_2_0** | `/home/bitnami/mls_2_0` | Data pipeline: Databricks ETL (Bronze/Silver/Gold) + RESO Web API |

## Live Endpoints

| Endpoint | URL | Auth | Purpose |
|----------|-----|------|---------|
| RESO Web API | `https://{host}:3900/reso` | OAuth 2.0 Client Credentials | OData 4.0 access to gold layer data |
| HomeOverseas Export | `https://{host}:3900/export/homesoverseas.xml` | Public | Cyprus listings XML feed |

## Supabase Project References

Supabase projects are split across two organizations:

- **`Sharp SIR Group`** (Pro) — platform core (**Matrix SSO**, **Matrix CDL** — the cross-app Common Data Layer that hosts MLS listings today and any future shared platform data) + target home for customer-facing sites (HU, CY). New project provisioning for platform/sites goes here.
- **`SharpMatrix`** (Pro) — hosts per-app DBs (Pipeline, HRMS, FM, MLS app, ITSM) and the CY prod project (under review). Also contains several legacy / dangling projects slated for cleanup (see "Cleanup candidates" below).

### Org `Sharp SIR Group` (platform core + site targets)

| Name | Project ID | Role |
|------|-----------|------|
| **Matrix SSO** | `xgubaguglsnokjyudgvc` | Identity only: Auth, RBAC, Tenants, AD Users (ADR-012). Nano, `eu-west-1` (Ireland). **Active** (~230k req / 7 days; last migration `fix_sso_roles_and_rls`). Owner: `matrix-platform-foundation/supabase/`. |
| **Matrix CDL** (a.k.a. "Matrix Data Model Studio") | `ofzcokolkeejgqfjaszq` | CDL backend (Micro, `eu-central-1` Frankfurt). Hosts the canonical listing tables (`public.properties`, `public.properties_published`, `public.property_media`), the `cdl_staging.*` raw/mapped/media-staging tables, the MLS Sync control plane (`mls_settings`, `mls_sync_jobs`, `mls_sync_state`, `mls_orchestrator_runs`), and the Edge Functions: the 5-stage pipeline (`reso-import` / `field-mapping-apply` / `listing-merge` / `media-import` (page-capped) / `listing-publish`) plus the `merge_media_from_staging` RPC, the admin EFs (`mls-sync-orchestrator` — sole sync engine; `mls-sync` — admin/CRUD/read API with `start` proxying to the orchestrator), and the read EF (`listings-search`). Per ADR-012/013, ADR-014 implementation status note + Phase 1 Best-in-Class (Apr 2026). Owner: `matrix-platform-foundation/supabase/cdl/`. See Matrix-CICD §7.3. |
| **HU Website 1GH — staging (clone)** | `bpaxqtxaysolzaeguwvg` | Matrix Storefront 2.0 Hungary (`hu-website`). Clone of legacy sandbox for HU site development; semantic listings MCP + embeddings (ADR-049). Region: `eu-central-1`. |
| **HU Website 1GH — prod** | TBD (to be provisioned) | Target prod Supabase for `sothebys-realty.hu`. Recommended region: `eu-central-1`. Migrate from `bpaxqtxaysolzaeguwvg` clone. See Matrix-CICD §0.1. |
| **HU Website 1GH — staging** | TBD (to be provisioned) | Target staging Supabase for `sothebys-realty.hu`. Recommended region: `eu-central-1`. See Matrix-CICD §0.1. |
| **CY Website 2.0 — prod** | TBD (to be provisioned) | Target prod Supabase for CY SPA (after legacy-PHP cutover). See Matrix-CICD §0.3 / §5.2. |
| **CY Website 2.0 — staging** | TBD (to be provisioned) | Target staging Supabase for CY SPA. See Matrix-CICD §0.3. |

> **Regional note:** the org is regionally mixed — SSO is in `eu-west-1` (historical, not being moved), CDL is in `eu-central-1`. New HU/CY projects should go to `eu-central-1` for latency parity with Budapest / Nicosia and the AWS `eu-central-1` prod HU VM.

### Org `SharpMatrix` (per-app DBs + under-review)

> ⚠ Org membership of the per-app DBs below is **assumed from historical KB entries**; only `Matrix SSO` and `Matrix CDL` have been verified against the live dashboard. Run `supabase projects list` to confirm each row and update this file.

| Name | Project ID | Role |
|------|-----------|------|
| **Matrix MLS app DB** | `wckwfbbqiupvallmhqbu` | `matrix-mls` / Atlas MLS application DB (role_configurations, app-local). |
| **Matrix Datacore** | `zcajghoohycimpubufsy` | Qobrix photograph / insights (initiatives 005–006). |
| **Matrix Sales Automation (MSA CY)** | `rpoeezssicpzexarmwqq` | Qobrix-strangler sales CRM staging. |
| **Matrix Sales Automation Hungary** | `ykgyzqnuqpwasxvesxva` | Hungary MSA variant. |
| **Matrix Qobrix Sales Automation RLS** | `ycbwgnihbrqammkgngum` | Thin Qobrix client (`/qobrix-rls/`). |
| **Matrix Comms** | `ujowkipnqgtazmtdsnlm` | WhatsApp / messaging app DB. |
| **Matrix Analytics + Stardom** | `wjsafhylqujwbpqgjjlj` | Shared app DB for analytics workspace and Stardom. |
| **Career Connect** | `zsjwbspjlpaxfadjeymd` | HR recruiting / applications. |
| **Task Manager HU** | `rwgfixcfgviaqonhhqev` | Hungary task manager. |
| **Matrix Performance Dashboard** | `patgnfubqbyaiapviksu` | Performance dashboard app DB. |
| **Matrix Vacations Management** | `kposeyhvgusosuzjjrdv` | Leave / vacation management. |
| **matrix-lead-generator** | `ddairradcxczsvwntwmw` | Lead generator (provisioned 2026-08-28). |
| **Matrix HRMS Sandbox 3.0** | `xyvkeefqxabfcptiyoxm` | HRMS sandbox — audit if prod-like PII. |
| **Digital Employees** | `mihslqjjclbrqelnjjpb` | AI Agents app DB (**second org** — PAT 403). |
| **Client Connect** | `jnmssbsjhsoyyxuxxzop` | Contact registration (**second org** — PAT 403). |
| **Meeting Hub** | `hefqrtlmxwvvtximsvsy` | Meeting registration (**second org** — PAT 403). |
| **Matrix Pipeline 2.0 app DB** | `kzvhqgpedapzqmwgikrw` | `matrix-pipeline-2-0` application DB (app-private: `role_configurations`, `activities`, `notifications`, drafts, workflow cache). Confirmed via `src/integrations/supabase/client.ts`. **This is the active Pipeline app DB.** |
| **Matrix Pipeline v1 (legacy) app DB** | `mydojctcewxrbwjckuyz` | Legacy Pipeline CRM (leads/opportunities, `smpipeline` era). Superseded by Pipeline 2.0; retained for legacy integrations only (e.g. `lead-webhook`, O365). Org unverified. |
| **Matrix HRMS app DB** | `wltuhltnwhudgkkdsvsr` | HR Management System (domain-specific app). Org unverified. |
| **Matrix FM app DB** | `retujkznogwplfrbniet` | Matrix FM (Financial Management) app DB. Org unverified. |
| **ITSM app DB** | `irjrcskfcyierdbefrpk` | ITSM app DB. Org unverified. |
| **CY Web Site** | `yugymdytplmalumtmyct` | Cyprus real estate prod project. Under review — may move to `Sharp SIR Group` alongside CY staging migration; see Matrix-CICD §0.3. |

### Cleanup candidates (org `SharpMatrix`)

These projects exist in `SharpMatrix` but should be decommissioned per Matrix-CICD §0.1 / §0.3 / §0.4:

| Name | Project ID | Status |
|------|-----------|--------|
| **Sergey Lobov personal sandbox** (displayed as `SharpMatrix`, Nano, `eu-north-1`) | `tiuansahlsgautkjsajk` | ⚠ HU staging + prod currently both point here (hardcoded in `1gh-of-hungary-sotheby-s-website/src/integrations/supabase/client.ts` on `main`). **~32–33k req/24h** from HU. Migrate HU to new `HU Website 1GH` projects in `Sharp SIR Group`, then rotate keys; project remains as Sergey's personal sandbox (not for any Matrix App/site). Matrix-CICD §0.1. |
| **HU Website 1GH (dangling)** | `iooyncgcumgecznfpnsk` | Nano, `eu-north-1`. Provisioned for HU but never connected (~8 req/60 min — idle). **Candidate for deletion** after HU cutover to `Sharp SIR Group`. Matrix-CICD §0.1. |
| **CSIR Website 2.0 (CY SPA staging)** | `rlfxsieleseimylumhwc` | Micro, **`eu-west-1` Ireland**. Current CY SPA staging backend. Migrate edge/schema/data → new `CY Website 2.0 — staging` in `Sharp SIR Group`, then **delete**. Matrix-CICD §0.3. |
| **websites-matrix-staging (empty)** | `hxbzyfadhwzlvfjgqase` | Micro, **`eu-central-2` Zurich**. 0 migrations / 0 req / 0 branches — never used. **Delete**. Matrix-CICD §0.4. |

### Other

| Name | Project ID | Role |
|------|-----------|------|
| **Lovable Source** | `ibqheiuakfjoznqzrpfe` | Development source (read-only) |

## Raw Source Files

| File | Where | Role in Sharp Matrix |
|------|-------|---------------------|
| `docs/data-models/reso-dd-kb/` | Mirror + raw CSVs + DBML + agent-docs (markdown) | **Canonical** — full RESO DD 2.0 corpus (41 resources, 1,745 fields, 222 lookups, 3,683 lookup values), built from a verified mirror of `dd.reso.org/DD2.0/`. Start at `docs/data-models/reso-dd-kb/USAGE.md`. |
| `raw/qobrix/qobrix_openapi.yaml` | 68,000+ lines OpenAPI 3.0 spec | **Migration source** — current CRM API, use for data migration and capability reference |
| `raw/dash/BlankForm_*.docx` | 6 SIR/Anywhere.com form templates | **Reference** — broker-facing field requirements from Sotheby's International Realty |

## Reference Source Roles

| Source | What It Tells Us | How Sharp Matrix Uses It |
|--------|-----------------|-------------------------|
| **RESO DD 2.0** | Standard field names, types, lookups for real estate data | Canonical data layer — all CDL-Connected apps use these names |
| **Qobrix CRM** | Current entity schema, API patterns, workflow capabilities | Migration source + capability reference (being decommissioned) |
| **SIR / Anywhere.com** | What fields brokers need on listing forms | Field requirements reference — ensures coverage |
| **matrix-apps-template-2-1** | Tech stack, auth flow, permissions, RLS patterns | Canonical blueprint for every Matrix App built by Lovable (the prior `matrix-apps-template` is obsolete) |
| **matrix-hrms** | Real app implementation: domain tables, hooks, workflows | Working example of a Domain-Specific app |
| **mls_2_0** | Data pipeline, ETL, RESO Web API | Data infrastructure — feeds Supabase CDL |
