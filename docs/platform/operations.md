# Operations — CI/CD, Deployment, Monitoring, DR/Backup

> Source: `matrix-platform-foundation`, `mls_2_0`, `matrix-apps-template-2-1`
>
> **For Lovable**: This document explains how the platform is deployed and operated.
> You don't need this to build apps, but you need it to deploy and maintain them.

## Deployment Map

Every component in the Sharp Matrix platform deploys via a different mechanism:

| Component | Platform | Deployment Method | Trigger |
|-----------|----------|------------------|---------|
| SSO Edge Functions (17) | Supabase (Deno) | GitHub Actions → `supabase functions deploy` | Push to `main` in `matrix-platform-foundation` |
| SSO Console | Apache htdocs | Manual build → rsync | Manual |
| SSO Login Page | Apache htdocs | Manual build → rsync | Manual |
| Matrix Apps (HRMS, Pipeline, ITSM, FM, MSA, …) | Apache htdocs via **github-watcher** | Push → webhook → immutable release + atomic symlink (`/opt/bitnami/apache/releases/<subpath>/<sha>/`) | Push to watched branch (`main`, or `cdto` for MSA staging) |
| RESO Web API | PM2 (FastAPI) | `pm2 restart mls2-api` | Manual |
| MLS 2.0 ETL Pipeline | Databricks | `databricks runs submit` via cron | Cron (3:00 AM MSK daily) |
| Database Migrations | Supabase | `supabase db push` or MCP `apply_migration` | Manual |

## CI/CD — Edge Functions

The SSO platform foundation has an automated deployment pipeline.

**Workflow**: `.github/workflows/deploy.yml`
**Trigger**: Push to `main` when files change in `supabase/functions/**`, `supabase/config.toml`, or the workflow itself. Also supports `workflow_dispatch` for manual runs.

**Steps**:
1. Checkout code
2. Setup Supabase CLI (`supabase/setup-cli@v1`)
3. Link Supabase project (`supabase link --project-ref`)
4. Deploy OAuth functions (public): `oauth-authorize`, `oauth-token`, `oauth-callback`, `oauth-login`, `oauth-revoke`, `oauth-userinfo`
5. Deploy admin functions: `admin-users`, `admin-roles`, `admin-apps`, `admin-permissions`, `admin-groups`, `admin-dashboard`, `admin-microsoft-auth`, `admin-ad-users`
6. Deploy utility functions: `switch-role`, `check-permissions`, `check-mls-duplicate`, `register-app`, `sync-ad-users`, `sync-azure-profile`
7. Verify deployment

All functions deploy with `--no-verify-jwt` because they implement custom JWT verification internally (SSO tokens are not standard Supabase tokens).

**Secrets** (GitHub repository secrets):
- `SUPABASE_ACCESS_TOKEN` — Supabase Management API token
- `SUPABASE_PROJECT_REF` — Project ID (`xgubaguglsnokjyudgvc`)
- `SUPABASE_DB_PASSWORD` — Database password for project linking

**Configuration**: `supabase/config.toml` sets `verify_jwt = false` for all 17 functions.

### Matrix SPA frontend deploys (github-watcher)

Intranet Matrix SPAs deploy through `sharpsir-group/github-watcher` (pm2 on the intranet host,
port `:9001`). Agents and operators **push to the watched branch** and never run `deploy.sh`
or copy into htdocs. See ADR-055 for the immutable-release publish model.

| Concern | Behaviour |
|---------|-----------|
| Trigger | GitHub `push` webhook + 5-minute reconciler |
| Publish | `/opt/bitnami/apache/releases/<subpath>/<sha>/` + atomic symlink at htdocs |
| Hang protection | Build `timeout` (900s) + parent process-group watchdog (20 min) |
| Failure recovery | Exit `10`/`20`/`30` → classified backoff / fast retry; stamp mismatch auto-rolls back |
| Status | `GET http://127.0.0.1:9001/status` |
| Rollback | `POST http://127.0.0.1:9001/rollback` (loopback) with `{"target":"org/repo"}` |

### Planned: Frontend App CI/CD (lint gate)

GitHub Actions for **lint + type-check on PR** remains useful as a merge gate. Production
publish for Matrix SPAs is already owned by github-watcher — do not reintroduce a
`deploy.yml` that rsyncs to Apache.

