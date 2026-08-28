# SSO Edge Functions — API Contracts

> Source: SSO instance `xgubaguglsnokjyudgvc` — Supabase Edge Functions (Deno runtime)
> Implementation: `matrix-platform-foundation/supabase/functions/`
>
> **For Lovable**: These are the Edge Functions your app calls for authentication, role management, and admin operations. All are deployed with `verify_jwt: false` unless noted — your code handles JWT verification.

## Canonical token verification (`_shared/verify-sso-jwt.ts`)

> **One verifier for the whole SSO EF surface (2026-07-09 — ADR-011).** Every
> verifying SSO Edge Function calls `verifySsoJwt(token, { supabase, allowOpaque })`
> from `supabase/sso/functions/_shared/verify-sso-jwt.ts`. Verification order:
>
> 1. **ES256 via JWKS** — `createRemoteJWKSet` against the public `sso-jwks`
>    endpoint (the **public** key). This is the canonical path.
> 2. **HS256** — app-specific secret (via `client_id` → `jwt_secret_name` →
>    vault) else `JWT_SECRET`. Legacy fallback for `jwt_secret_name` apps only.
> 3. **Opaque** — `sso_access_tokens` DB lookup, **only** when `allowOpaque:true`
>    (`oauth-userinfo`, `switch-*`, `mint-delegated-token`).
>
> **Never verify with the private key.** WebCrypto refuses to verify with a
> private key; verification uses the public JWKS. The private vault key
> (`sso_es256_signing_key`) is used **only for signing** in `oauth-token`,
> `switch-role`, `switch-tenant`, `mint-delegated-token`. The per-EF
> "Token verification order" notes below are all instances of this one helper.
>
> Refactored onto the helper: `resolve-users`, `sso-member-roster-lint`,
> `admin-tenants`, `oauth-userinfo`, `switch-tenant`, `switch-role`,
> `mint-delegated-token`, and `_shared/admin.ts` (all `admin-*` EFs).

## OAuth Flow Functions

These implement the OAuth 2.0 + PKCE flow used by all Matrix Apps.

### `oauth-authorize`

| Field | Value |
|-------|-------|
| Method | `GET` |
| Auth | None (initiates flow) |
| `verify_jwt` | `false` |
| Purpose | Starts OAuth flow — validates `client_id`, `redirect_uri`, `code_challenge`, generates authorization code |

**Query Parameters**: `client_id`, `redirect_uri`, `response_type=code`, `code_challenge`, `code_challenge_method=S256`, `state`, `scope`

**Response**: Redirects to SSO login page with session context.

### `oauth-token`

| Field | Value |
|-------|-------|
| Method | `POST` |
| Auth | None (exchanges code/refresh token) |
| `verify_jwt` | `false` |
| Purpose | Exchanges authorization code or refresh token for JWT. Signs ES256 or HS256 per app config ([ADR-011](../architecture/decisions/ADR-011.md)). |

**Grant Types**:
- `authorization_code` — exchanges code + PKCE verifier for access token + refresh token
- `refresh_token` — exchanges refresh token for new access token

**Request Body** (`application/json`):
```json
{
  "grant_type": "authorization_code",
  "code": "<authorization_code>",
  "redirect_uri": "<app_callback_url>",
  "client_id": "<client_id>",
  "code_verifier": "<pkce_verifier>"
}
```

**Server-managed PKCE (per-app opt-in)** — for public clients flagged
`sso_applications.server_managed_pkce = true`, `code_verifier` is **optional**:
the gate requires it only when `!app.server_managed_pkce`. Such clients send no
`code_challenge` (so the conditional challenge-validation is skipped) and exchange
on the code alone; authorization rests on the single-use, short-TTL code bound to
`redirect_uri` + `client_id` + an authenticated SSO session. This makes fresh
logins survive storage-stripping embedded browsers (Cursor in-IDE webview). The
flag defaults `false`; only Matrix Pipeline 2.0 is enabled so far. Backward
compatible — a client still sending challenge+verifier validates as before. See
[ADR-019](../architecture/decisions/ADR-019.md).

**Response** (`200`):
```json
{
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<opaque_token>",
  "supabase_access_token": "<native_token>",
  "sso_role": { "id": "<uuid>", "name": "Sales Manager" },
  "scope": { "id": "team", "name": "Team" },
  "crud": "crud"
}
```

