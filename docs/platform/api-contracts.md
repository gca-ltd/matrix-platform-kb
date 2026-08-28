# API Contracts — Edge Function API Surface

> Source: matrix-platform-foundation/openapi.yaml, supabase/functions/
>
> **For Lovable**: This document defines the API contracts for SSO Edge Functions
> that your app calls for authentication, permissions, and admin operations.

## Overview

The full OpenAPI specification lives in `matrix-platform-foundation/openapi.yaml` (1700+ lines). Use it for detailed request/response schemas, error codes, and examples. This document summarizes the catalog and governance.

## Edge Function Catalog

### OAuth (6 functions)

| Name | Path | Method(s) | Auth | Purpose |
|------|------|------------|------|---------|
| oauth-authorize | `/oauth-authorize` | GET | None | Initiate OAuth flow, redirect to login |
| oauth-token | `/oauth-token` | POST | None | Exchange auth code for JWT |
| oauth-callback | `/oauth-callback` | GET | None | OAuth callback handler |
| oauth-login | `/oauth-login` | POST | None | Direct login (username/password) |
| oauth-revoke | `/oauth-revoke` | POST | client_id + token (RFC 7009) | Revoke refresh token (`verify_jwt: false`; no SSO/Supabase JWT required) |
| oauth-userinfo | `/oauth-userinfo` | GET | Bearer | Fetch user info with JWT claims (**optional on login** — see note) |

**`oauth-token` PKCE contract.** Public clients normally MUST send a
`code_verifier` (PKCE). Apps flagged `sso_applications.server_managed_pkce = true`
are exempt: `oauth-token` authorizes the `authorization_code` exchange **without**
a `code_verifier`, relying on the single-use, short-TTL code bound to
`redirect_uri` + `client_id` + an authenticated SSO session. This **server-managed
PKCE** mode (default `false`, opt-in per app) exists so fresh logins survive
storage-stripping embedded browsers (e.g. the Cursor in-IDE webview). The
challenge-validation step stays conditional on a stored `code_challenge`, so the
change is backward compatible — a client that still sends challenge+verifier is
validated exactly as before. See [ADR-019](../architecture/decisions/ADR-019.md).