- `build.yml`: lint + type-check + build on PR (blocks merge on failure)
- ~~`deploy.yml`: build + rsync to Apache htdocs on push to main~~ — superseded by github-watcher

## Process Management

### RESO Web API (PM2)

The MLS 2.0 RESO Web API runs as a managed process via PM2.

**Config**: `mls_2_0/ecosystem.config.js`
- Auto-restart on crash
- Memory limit: 500MB
- Log rotation with date format
- Error and output logs separated: `api/logs/error.log`, `api/logs/out.log`

**Management**: `mls_2_0/scripts/pm2-manage.sh`
- Commands: `start`, `stop`, `restart`, `status`, `logs`, `health`, `setup`
- Auto-start on reboot via `pm2 save`

**Health Check**:
- `GET /health` — **shallow liveness only**. Returns `status` + catalog/schema. Does **not** query Databricks. Safe for frequent external probes / load-balancer checks.
- `GET /health/databricks` — **on-demand deep check**. Runs `SELECT 1` against the serverless SQL warehouse. Call manually only — never wire into automated probes (a 30s probe here previously kept the warehouse awake 24/7 and spiked cost ~40×; fixed 2026-07-15, committed under SR000510).

### MLS 2.0 ETL Pipeline (Cron)

CDC incremental sync runs on a daily schedule.

| Script | Schedule | Purpose |
|--------|----------|---------|
| `cron_cdc_pipeline.sh` | 3:00 AM MSK (0:00 UTC) | Daily CDC sync for Cyprus (Qobrix) |
| `cron_all_sources_cdc.sh` | Configurable | Multi-source CDC (Cyprus + Hungary + Kazakhstan) |

Each run:
1. Executes Bronze CDC → Silver CDC → Gold CDC notebooks via Databricks CLI
2. Logs output to `mls_2_0/logs/cdc_pipeline_YYYY-MM-DD.log`
3. Sends HTML email report to pipeline owner with per-entity change tracking

## Structured Logging

### Edge Functions (`_shared/logger.ts`)

All SSO Edge Functions use a shared structured logger.

| Function | Level | Purpose |
|----------|-------|---------|
| `logEvent()` | info / warn / error / security | General structured log entry |
| `logSecurityEvent()` | security | Security events with IP address and user agent extraction |
| `logAuthEvent()` | security | Auth-specific events: `login_success`, `login_failure`, `token_exchange`, `token_refresh`, `token_expired` |
| `logAdminEvent()` | security | Admin actions with actor and target details |

Output format: JSON to console (captured by Supabase Edge Functions runtime). Supabase retains Edge Function logs for 24 hours via the dashboard.

**Planned**: Integration with external logging service (Sentry for error tracking — see planned infrastructure below).

### MLS Pipeline Logging

| Log | Location | Retention |
|-----|----------|-----------|
| CDC pipeline logs | `mls_2_0/logs/cdc_pipeline_YYYY-MM-DD.log` | On-disk, unbounded |
| Multi-source logs | `mls_2_0/logs/all_sources_cdc_YYYY-MM-DD.log` | On-disk, unbounded |
| API test logs | `mls_2_0/logs/api_test_YYYY-MM-DD.log` | On-disk, unbounded |
| RESO API output | `mls_2_0/api/logs/out.log` | PM2 log rotation |
| RESO API errors | `mls_2_0/api/logs/error.log` | PM2 log rotation |

## Audit Trail

Four audit mechanisms track changes across the platform:

### 1. Application Audit (`sso_application_audit`)

Automatic trigger-based audit for all changes to `sso_applications`.

| Column | Purpose |
|--------|---------|
| `application_id` | Which app was changed |
| `client_id` | OAuth client ID |
| `action` | INSERT / UPDATE / DELETE |
| `changed_field` | Which field changed |
| `old_value`, `new_value` | Before/after values |
| `changed_by` | Who made the change |
| `ip_address`, `user_agent` | Request context |

Client secrets are masked in audit records (first 4 + last 4 characters only).

### 2. User Activity Log (`sso_user_activities`)

Tracks user changes: member_type changes, email updates, name changes.

### 3. AD Sync Log (`ad_sync_log`)

Tracks Azure AD synchronization operations: users added/updated/deactivated, duration, errors.

### 4. Permission Audit