**Embedded JWT claims (2026 — login round-trip elimination)**: the minted access token now carries the **full consumed profile** so first-party apps can hydrate the user from the signed JWT without a second `oauth-userinfo` call. In addition to the role/scope/org claims it already carried (`sso_role`, `scope`, `crud`, `active_scope`, `organization`, `teams`, `allowed_apps`, `uoi`, `org_name`, `team_ids`, `groups`, `permissions`, `member_type`, `act_as_roles`, `attrs`), it now also includes: `email`, `email_verified`, `name`, `picture`, `available_roles`, and `tenant_id`. These are ES256-signed (equivalent trust to the userinfo response). The shared `matrix-apps-template-2-1` decodes them via `decodeUserFromToken` on login. Apps that have not synced the template keep calling `oauth-userinfo` and keep working. (See [performance.md](performance.md#sso-login-latency-auth-critical-path).)

**Side effects** (all **deferred** off the synchronous mint path via `EdgeRuntime.waitUntil` — they do not block the token response):
- Persists `active_scope`, `active_crud`, `active_team_ids` to `auth.users.raw_app_meta_data`. This is now a **fallback only**: the SSO-DB RLS helpers (`sso_get_active_scope`, `sso_get_crud`, `sso_get_current_team_ids`) read `request.jwt.claims` **first** and only consult `raw_app_meta_data` when the claim is absent — and the minted JWT always carries those claims, so deferring this write does not affect RLS for freshly-minted tokens.
- Backfills `tenant_id` / `azure_object_id` into `user_metadata` when missing.
- Stores token in `sso_access_tokens` table (synchronous; not deferred). ⚠️ The enriched JWT (~3.4 KB) exceeds the btree row-size limit (2704 bytes), so `sso_access_tokens.token` is indexed with a **hash** index (`idx_access_tokens_token_hash`, equality lookups only) plus a `md5(token)` **unique** guard — NOT a plain/unique btree on the raw token. Re-adding a btree index on the raw `token` column will break every login/refresh. (migration `20260601143000_fix_sso_access_tokens_token_index_for_enriched_jwt`.)

**Token-mint performance**: `getUserById` and `loadDefaultSettings` are fetched **once** per request and the independent reads (permissions, groups, roles, teams, attributes) run in `Promise.all` (previously serial, with a duplicate `getUserById`). See [performance.md](performance.md#sso-login-latency-auth-critical-path).

**Signing reliability (ES256-or-fail-closed)** — applies to all JWT-minting functions (`oauth-token`, `switch-role`, `switch-tenant`):
- The ES256 signing key (`get_vault_secret('sso_es256_signing_key')`) is **cached in module scope** (10 min TTL + in-flight de-dup) and fetched with a short retry. One successful vault load serves the warm instance, so a transient vault blip no longer forces a downgrade. The TTL lets a future key rotation propagate.
- For apps **without** `jwt_secret_name` (ES256 apps — their DB trusts only the SSO ES256 JWKS, kid via `sso-jwks`), if the ES256 key still cannot be resolved the function **fails closed with HTTP `503 temporarily_unavailable`** instead of silently minting an HS256 token. A downgraded HS256 token would be rejected by the app DB at the PostgREST auth layer (401), producing a confusing post-login 401 storm; a retryable 503 at mint time is the correct failure.
- For apps **with** `jwt_secret_name` (e.g. `jwt_secret_sso_console` → Sharp Matrix Portal, Appointment Reports/meeting-hub, New Client Registration/client-connect; per-app HRMS/ITSM secrets), behavior is unchanged: they always sign HS256 with their app secret and never touch the ES256 path or the 503 fail-closed branch.

**Issuer (`iss`) — 2026-05-31**: all minted tokens set `iss = https://xgubaguglsnokjyudgvc.supabase.co/auth/v1` (the SSO project's GoTrue issuer URL; was `"matrix-sso"`). This lets own-DB app projects verify SSO ES256 tokens via **Supabase Third-Party Auth** (which matches the token `iss` against a registered URL issuer + JWKS). The MLS app DB (`wckwfbbqiupvallmhqbu`, used by Pipeline / Atlas / Matrix MLS) has this TPA registered. Nothing verifies the old `"matrix-sso"` value — see [ADR-018](../architecture/decisions/ADR-018.md).

### `oauth-userinfo`

| Field | Value |
|-------|-------|
| Method | `GET` |
| Auth | `Bearer <SSO JWT>` |
| `verify_jwt` | `false` |
| Purpose | Returns current user info and role claims |

**Optional on the login path (2026)**: because `oauth-token` now embeds the full
profile in the JWT, first-party apps no longer call this on login — the shared
template hydrates from claims and calls `oauth-userinfo` only in the **background**
(freshness refresh) and for not-yet-migrated apps. **The response shape below is
frozen** — existing apps hydrate their entire user (incl. `act_as_roles`,
`member_type`, `permissions`, `groups`, `tenant_id`) from it. New JWT claims are
additive; userinfo fields are never renamed or removed.

**Token verification order** (incoming bearer): ES256 (cached vault key) → HS256
(`JWT_SECRET` / app secret) → opaque-token lookup (`sso_access_tokens`). The ES256
signature is now verified (previously an ES256 token fell through to the opaque DB
lookup with no signature check — KB gap H4, closed).

**Response** (`200`):
```json
{
  "sub": "<user_uuid>",
  "email": "user@sharpsir.group",
  "email_verified": true,
  "sso_role": { "id": "<uuid>", "name": "Sales Manager" },
  "scope": { "id": "team", "name": "Team" },
  "crud": "crud",
  "organization": { "id": "<tenant_uuid>", "name": "Sharp Sotheby's" },
  "teams": [{ "id": "<uuid>", "name": "Dubai Sales" }],
  "allowed_apps": [{ "id": "client_id", "name": "Pipeline Management" }],
  "available_roles": [{ "uuid": "<uuid>", "name": "Sales Manager", "scope": "team", "is_primary": true }],
  "tenant_id": "<tenant_uuid>",
  "member_type": "Broker",
  "act_as_roles": []
}
```

### `oauth-login`

| Field | Value |
|-------|-------|
| Method | `POST` |
| Auth | None |
| `verify_jwt` | `false` |
| Purpose | In-app login (email + password) — used by Lovable preview environment |

### `oauth-callback`

| Field | Value |
|-------|-------|
| Method | `GET` |
| Auth | None |
| `verify_jwt` | `false` |
| Purpose | Handles Azure AD redirect after authentication |

### `oauth-revoke`

| Field | Value |
|-------|-------|
| Method | `POST` |
| Auth | `client_id` + the refresh token itself (RFC 7009) |
| `verify_jwt` | `false` |
| Purpose | Revokes a refresh token. Authenticated by `client_id` (+ `client_secret` for confidential clients) and the token value — no SSO/Supabase JWT required. |

> **2026 fix**: `oauth-revoke` was previously `verify_jwt: true`, which forced the
> caller to hold a live Supabase session token just to log out. Per RFC 7009 and
> the rest of the OAuth surface it now runs `verify_jwt: false` and validates the
> client + token internally. Resolves the documented contradiction in this doc.

## Role Management

### `switch-role`

| Field | Value |
|-------|-------|
| Method | `POST` |
| Auth | `Bearer <SSO JWT>` |
| `verify_jwt` | `false` |
| Purpose | Re-issues JWT with a different active role. Signs ES256 or HS256 per app config. |

**Request Body**:
```json
{
  "role": "<role_uuid>",
  "client_id": "<client_id>",
  "client_secret": "<optional_for_public_clients>"
}
```

**Response** (`200`):
```json
{
  "access_token": "<new_JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<new_refresh_token>",
  "sso_role": { "id": "<uuid>", "name": "HR Manager" },
  "scope": { "id": "global", "name": "Global" },
  "crud": "crud"
}
```

**Token verification order** (incoming bearer):
1. ES256 (vault key)
2. App-specific HS256 (vault secret via `jwt_secret_name`)
3. SSO HS256 (`JWT_SECRET` env)
4. Opaque token lookup (`sso_access_tokens`)

**Side effects**: Persists `active_role_id` to `user_metadata`.

### `switch-tenant`

| Field | Value |
|-------|-------|
| Method | `POST` |
| Auth | `Bearer <SSO JWT>` |
| `verify_jwt` | `false` |
| Purpose | Re-issues JWT with a different active tenant/organization. Only `system_admin` scope. |

**Request Body**:
```json
{
  "tenant_id": "<tenant_uuid>",
  "client_id": "<client_id>"
}
```

**Response** (`200`):
```json
{
  "access_token": "<new_JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<new_refresh_token>",
  "organization": { "id": "<tenant_uuid>", "name": "Acme Corporation" }
}
```

**Error responses**:
- `403` `insufficient_scope` — caller does not have `system_admin` scope
- `404` `invalid_tenant` — tenant not found or inactive

**Token verification order**: Same as `switch-role` (ES256 → app HS256 → SSO HS256 → opaque lookup).

**Side effects**: Persists `tenant_id` to `user_metadata`. JWT `organization`, `uoi`, and `org_name` claims reflect the new tenant. Role/scope/CRUD remain unchanged.

**Relationship to `switch-role`**: Role switching changes *what you can do* (scope + CRUD). Tenant switching changes *which organization's data you see* (cross-tenant context for platform admins).

## Delegated Minting (ADR-032)

### `mint-delegated-token`

Service-to-service minting for the ITSM MCP chat-identity binding (chat agent). Lets a **delegate app** (the ITSM MCP) act for a user **without holding any user credential**, against a **revocable delegation grant**. `verify_jwt = false`; gated by a **service credential** in the `X-Delegation-Secret` header (env `MCP_DELEGATION_SECRET`) — never a per-user token.

Single deployable, routed by `action` in the JSON body:

| Action | Input | Output | Notes |
|---|---|---|---|
| `mint` | `{ grant_id }` | `{ access_token, token_type, expires_in, scope }` | Active-grant check + 90-day inactivity expiry; mints a **short-lived (~30 min) ES256 JWT** for the grant's user (claim shape per `oauth-token`, signed exactly as that app expects — ES256 for SSO-instance apps); updates `last_minted_at`/`mint_count`; per-isolate rate limit. **No token is stored** (verified by signature, so no `sso_access_tokens` row). |
| `create_grant` | `{ platform, client_id, external_user_ref, assurance, (user_bearer \| azure_oid \| email) }` | `{ grant_id, user_id, email, tenant_id, assurance }` | Resolves the canonical SSO user: interactive ⇒ verify `user_bearer`; Teams auto-bind ⇒ `mcp_resolve_user(azure_oid|email)`; **Web** ⇒ `user_bearer` only (verified on every request; idempotent grant reuse). Supersedes any prior active grant for `(client_id, platform, external_user_ref)` except web reuse when the same user matches. |
| `revoke_grant` | `{ grant_id }` | `{ ok }` | Marks the grant revoked (called from ITSM admin revoke). |

**Backing store**: `sso_delegation_grants` (service-role only) + `mcp_resolve_user(email, azure_oid)` SECURITY DEFINER RPC (service-role execute only). **Signing reliability**: same ES256-or-fail-closed rule as `oauth-token`/`switch-role`.

**Trust chain**: the minted token is the last hop of `Platform → (signed webhook) → chat agent → (OAuth code+PKCE+secret → MCP access token) → MCP → (X-Delegation-Secret) → mint`. The agent authenticates to MCP with OAuth 2.1 authorization-code + PKCE (confidential client: `client_id` + `client_secret`); the signing key is never a bearer. The chat id is platform-asserted; the agent must verify the platform webhook signature before forwarding it.

**ITSM MCP tool tiers (app DB `mcp-server`, ADR-032)**: `tools/list` returns the full catalogue for agent tokens; execution is gated at `tools/call`.

| Tier | Tools | Requirements |
|------|-------|--------------|
| **Public** | `whoami`, `tool_guidance`, `search_kb`, `get_article`, `create_ticket` | Agent access token only — works in group chats and before user identity is known |
| **Private** | `list_tickets`, `get_ticket`, `update_ticket`, `search_assets`, `get_asset` | Direct 1:1 chat + `X-Chat-*` headers + linked Sharp SIR SSO account (web: `X-Chat-User-Bearer` auto-bind) |
| **Link** | `link_account` | Direct 1:1 chat + verified platform user id (one-time SSO URL for Telegram/WhatsApp; not web) |

Each tool description uses HubSpot-style structured sections (`<capabilities>` / `<when_to_use>`, `<returns>`, `<usage_guidance>`, `<availability>`). Call **`tool_guidance`** for deeper cross-tool workflows. Blocked private calls return JSON-RPC `-32003` with `reason: private_requires_dm` (`cause`: `group_chat` \| `no_user_id` \| `no_verified_session` for web). Step-up consent applies to ticket close/resolve via `update_ticket` only. Approval MCP tools (`list_pending_approvals`, `approve`, `reject`) were removed — the in-app approval UI remains.

**Web identity headers** (in-app chat): `X-Chat-Platform: web`, `X-Chat-Scope: direct`, `X-Chat-User-Id: <SSO user UUID>`, `X-Chat-User-Bearer: <SSO access token>`. The bearer is verified on every private call via `create_grant(user_bearer)` — not a bare `X-Chat-Verified` flag.

## Admin Functions

All admin functions require `org_admin` or `system_admin` scope.

**Token verification (`_shared/admin.ts` — `requireAdmin` / `requireAdminOrOrgAdmin` / `requireUserManagement`)**: delegates to the shared `verifySsoJwt()` helper — **ES256 via the public JWKS** (`sso-jwks`) → HS256 (app-specific via `jwt_secret_name`, else `JWT_SECRET`) → then a Supabase-native (`auth.getUser`) fallback for Console sessions. There is **no** opaque-token DB fallback here (unlike `oauth-userinfo`), so the signature path must actually verify. As of 2026-07-09 this no longer fetches the private vault key — see [ADR-011 §Verification consolidation](../architecture/decisions/ADR-011.md).

> **2026-06-01 fix — admin EFs 401'd for ES256 apps (e.g. Matrix Pipeline 2.0).** The shared admin helper previously ran an **HS256-only** `jwtVerify`. ES256 SSO tokens (apps with no `jwt_secret_name`) failed it, fell through to `auth.getUser()` (which rejects custom tokens), and returned **401** — most visibly on the Pipeline **AD Employees** page (`admin-ad-users`). HRMS was unaffected because it uses an HS256 app secret (`jwt_secret_smhrms`). Fix: add ES256-first verification mirroring `oauth-userinfo`, **deriving the PUBLIC JWK (drop `d`)** before `importJWK`. Importing the stored *private* JWK as-is yields a sign-only key that `jwtVerify` cannot use (it would throw and silently downgrade to HS256). All 9 admin EFs that import `_shared/admin.ts` (`admin-ad-users`, `admin-users`, `admin-roles`, `admin-apps`, `admin-groups`, `admin-permissions`, `admin-privileges`, `admin-dashboard`, `admin-microsoft-auth`) were redeployed (`verify_jwt=false`). Verified: a minted `rw_global`/`global`-scope ES256 token → `admin-ad-users` 200 (was 401). Note `admin-dashboard` also had a stale `./_shared` import path corrected to `../_shared`. **Related latent issue (not fixed here):** `oauth-userinfo`'s ES256 path imports the private JWK too, so it is effectively inert and only succeeds via its opaque-token DB fallback — it should adopt the same public-key derivation (follow-up).

| Function | Method | Purpose |
|----------|--------|---------|
| `admin-users` | `GET/POST/PATCH/DELETE` | CRUD for SSO users (list, create, update, delete, reset password) |
| `admin-roles` | `GET/POST/PATCH/DELETE` | CRUD for `sso_roles` (list, create, update CRUD flags, delete) |
| `admin-apps` | `GET/POST/PATCH/DELETE` | CRUD for `sso_applications` (register, update, deactivate) |
| `admin-groups` | `GET/POST/PATCH/DELETE` | CRUD for `sso_user_groups` and memberships |
| `admin-permissions` | `GET/POST/DELETE` | CRUD for `sso_user_permissions` |
| `admin-tenants` | `GET/POST/PATCH` | CRUD for `tenants` |
| `admin-dashboard` | `GET` | Dashboard statistics (user counts, role distribution, login activity) |
| `admin-privileges` | `GET/POST/PATCH` | Manage privilege escalation and delegation |
| `check-permissions` | `POST` | Check if a user has a specific permission for an app |

> **2026-06-02 — `admin-apps` PUT gained two fields** (redeployed `verify_jwt: false`):
> - **`server_managed_pkce`** (boolean): read in the GET single/list selects and written in PUT (`updateData.server_managed_pkce = !!server_managed_pkce`). Surfaced as the **Server-managed PKCE** toggle in the Console Edit Application dialog (public clients only). See [ADR-019](../architecture/decisions/ADR-019.md).
> - **`client_id`** (string): a changed `client_id` is **not** a plain column update (it is FK-referenced by `sso_access_tokens` / `sso_authorization_codes` `ON UPDATE NO ACTION`). The PUT handler fetches the current `client_id` and, if different, calls the `public.sso_rename_client_id(p_old, p_new)` RPC, which runs `SET CONSTRAINTS … DEFERRED` and repoints children + parent atomically (migration `20260602170000_client_id_rename_support` made both FKs `DEFERRABLE INITIALLY IMMEDIATE`). Error mapping: `23505 → 409 client_id_in_use`, `22023 → 400 invalid_request`, `P0002 → 404 not_found`. **Operational caveat:** a renamed app cannot authenticate until its `VITE_SSO_CLIENT_ID` is updated and it is rebuilt/redeployed (the Console dialog warns + requires confirmation).

> **2026-06-09 — `admin-apps` gained Console-managed TPA provisioning** (redeployed `verify_jwt: false`; see [ADR-027](../architecture/decisions/ADR-027.md)). New sub-routes mirroring the `/{id}/jwt-secret` pattern:
> - **`POST /admin-apps/{id}/provision-tpa`** — body `{ project_ref?: string, reload?: boolean }`. Resolves the App DB ref (from body, a pasted `https://<ref>.supabase.co`, or the stored `app_supabase_project_ref`), reads the platform Management PAT from the SSO Vault (`get_vault_secret('sso_supabase_management_pat')`), and calls the Supabase Management API `…/config/auth/third-party-auth` to register the SSO issuer/JWKS on that project. Idempotent: if the issuer is already registered it marks `provisioned` without re-creating; `reload: true` does DELETE + POST to force a Data-API reload. On success sets `tpa_status='provisioned'`, `tpa_provisioned_at`, `tpa_integration_id`, clears `tpa_last_error`, and sets `jwt_secret_name = NULL` (ES256). On failure: `tpa_status='failed'` + `tpa_last_error`, HTTP `502`. Missing PAT → `500 pat_not_configured`; bad/absent ref → `400 invalid_request`.
> - **`GET /admin-apps/{id}/tpa`** — returns `{ app_supabase_project_ref, tpa_status, tpa_provisioned_at, tpa_integration_id, tpa_last_error }`.
> - **`app_supabase_project_ref`** is also accepted in create (`POST`) and update (`PUT`) and included in the GET single/list selects (migration `20260609180000_app_tpa_provisioning`). Replaces the per-app throwaway `bootstrap-tpa` EF + `ACCOUNT_ACCESS_TOKEN`.

## Identity & Directory

| Function | Method | Purpose |
|----------|--------|---------|
| `sync-azure-profile` | `POST` | Syncs user profile from Azure AD (photo, job title, department) |
| `sync-ad-users` | `POST` | Bulk syncs Azure AD user directory to `ad_users` table |
| `sync-ad-photos` | `POST` | Syncs Azure AD profile photos to storage |
| `admin-ad-users` | `GET` | Queries Azure AD directory with filtering |
| `admin-microsoft-auth` | `POST` | Manages Microsoft Graph API tokens for AD integration |
| `sso-token-exchange` | `POST` | Exchanges external tokens for SSO tokens |
| `sso-member-roster-lint` | `POST` | Daily lint: diffs SSO `auth.users` ↔ CDL `public.members` (by email) and persists a drift report. `verify_jwt: false`. |

### `admin-ad-users` identity contract

List responses keep **`id = azureObjectId`** so HRMS / Graph consumers stay unchanged. Each row also carries:

| Field | Meaning |
|-------|---------|
| `id` | Azure OID (Microsoft Graph id) — HRMS primary key |
| `azureObjectId` | Same Azure OID |
| `_supabase_id` | `ad_users` table PK |
| `supabaseUserId` | `auth.users.id` (= JWT `sub`) when the AD row is provisioned in SSO; otherwise `null` |

**Apps that store assignee / owner as JWT `sub` (e.g. MSA `x_assigned_user_id`) must write and match `supabaseUserId`, never list `id`.** Rows with `supabaseUserId: null` are AD-only and must not be offered as App-DB assignees.

`GET /admin-ad-users/:id` accepts **any** of: `ad_users.id`, `azureObjectId`, or `auth.users.id` (bridged via `raw_user_meta_data.azure_object_id` or email → `ad_users.mail`). The response is wrapped as `{ "user": { … } }` (same transform as list rows).

### `sync-ad-users` (directory cache)

SSO owns the Entra/Azure AD directory snapshot in `public.ad_users` on project `xgubaguglsnokjyudgvc`. Apps such as **ITSM** and **HRMS** **consume** that cache (PostgREST / `admin-ad-users`) — they do **not** run their own Graph directory sync.

- **Schedule**: `pg_cron` job `ad-users-sync-30min` (`*/30 * * * *`) → `POST /sync-ad-users?triggered_by=scheduled`.
- **Manual full sync**: `POST /sync-ad-users?full=true&triggered_by=manual` (service-role bearer) or `POST /admin-ad-users/sync?full=true` (admin JWT).
- **Enrich-on-delta / fast-path-on-full**: per-user manager, profile (`aboutMe`…), and photo Graph calls run only on **delta** syncs. Full syncs skip them so the Edge Function finishes within its wall-clock limit (photos remain on `sync-ad-photos`). On full-sync **UPDATE**s, enrichment columns (`manager*`, profile fields, `photoUrl`) are omitted from the patch so prior values are not wiped. All Requestor-search fields (`displayName`, `givenName`, `surname`, `mail`, `jobTitle`, `department`, `officeLocation`, `usageLocation`, `accountEnabled`) come from the delta `$select`.
- **Stale-lock watchdog**: if `ad_sync_status.status = 'running'` for more than 15 minutes, the next run clears the lock (and orphaned `ad_sync_log` rows) and continues. Fresh concurrent runs still get `409 sync_in_progress`.
- **Ops runbook** (stuck / stale directory):
  1. Deploy the current `sync-ad-users` source (`verify_jwt: false`).
  2. If still stuck: `UPDATE ad_sync_status SET status='idle', error_message=NULL WHERE id='default' AND status='running'`; cancel orphaned `ad_sync_log` rows with `status='running'`.
  3. `POST …/sync-ad-users?full=true&triggered_by=manual`.
  4. Confirm `status='idle'`, `delta_link` present, and spot-check users; confirm the next scheduled delta completes (`success`, not 409).

### `sso-member-roster-lint`

Added 2026-06-03 for the matrix-pipeline Week 1 Cursor task (risk **R3** — identity-boundary drift; see [`product-specs/matrix-pipeline/phases.md#week-1-cursor`](../product-specs/matrix-pipeline/phases.md) and [`product-specs/matrix-pipeline/wiki/architecture.md#identity-boundary`](../product-specs/matrix-pipeline/wiki/architecture.md)).

- **Purpose**: surface drift between the SSO identity roster (`auth.users` on `xgubaguglsnokjyudgvc`) and the canonical business roster (CDL `public.members` on `ofzcokolkeejgqfjaszq`) so the SSO-user ↔ `Member` mapping can be built and kept honest.
- **Join key — email**, not `MemberAlternateId`. CDL `members` has **no `member_alternate_id` column**, so the canonical "SSO `user_id` ↔ `Member.MemberAlternateId`" mapping is not materialized. See [`data-models/cdl-schema.md`](../data-models/cdl-schema.md) "Owner-clamp deferred". The lint diffs normalized email and reports the unmapped roster.
- **Access model**: SSO users read locally via the service role (`auth.admin.listUsers`); CDL `members` read cross-project via the **CDL anon key** (allowed by the `members_anon_select` RLS policy) — **no CDL service-role key is held** (ADR-013 spirit). This is a platform-foundation governance EF, not an app.
- **Contract**: `POST /sso-member-roster-lint?triggered_by=scheduled|manual` → `{ ok, run_id, has_mismatch, totals, unmatched_members[], unmatched_sso_users[], email_status }`. Inserts one row into `public.sso_member_roster_lint_runs` (service-role-only RLS).
- **Auth** (`verify_jwt: false`): the daily cron sends the SSO service_role bearer; manual runs require an SSO admin / `system_admin` JWT. Forged/unsigned `service_role` claims are rejected (the cron path requires either the exact committed bearer or a cryptographically verified `role=service_role`).
- **Schedule**: `pg_cron` job `sso-member-roster-lint-daily` at `15 6 * * *` UTC (migration `20260603130000_sso_member_roster_lint.sql`).
- **Email**: opt-in only — there is **no platform mailer yet**. If `ROSTER_LINT_RESEND_KEY` + `ROSTER_LINT_RECIPIENTS` are set, a Resend summary is sent on mismatch; otherwise `email_status = skipped_no_provider` and the run is still persisted. Wiring a mail provider is the remaining sub-task.
- **First run (2026-06-03)**: 72 SSO users / 107 active members; only **36 matched by email**; 71 active (legacy `QOBRIX_AGENT_*`) members had no SSO login and 36 SSO users had no `Member` — quantifying the R3 drift.

## AI & Utility

| Function | Method | Purpose |
|----------|--------|---------|
| `portal-agent-chat` | `POST` | AI chat for the portal (RAG-powered) |
| `rag-search` | `POST` | Semantic search over KB embeddings |
| `parse-meeting-info` | `POST` | AI extraction of meeting details from text |
| `parse-client-info` | `POST` | AI extraction of client details from text |
| `parse-advisor-command` | `POST` | AI parsing of natural language commands |
| `transcribe-audio` | `POST` | Speech-to-text transcription |
| `text-to-speech` | `POST` | Text-to-speech synthesis |
| `generate-summary` | `POST` | AI text summarization |
| `batch-generate-summaries` | `POST` | Batch AI summarization |

## CDL Data Functions

| Function | Method | Purpose |
|----------|--------|---------|
| `check-mls-duplicate` | `POST` | Checks for duplicate MLS listings before import |
| `fetch-mls-contacts` | `POST` | Fetches MLS contact data for matching |

## Utility

| Function | Method | Purpose |
|----------|--------|---------|
| `upload-app-icon` | `POST` | Uploads application icon to storage |
| `get-users-with-emails` | `GET` | Resolves user UUIDs to email addresses |
| `admin-set-password` | `POST` | Admin resets user password |
| `validate-sso-token` | `POST` | Validates an SSO token and returns claims |
| `generate-sso-token` | `POST` | Generates an SSO token for service-to-service calls |

## `verify_jwt` Configuration

All SSO-facing functions use `verify_jwt: false` with custom JWT verification in code. This is required because:

1. Custom SSO tokens (ES256/HS256) are not Supabase Auth tokens
2. `verify_jwt: true` causes Supabase to reject the request **before** your code runs if the JWT isn't a valid Supabase native token
3. Functions need to accept tokens from multiple sources (ES256, app HS256, SSO HS256, opaque)

**Exceptions** (`verify_jwt: true` — accept Supabase native tokens only): `admin-set-password`, `generate-sso-token`, `validate-sso-token`, `get-users-with-emails`.

> **2026 fix**: `oauth-revoke`, `resolve-users`, and `check-privileges` were moved to `verify_jwt: false` (added explicitly to `config.toml`). They accept **custom SSO tokens** (or, for revoke, client-credentials + token) and verify internally, so gating them with the platform JWT check was incorrect — it rejected valid ES256 SSO tokens / forced a live Supabase session for logout. This closes the documented `verify_jwt` contradiction.

See [ADR-007](../architecture/decisions/ADR-007.md) for the Edge Function architecture decision.

## Cross-Reference

| For | See |
|-----|-----|
| JWT claims structure | [security-model.md](security-model.md#jwt-claims-structure) |
| ES256 signing logic | [security-model.md](security-model.md#jwt-signing--es256-target--hs256-legacy) |
| ES256 migration plan | [ADR-011](../architecture/decisions/ADR-011.md) |
| Unified TPA / key-rotation runbook | [ADR-018](../architecture/decisions/ADR-018.md) |
| App-side auth hooks | [app-template.md](app-template.md#auth-hooks) |
| Full app auth flow | [app-template.md](app-template.md#sso-auth-flow) |

## Health probe — catch JWT-verification regressions

`~/tmp/sso_health_probe.mjs` mints a short-lived ES256 token (in-memory, from the
`sso_es256_signing_key` vault secret) and asserts `200` across the whole unified
verification surface, so a broken TPA registration, an un-reloaded Data API, or a
botched key rotation is caught immediately (it would show `PGRST301` on PostgREST
or `401` on an EF):

| Target | What it proves |
|---|---|
| SSO `sso_roles` (PostgREST) | SSO verifies its own ES256 via the GoTrue standby key |
| App DB `role_configurations` (PostgREST) | App DB Third-Party Auth → SSO JWKS |
| CDL `members` (PostgREST) | CDL Third-Party Auth → SSO JWKS (ADR-018, 2026-06-01) |
| CDL `cdl-contacts-read` (EF) | CDL EF in-code signature verification |
| SSO `admin-ad-users` (EF) | SSO admin EF ES256 signature gate (`_shared/admin.ts`) |

```bash
# anon + service-role keys come from `supabase projects api-keys`
SR="$SSO_SERVICE_ROLE_KEY" \
  SSO_ANON=… CDL_ANON=… APP_ANON=… \
  node ~/tmp/sso_health_probe.mjs    # exit 0 = ALL PASS, 1 = a regression
```

> `oauth-userinfo` is deliberately **not** probed: its ES256 path is inert and it
> only succeeds via an opaque-token DB lookup, so a hand-minted token 401s by
> design. Run this probe after any TPA / JWKS / signing-key change.