**`oauth-token` enriched JWT / `oauth-userinfo` optional on login (2026).** The
access token minted by `oauth-token` now embeds the full consumed profile
(`email`, `email_verified`, `name`, `picture`, `sso_role`, `scope`, `crud`,
`available_roles`, `organization`, `teams`, `allowed_apps`, `tenant_id`, `uoi`,
`org_name`, `groups`, `permissions`, `member_type`, `act_as_roles`). First-party
apps (via the shared `matrix-apps-template-2-1`) decode these claims on login instead
of making a second `oauth-userinfo` round-trip, removing one Edge-Function hop from
the login critical path. **`oauth-userinfo`'s response shape is frozen and remains
the source of truth** — it is still called for background freshness and by apps
that have not synced the template, so this is fully backward compatible. See
[sso-edge-functions.md](sso-edge-functions.md) and
[performance.md](performance.md#sso-login-latency-auth-critical-path).

### Admin (8 functions)

| Name | Path | Method(s) | Auth | Purpose |
|------|------|------------|------|---------|
| admin-users | `/admin-users` | GET, POST, PATCH, DELETE | Bearer (admin) | User CRUD |
| admin-roles | `/admin-roles` | GET, POST, PATCH, DELETE | Bearer (admin) | Role management |
| admin-apps | `/admin-apps` | GET, POST, PATCH, DELETE | Bearer (admin) | App registration; PUT also accepts `server_managed_pkce` (ADR-019) and `client_id` (atomic rename via `sso_rename_client_id` RPC — 409 on collision, 404 on missing). Create/update accept `app_supabase_project_ref` (ADR-027) |
| admin-apps (TPA) | `/admin-apps/{id}/provision-tpa` (POST), `/admin-apps/{id}/tpa` (GET) | Bearer (admin) | Console-managed Third-Party Auth provisioning (ADR-027). POST body `{ project_ref?, reload? }` registers the SSO issuer/JWKS on the app's Supabase project via the Management API using the SSO Vault PAT `sso_supabase_management_pat`; idempotent, `reload` forces DELETE+POST. Sets `tpa_status`/`tpa_provisioned_at`/`tpa_integration_id`/`tpa_last_error` and nulls `jwt_secret_name` on success. Errors: `400 invalid_request` (no ref), `500 pat_not_configured`, `502 provisioning_failed` |
| admin-permissions | `/admin-permissions` | GET, POST, DELETE | Bearer (admin) | Permission grants |
| admin-groups | `/admin-groups` | GET, POST, PATCH, DELETE | Bearer (admin) | Group management |
| admin-dashboard | `/admin-dashboard` | GET | Bearer (admin) | Stats, activity feed |
| admin-microsoft-auth | `/admin-microsoft-auth` | POST | Bearer (admin) | Microsoft auth config |
| admin-ad-users | `/admin-ad-users` | GET | Bearer (admin) | Query Azure AD user directory |

### O365 Integration (4 functions)

| Name | Path | Method(s) | Auth | Purpose |
|------|------|------------|------|---------|
| email-messages | `/email-messages` | GET | Bearer | Read/search broker's Exchange emails via Graph API |
| email-attach | `/email-attach` | GET, POST, DELETE | Bearer | Attach/detach email snapshots to/from opportunities |
| calendar-events | `/calendar-events` | GET, POST, PATCH, DELETE | Bearer | CRUD on broker's Outlook calendar events |
| calendar-sync | `/calendar-sync` | POST | Bearer (admin) | Bidirectional sync between CRM showings/meetings and Outlook |

All O365 functions use the user's Microsoft `provider_token` (stored server-side) to call Microsoft Graph API with delegated permissions (`Mail.Read`, `Calendars.ReadWrite`). See [o365-exchange-integration.md](o365-exchange-integration.md) for full details.

### Utility (7 functions)

| Name | Path | Method(s) | Auth | Purpose |
|------|------|------------|------|---------|
| switch-role | `/switch-role` | POST | Bearer | Switch active role → re-issue JWT |
| switch-tenant | `/switch-tenant` | POST | Bearer (system_admin) | Switch active tenant → re-issue JWT with new org context |
| check-permissions | `/check-permissions` | POST | Bearer | Check page/action access |
| check-mls-duplicate | `/check-mls-duplicate` | POST | Bearer | MLS duplicate detection |
| register-app | `/register-app` | POST | Bearer (admin) | Register new OAuth app |
| sync-ad-users | `/sync-ad-users` | POST | Bearer (admin) | Sync Azure AD users |
| sync-azure-profile | `/sync-azure-profile` | POST | Bearer | Sync user profile from Azure |

### CDL Edge Functions (8 functions, project `ofzcokolkeejgqfjaszq`)

Deployed from `matrix-platform-foundation/supabase/cdl/functions/`.
All run with `verify_jwt: false` and verify SSO JWTs themselves
(HS256 / JWKS fallback). Required SSO scopes default to
`system_admin,org_admin` for admin/pipeline EFs and to
`self,team,global,org_admin,system_admin` for the read EF.

| Name | Path | Method(s) | Auth | Purpose |
|------|------|----------|------|---------|
| reso-import | `/reso-import` | POST | Bearer (admin) | RESO OData → `cdl_staging.listings_raw` (stage 1/5) |
| field-mapping-apply | `/field-mapping-apply` | POST | Bearer (admin) | `listings_raw` → `listings_mapped` via `public.field_mappings` (stage 2/5) |
| listing-merge | `/listing-merge` | POST | Bearer (admin) | `listings_mapped` → `public.properties` upsert + soft-delete (stage 3/5) |
| media-import | `/media-import` | POST | Bearer (admin) | RESO Media → `cdl_staging.media_staging` (page-capped via `pagesPerInvocation`, default 5). Looped by orchestrator (stage 4a/6) |
| media-merge | RPC `public.merge_media_from_staging(p_batch_id, p_source_id)` | n/a | service_role | Drains `cdl_staging.media_staging` for a batch into `public.property_media` (upsert + soft-prune). Called by orchestrator (stage 4b/6) |
| listing-publish | `/listing-publish` | POST | Bearer (admin) | `public.properties` (visible) → `public.properties_published` snapshot (stage 5/6) |
| mls-sync | `/mls-sync` | POST | Bearer (admin) | Admin/CRUD/read API. Action surface: `get-settings` / `save-settings` / `list-jobs` / `list-running-jobs` / `get-job` / `get-running-job` / `get-recent-job` / `has-previous-sync` / `start` (proxies to `mls-sync-orchestrator`) / `cancel` (cooperative) / `resume` / `test` / `sync-media` / `lock-field` / `unlock-field` / `run-side-resources` / `watchdog` plus per-resource CRUD/list/test |
| mls-sync-orchestrator | `/mls-sync-orchestrator` | POST | Bearer (admin) | **Sole sync engine.** Same action surface as `mls-sync`; `start` chains the 6 pipeline stages (`reso-import` → `field-mapping-apply` → `listing-merge` → `media-import` (looped) → `media-merge` RPC → `listing-publish`) plus `run-side-resources`, recording per-stage state in `public.mls_orchestrator_runs`. Defaults `incremental = true` when caller omits it. |
| listings-search | `/listings-search` | POST | Bearer | Filtered/paginated reads of `public.properties_published` with optional `includeMedia` |

`mls-sync-orchestrator` is the only sync engine for new work (Phase 1 Best-in-Class, Apr 2026). The legacy engine selector `mls_settings.sync_mode` was dropped in `20260426170000_cdl_drop_sync_mode.sql`. Atlas (`matrix-atlas-mls`) calls the orchestrator directly via `useMLSSettings.invokeSync()` and routes admin/CRUD actions to `mls-sync` via the separate `invokeMlsSyncAdmin()` helper. See [`docs/data-models/cdl-schema.md`](../data-models/cdl-schema.md) for full request/response contracts.

## Auth Requirements

All functions use `verify_jwt: false` and implement **custom JWT verification** internally. They accept:
- **SSO JWT tokens** (from `oauth-token`) — primary for Matrix Apps
- **Supabase auth tokens** — for compatibility where applicable

Apps send `Authorization: Bearer <token>` with the SSO JWT obtained from the OAuth flow.

## Chat agent → MCP ingestion contract (ADR-032)

Chat agents (e.g. Claude, Cursor) call the ITSM `mcp-server` MCP endpoint as a tool
while holding **no SSO tokens or per-user credentials**. The contract:

1. **Authenticate via OAuth 2.1 authorization-code + PKCE (HubSpot-style).** Each
   agent is registered as its own confidential client (Settings → MCP → Agents)
   with a `client_id` + `client_secret` + redirect URL(s). The connector runs the
   standard browser flow — `mcp-oauth/authorize` → `/oauth/consent` (operator signs
   in once via SSO and approves) → single-use `code` → token exchange with PKCE
   **and the client secret**:

   ```
   POST {SUPABASE_URL}/functions/v1/mcp-oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=<authorization-code>
   &code_verifier=<pkce-verifier>
   &redirect_uri=<registered-redirect>
   &client_id=<client_id>
   &client_secret=<client_secret>   # or HTTP Basic; omit for public clients
   ```

   Returns a **1h** `access_token` **+ 30d** `refresh_token`; refresh with
   `grant_type=refresh_token` (rotates the refresh token). Then call `mcp-server`
   with `Authorization: Bearer <access_token>`. Clients that auto-discover OAuth
   (Claude, Cursor, MCP Inspector) only need the MCP URL — they read
   `/.well-known/oauth-protected-resource` and run the flow. The signing key
   (`app_settings.mcp.jwt_secret`) is **server-only** — never a bearer.
2. **Assert the chat identity via request headers** (not LLM tool args):
   - `X-Chat-Platform`: `telegram` | `whatsapp` | `teams` | `web`
   - `X-Chat-Scope`: `direct` | `group` — `group` (or a missing identity proof) forces
     **public-only** execution mode (see tiering below).
   - `X-Chat-User-Id`: the platform's **permanent** user id (Telegram numeric
     `user_id`; Teams `aadObjectId`; WhatsApp `wa_id`; Web SSO user UUID = bearer `sub`).
     Never `@handle`/phone for TG.
   - `X-Chat-Aad-Oid` (+ optionally `X-Chat-Email`): for Teams auto-bind.
   - `X-Chat-User-Bearer`: for **web** — the logged-in user's SSO access token (verified
     on every request; this is the identity proof, not `X-Chat-Verified`).