Available via `/admin-permissions/audit` endpoint. Tracks permission grants and revocations.

### Dashboard & Activity Logs

The SSO Console provides:
- `/admin-dashboard/stats` — system statistics (user counts, app counts, active sessions)
- `/admin-dashboard/activity` — activity feed (logins, app registrations, privilege grants, group changes, user creation)

## Schema Export

`sync-supabase-schema.sh` exports the current database schema for documentation:

| Output | Content |
|--------|---------|
| `schema-export/sso-tables.json` | Table definitions |
| `schema-export/rls-policies.sql` | All RLS policies |
| `schema-export/functions-and-triggers.sql` | Stored functions and triggers |
| `schema-export/edge-functions.md` | Edge Function catalog |

## Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| **Development** | Local development + Lovable preview | Lovable dev server, Supabase branches for schema changes |
| **Production** | Live platform | Supabase Pro instances, Apache htdocs, Databricks workspace |

Supabase branch workflow for database changes:
1. Create a development branch via `supabase branches create`
2. Apply and test migrations on the branch
3. Merge to production via `supabase branches merge`

Lovable deployment:
- **Preview**: Automatic on every change in Lovable editor
- **Production**: Manual via Share → Publish, then build output deployed to Apache htdocs

### Lovable App Maintenance

All Matrix business apps (HRMS, Pipeline, ITSM, FM, Client Connect, Meeting Hub, etc.) are **Lovable-managed**. Changes to these apps should be made through Lovable prompts rather than direct code edits:

1. Write a structured markdown prompt describing the change (file paths, before/after code, testing steps)
2. Store the prompt in the project's prompt archive (e.g., `matrix-testing-suite/hrms-uat/prompts/`)
3. Apply the prompt in the Lovable editor
4. Verify the change in Lovable preview
5. Publish to production when verified

**Direct code edits are reserved for**: SSO/CDL Edge Functions, database migrations, RLS policies, and infrastructure configuration. See [app-template.md — Lovable-Managed Apps](app-template.md#lovable-managed-apps--development--maintenance-model) for the full model.

## Disaster Recovery & Backup

### Supabase (CDL + SSO — system of record)

| Aspect | Detail |
|--------|--------|
| Automated backups | Daily, included in Pro plan |
| Point-in-time recovery | Available on Pro plan (up to 7 days) |
| RTO target | < 4 hours (restore from backup) |
| RPO target | < 24 hours (daily backup interval) |

### Databricks (DWH/ETL)

| Aspect | Detail |
|--------|--------|
| Delta Lake time-travel | 30-day history on all tables (default retention) |
| Rollback | `RESTORE TABLE ... TO VERSION AS OF` or `TO TIMESTAMP AS OF` |
| Bronze layer | Can be re-ingested from source APIs at any time |

### Recovery Procedures

1. **CDL data loss**: Restore Supabase from daily backup via dashboard or support ticket
2. **ETL pipeline failure**: Re-run full refresh via `run_pipeline.sh all` — idempotent by design
3. **Edge Function outage**: Redeploy via GitHub Actions `workflow_dispatch` or manual `supabase functions deploy`
4. **App outage (Matrix SPA)**: Confirm `/status`, then push a fix to the watched branch (or `POST /rollback` on loopback to the previous release). Do **not** `npm run build` + rsync into htdocs — that bypasses the watcher and breaks the symlink publish model (ADR-055).

## Planned Infrastructure

| Component | Purpose | Priority | Status |
|-----------|---------|----------|--------|
| Sentry (frontend + Edge Functions) | Error tracking and alerting | P1 | Planned |
| Uptime monitoring | Health check pinging + Telegram alerts | P1 | Planned |
| Frontend CI/CD (GitHub Actions) | Automated lint/build/deploy for React apps | P1 | Planned |
| External log aggregation | Persist Edge Function logs beyond 24h | P2 | Planned |
| SLI/SLO definitions | 99.5% uptime for SSO, 99% for apps | P1 | Planned |

## Cross-Reference

| For | See |
|-----|-----|
| Security model and RLS | [security-model.md](security-model.md) |
| Data quality verification | [data-quality.md](../data-models/data-quality.md) |
| MLS pipeline architecture | [mls-datamart.md](mls-datamart.md) |
| Compliance and data protection | [compliance.md](compliance.md) |