3. **Verify the platform webhook signature BEFORE forwarding a chat id** (Telegram /
   WhatsApp / Teams only). The chat id is platform-asserted, never user-asserted:
   - Telegram: `X-Telegram-Bot-Api-Secret-Token` (+ IP pinning)
   - WhatsApp: `X-Hub-Signature-256` (app-secret HMAC)
   - Teams: Bot Framework JWT (Microsoft-signed)
   - Web: no third-party webhook — identity is the SSO bearer in `X-Chat-User-Bearer`.
4. **Public vs private tools (tiering).**
   - **Public** (`whoami`, `tool_guidance`, `search_kb`, `get_article`, `create_ticket`): executable with
     **just the agent access token** — no chat headers, no linkage, no SSO URL.
     Available in group chats and to unidentified users.
   - **Private** (`list_tickets`, `get_ticket`, `update_ticket`, `search_assets`, `get_asset`):
     executable only with a verified **1:1** identity and a linked SSO account
     (Telegram/WhatsApp/Teams via platform id + linkage; **web** via verified
     `X-Chat-User-Bearer` auto-bind).
   - **Link** (`link_account`): one-time SSO binding before private tools (Telegram/WhatsApp only; not web).
   - **`tools/list` always returns the full catalogue** for agent tokens (minus
     admin-disabled tools). Each tool includes an `annotations.tier` (`public` |
     `private` | `link`), HubSpot-style structured sections in `description`, and
     an `<availability>` suffix so the LLM knows what exists even when a call would
     be blocked. Call **`tool_guidance`** for deeper workflows. **Execution** is still
     gated at `tools/call` — listing does not grant access.
5. **Handle MCP responses**:
   - `private_requires_dm` (code `-32003`): a private tool was called without a
     verified identity. `data` carries `cause` (`group_chat` | `no_user_id` |
     `no_verified_session` for web),
     `tool`, `tier`, `chat_scope`, `platform`, `remediation: ask_user_to_dm`,
     `agent_guidance`, and `available_here` (public tools still usable). For web,
     `remediation` is `ensure_signed_in` (no `link_url`). The agent should relay
     this in its own words — ask the user to re-send the request in a direct (1:1)
     message (or sign in for web) — and must **not** leak anyone's personal data.
   - `not_linked` (code `-32003`, returns `{ link_url }`): a 1:1, identified but
     unlinked user calling a private tool — show the one-time link.
   - `consent_required` (code `-32004`, returns `{ link_url }`): step-up
     confirmation for ticket close/resolve via `update_ticket`.
   - Linked private calls return user-scoped data under RLS.

The MCP mints a short-lived per-request SSO JWT (`mint-delegated-token`) and
never returns it to the agent. See ADR-032 and `sso-edge-functions.md`.

## Contract Governance

| Practice | Detail |
|----------|--------|
| **Documentation** | New endpoints: update `openapi.yaml` in matrix-platform-foundation |
| **Breaking changes** | ADR + changelog; notify app owners before deployment |
| **Versioning** | URL path versioning not used — all endpoints are v1 |

## Per-App API Dependency Map

| App | OAuth | switch-role | switch-tenant | check-permissions | Admin | Other SSO Functions | App-Specific Edge Functions |
|-----|-------|-------------|---------------|-------------------|-------|--------------------|-----------------------------|
| All Matrix Apps | oauth-authorize, oauth-token, oauth-userinfo | ✓ | system_admin only | ✓ | — | — | — |
| SSO Console | All OAuth | ✓ | ✓ | ✓ | admin-* (all 8) | register-app | — |
| HRMS | All OAuth | ✓ | ✓ | ✓ | admin-roles | sync-ad-users | hrms-sync-permissions, hrms-ad-admin, hrms-auto-sync, employee-sync, vacation-reminders, holiday-auto-post |
| Matrix Pipeline (matrix-pipeline 2.0 — consolidates broker / manager / contact-center / listing-coordinator workflows) | All OAuth | ✓ | ✓ | ✓ | admin-roles | check-mls-duplicate | lead-webhook, mls-sync-orchestrator, mls-fetch, ms-graph-proxy (email-messages / email-attach / calendar-events / calendar-sync — broker role; team views — manager role), semantic-search, parse-opportunity-info, transcribe-audio, date-reminders, log-share-event, cdl-write, plus FR-AI-LQ / MX / SC / DM LLM-wrapper EFs (`ai-lead-qualification`, `ai-match-explanation`, `ai-showing-coach`, `ai-deal-margin-coach`) |
| ITSM | All OAuth | ✓ | ✓ | ✓ | admin-roles | — | service-desk-tickets, incident-webhook, vendor-logo, ms-graph-proxy, mls-fetch |
| Matrix FM | All OAuth | ✓ | ✓ | ✓ | admin-roles | — | read-financial-entries, save-financial-entries, submit-financial-data, submission-deadlines, get-submission-progress, get-audit-log, export-audit-log, get-recent-updates, generate-test-data, delete-test-data, sso-oauth |
| MLS (Atlas / `matrix-atlas-mls`) | All OAuth | ✓ | ✓ | ✓ | — | check-mls-duplicate | mls-sync, mls-sync-orchestrator, listings-search |
| Client Portal, etc. | All OAuth | ✓ | ✓ | ✓ | — | — | — |

**Common subset**: Every app calls `oauth-authorize`, `oauth-token`, `switch-role`, `check-permissions`. `switch-tenant` is available to all apps but only usable by `system_admin` users. Admin apps add `admin-*` functions. Apps with AD sync add `sync-ad-users`. Matrix Pipeline owns O365 integration via `ms-graph-proxy` (broker / manager role-filtered). Each app deploys its own Edge Functions to its app-specific Supabase instance (see app-catalog.md for project IDs). The previously-listed separate **Broker App** / **Manager App** rows are consolidated into the single **Matrix Pipeline** row above.

## Digital Employees — Conversations public API (`converse`)

App DB project `mihslqjjclbrqelnjjpb`. Auth: `Authorization: Bearer mxde_…` (channel-bound API key; SHA-256 hashed in `api_keys`). Live OpenAPI: `GET /functions/v1/converse/openapi.json` (version **1.1.0**).

| Path | Method | Purpose |
|------|--------|---------|
| `/converse` | POST | Stateful turn (default) or `stateless: true` one-shot (no memory / knowledge / persistence) |
| `/converse` | GET | Thread history for `externalId` + optional `threadId` |
| `/converse/transcribe` | POST | Audio → transcript + language detection; optional `reply: true` runs a stateful turn |
| `/converse/suggest` | POST | Up to 3 broker-voice draft replies over a caller-owned transcript |
| `/converse/translate` | POST | Deterministic translation (`translated`, `detectedLanguage`) |
| `/converse/openapi.json` | GET | Public OpenAPI 3.1 spec (no key) |
| `/converse/widget.js` | GET | Embeddable chat widget |

**SR000518 (2026-08-28).** Extends `converse` so Matrix Comms can replace the external HumaticAI RAGChat PaaS for voice-note STT, tap-to-translate, and broker reply coaching. Integration map: `matrix-digital-employees/docs/public-api-comms-integration.md`. Comms client rewiring is a follow-up in `matrix-comms`. Transcription usage writes an estimated `cost_usd` (from audio duration) so tenant **cost** ceilings apply; token ceilings still only count chat tokens.

## Cross-Reference

| For | See |
|-----|-----|
| JWT structure and RLS | [security-model.md](security-model.md) |
| Deployment and CI/CD | [operations.md](operations.md) |
| App integration patterns | [app-template.md](app-template.md) |
| O365 email & calendar integration | [o365-exchange-integration.md](o365-exchange-integration.md) |
| Digital Employees Conversations API (Comms cutover) | `gca-ltd/matrix-digital-employees` → `docs/public-api-comms-integration.md` |