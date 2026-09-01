# Security Model — Auth, Roles, Permissions, RLS

> Source: `matrix-platform-foundation` (SSO instance `xgubaguglsnokjyudgvc`)
> Implementation: `matrix-platform-foundation/SECURITY_MODEL.md`, `supabase/migrations/`, `supabase/functions/`
>
> **For Lovable**: This document defines how auth, roles, and permissions work.
> Every Matrix App must follow these patterns. See also [app-template.md](app-template.md) for how apps consume the security model.

## 5-Level Scope Hierarchy

```
self → team → global → org_admin → system_admin
```

Each higher scope includes the visibility of all lower scopes.

| Scope | Data Visibility | Typical Role | Example |
|-------|----------------|-------------|---------|
| `self` | Own records only | Broker, Staff | A broker sees only their own clients and listings |
| `team` | Own + team members' records | Team Leader, Manager | A sales manager sees all records for their team |
| `global` | All records in tenant | Director, C-suite | A sales director sees every listing and deal across all teams |
| `org_admin` | Full tenant access + admin functions | Organization Admin | Can manage users, roles, app configurations for the organization |
| `system_admin` | Cross-tenant access + tenant switching | System Admin | Platform-wide access across all organizations; can switch active tenant via `switch-tenant` |

### Tenant Switching (system_admin only)

Users with `system_admin` scope can switch their active tenant context via the `switch-tenant` Edge Function. This re-issues the JWT with updated `organization`/`uoi` claims pointing to the target tenant, while keeping the current role and scope unchanged. The switch is persisted in `user_metadata.tenant_id` so that token refresh and subsequent logins preserve the selected tenant.

This is analogous to role switching (`switch-role`) but operates on the organizational axis:
- **Role switching** changes *what you can do* (scope level + CRUD permissions)
- **Tenant switching** changes *which organization's data you see* (cross-tenant context)

Both produce a fresh JWT with new tokens. The frontend clears all cached data on tenant switch to prevent cross-tenant data leaks.

**Tenant roster + branding reads (post-login):** After the 2026-07-07 anon lockdown (C8/C9), apps must load the active-tenant roster (`TenantSwitcher`) and per-tenant branding (`useTenantBranding`, `OrgAdminPanel`) via the **authenticated** SSO client (`ssoAuthedClient` / `ssoClient` with `postgrestAccessToken`), not the anon key. The SSO project verifies the ES256 JWT via its GoTrue standby key; RLS policy `"Users can view own tenant"` (`has_rw_global_permission() OR id = get_my_tenant_id()`) covers system_admin roster reads and own-tenant branding. Pre-login branding is intentionally unavailable (apps fall back to defaults).

### One Sharp production tenant (all countries)

Sharp SIR operates in **Cyprus, Hungary, and Kazakhstan**, but SSO uses **one production tenant** for all of them:

| Tenant | UUID | Role |
|--------|------|------|
| Sharp Sotheby's International Realty | `1d306081-79be-42cb-91bc-9f9d5f0fd7dd` | **Production** — all Sharp countries |
| Acme Corporation | `025a9ba8-2b99-42a1-b6aa-cc573cbef1b5` | **UAT only** — keep separate |

Legacy per-country stub tenants (Hungary / Kazakhstan / Russia) and Debug Test were soft-removed (`is_active = false`) in `20260709133000_soft_remove_legacy_tenants_rename_global_admin.sql`. They must not appear in `user_metadata.tenant_id`.

**Remediation (2026-08-03):** migration `20260803140000_migrate_sharp_user_metadata_tenant.sql` rewrote stale/null Sharp-user metadata onto Sharp SIR. `oauth-token` / `oauth-userinfo` `resolveDefaultTenant` now **ignores inactive metadata tenants**, prefers an active role tenant, and self-heals metadata. Country is a business attribute (office / team / listing country), not a separate SSO tenant.

Apps load `sso_role_configurations` filtered by JWT/`AuthContext` `tenantId` — a user stuck on an inactive country stub gets **no page grants** even when their role has correct Sharp SIR configs (this is what blocked Area Manager access for users with Hungary metadata).

## CRUD Permission Strings

Format: any combination of characters `c`, `r`, `u`, `d`.

| Value | Meaning | Typical Use |
|-------|---------|-------------|
| `r` | Read only | View-only roles, reports |
| `cr` | Create + Read | Data entry, content creators |
| `ru` | Read + Update | Editors, reviewers |
| `crud` | Full access | Managers, admins |
| `rud` | Read + Update + Delete | Moderators |

**In RLS policies**: `(SELECT get_crud()) LIKE '%r%'` checks for read permission.

**In app hooks**: `useActiveRole()` returns `canCreate`, `canRead`, `canUpdate`, `canDelete` booleans.

## Roles (23 Predefined)

### Staff Level (scope: self)

| Role Key | Name | CRUD | Description |
|----------|------|------|-------------|
| `broker` | Broker | r | Default role — view own records only |
| `staff` | Staff | ru | Read and update own records |
| `senior_broker` | Senior Broker | ru | Read and update own records |

### Team Level (scope: team)

| Role Key | Name | CRUD | Description |
|----------|------|------|-------------|
| `team_leader` | Team Leader | cru | View and manage team records |
| `sales_manager` | Sales Manager | crud | Full control of sales team records |
| `office_manager` | Office Manager | crud | Full control of office team records |
| `marketing_manager` | Marketing Manager | cru | Manage marketing team records |
| `operations_manager` | Operations Manager | crud | Manage operations team records |
| `hr_manager` | HR Manager | crud | Manage HR team records |
| `it_support` | IT Support | cru | IT support with team visibility |
| `finance_officer` | Finance Officer | cru | Finance team member with team visibility |
| `bu_ceo` | BU CEO | crud | Business unit CEO — manage BU teams |
| `bu_ceo_hr` | BU CEO HR | crud | BU CEO with HR oversight responsibilities |

### Director Level (scope: global)

| Role Key | Name | CRUD | Description |
|----------|------|------|-------------|
| `sales_director` | Sales Director | crud | Global sales oversight across all teams |
| `marketing_director` | Marketing Director | crud | Global marketing oversight across all teams |
| `operations_director` | Operations Director | crud | Global operations oversight |
| `hr_director` | HR Director | crud | Global HR oversight across all teams |
| `finance_director` | Finance Director | crud | Global finance oversight |
| `it_director` | IT Director | crud | Global IT oversight |

### C-Suite Level (scope: global)

| Role Key | Name | CRUD | Description |
|----------|------|------|-------------|
| `coo` | COO | crud | Chief Operating Officer — full operational access |
| `cfo` | CFO | crud | Chief Financial Officer — full financial access |
| `ceo` | CEO | crud | Chief Executive Officer — full access |

### Admin Level (scope: org_admin / system_admin)

| Role Key | Name | Scope | CRUD | Description |
|----------|------|-------|------|-------------|
| `org_admin` | Organization Admin | org_admin | crud | Organization-wide admin with full access |
| `system_admin` | System Admin | system_admin | crud | System administrator with full cross-tenant access |

## JWT Signing — ES256 (Target) + HS256 (Legacy)

> **Goal**: All SSO JWTs should be signed with **ES256 (ECDSA P-256)** asymmetric keys. HS256 (HMAC symmetric) is **deprecated** and retained only for backward compatibility during migration.

### Current State (April 2026)

The `oauth-token` and `switch-role` Edge Functions implement a **hybrid signing strategy**:

| Condition | Algorithm | Key Source | Used By |
|-----------|-----------|-----------|---------|
| App has **no** `jwt_secret_name` (own DB trusts SSO via TPA, or uses SSO PostgREST) | **ES256** | Vault secret `sso_es256_signing_key` (JWK with `kid`) | Apps verifying via the SSO JWKS (Pipeline / Atlas MLS, HRMS, **ITSM**, …) |
| App **has** `jwt_secret_name` (own Supabase project, not yet on TPA) | **HS256** | App-specific secret from vault, or SSO `JWT_SECRET` fallback | Remaining Domain-Specific apps not yet on TPA (e.g. FM, Meeting Hub) |
| ES256 key unavailable in vault (ES256 apps) | **fail closed `503`** | — | No silent HS256 downgrade — see ADR-011 (2026-05-31) |

**Why hybrid**: Each Supabase project's PostgREST only trusts keys registered in that project. The ES256 signing key (`dab1e43f`) is a standby key in the SSO project and is served at the SSO `/auth/v1/.well-known/jwks.json`. An **own-DB app** makes its PostgREST trust SSO ES256 tokens by registering **Supabase Third-Party Auth** against that JWKS + the SSO issuer URL (see [ADR-018](../architecture/decisions/ADR-018.md)) — no key import, no secret sharing. Apps not yet on TPA stay on HS256 (`jwt_secret_name` set), signed with their project's legacy secret.

> **Issuer (2026-05-31)**: SSO tokens set `iss = https://xgubaguglsnokjyudgvc.supabase.co/auth/v1` (was `"matrix-sso"`). Supabase TPA matches the token `iss` to a registered URL issuer, so the bare string could not be used. Nothing verifies the old value — see ADR-018's audit.

### Migration Path to Full ES256

1. **Done**: ES256 key pair generated and stored in SSO vault (`sso_es256_signing_key`)
2. **Done**: ES256 public key imported as standby key in SSO project (`xgubaguglsnokjyudgvc`)
3. **Done**: `oauth-token` / `switch-role` / `switch-tenant` sign ES256 (key cached + retried; **fail-closed `503`** for ES256 apps instead of HS256 downgrade — ADR-011)
4. **Done (2026-05-31)**: SSO mints `iss` = SSO issuer URL; **Third-Party Auth registered on the MLS app DB** (`wckwfbbqiupvallmhqbu`) so Pipeline / Atlas / Matrix MLS verify ES256 natively via PostgREST — [ADR-018](../architecture/decisions/ADR-018.md)
5. **Done (2026-07-02)**: **HRMS migrated to ES256** — TPA registered on the HRMS app DB (`wltuhltnwhudgkkdsvsr`, integration `82baa4cc`) + `jwt_secret_name` cleared, so HRMS mints ES256 and reads `sso_roles` / `sso_role_configurations` on the SSO project natively (fixes Settings > Permissions `PGRST301`). HRMS frontend sends the SSO token to SSO PostgREST via the `postgrestAccessToken` hook (no native token).
6. **Done (2026-06-09 TPA; hardened 2026-08-17)**: **ITSM migrated to ES256** — TPA provisioned on app DB `irjrcskfcyierdbefrpk` (`jwt_secret_name` null). Frontend rejects non-ES256 bearers (guards against sibling-app HS256 overwrite of shared `matrix_sso_*` localStorage). MCP access-token issuer rekeyed from HMAC to ES256 P-256 — [ADR-038](../architecture/decisions/ADR-038.md).
7. **Next**: Register the same TPA on remaining own-DB app projects (FM, Meeting Hub, …), then drop their `jwt_secret_name` (ES256)
8. **Next**: Promote ES256 to "current" key in all projects, retire HS256 legacy keys
9. **Final**: Remove HS256 signing code from Edge Functions

### Token Verification Order (canonical — `_shared/verify-sso-jwt.ts`)

> **2026-07-09 (ADR-011):** every verifying SSO Edge Function delegates to one
> shared helper, `verifySsoJwt()`. Incoming bearer tokens are verified in this
> order:

1. **ES256 via the public JWKS** — `createRemoteJWKSet` against the `sso-jwks`
   endpoint (the **public** key). Canonical path. **Never** verified with the
   private vault key — WebCrypto refuses to verify with a private key.
2. **App-specific HS256** — via `get_vault_secret(app.jwt_secret_name)` (legacy `jwt_secret_name` app tokens)
3. **SSO HS256** — via `JWT_SECRET` env var (legacy SSO tokens)
4. **Opaque lookup** — match raw token string in `sso_access_tokens` (only when the caller passes `allowOpaque`)

The private vault key (`sso_es256_signing_key`) is used **only for signing**
(`oauth-token`, `switch-role`, `switch-tenant`, `mint-delegated-token`).

### ES256 Key Details

| Property | Value |
|----------|-------|
| Algorithm | ES256 (ECDSA with P-256 curve) |
| Key format | JWK (JSON Web Key) with `kid` header |
| Vault secret name | `sso_es256_signing_key` |
| Key operations | `["sign", "verify"]` |
| JWT header | `{ alg: "ES256", kid: "<uuid>", typ: "JWT" }` |

### Why ES256 over HS256

| Factor | HS256 (Symmetric) | ES256 (Asymmetric) |
|--------|-------------------|-------------------|
| Key sharing | Same secret for signing AND verification — must be shared with every PostgREST instance | Private key stays in vault; only public key distributed |
| Supabase native | Not the default since Supabase moved to ES256 | Supabase's default signing algorithm |
| Key rotation | Requires coordinated secret rotation across all services | Public key rotation via JWKS, no secret exposure |
| PostgREST compat | Requires legacy key in "Previously used" status | Native support as standby or current key |
| Security | Shared secret is a single point of compromise | Private key never leaves the vault |

## JWT Claims Structure

The `oauth-token` Edge Function produces this JWT payload, consumed by all Matrix Apps and all RLS policies:

```typescript
{
  sub: string;                     // User UUID (permanent ID across all apps)
  email: string;                   // User email

  // Role & Access
  sso_role: {                      // Active role
    id: string;                    //   Role UUID
    name: string;                  //   "Sales Manager"
  };
  scope: {                         // Access scope
    id: string;                    //   "team"
    name: string;                  //   "Team"
  };
  crud: string;                    // "crud" | "cr" | "r" | etc.

  // Organization & Teams
  uoi: string;                     // Tenant UUID (organization ID)
  organization: {
    id: string;                    // Tenant UUID
    name: string;                  // "Sharp Sotheby's"
  };
  teams: Array<{                   // Team memberships
    id: string;
    name: string;
  }>;
  team_ids: string[];              // Team UUIDs (flat array for RLS)

  // App Access
  allowed_apps: Array<{            // Apps this user can access
    id: string;
    name: string;
  }>;
  available_roles: Array<{         // All roles user can switch to
    uuid: string;
    name: string;
    scope: string;
    is_primary: boolean;
  }>;

  // Flat claims for RLS backward compat
  active_scope: string;            // Flat copy of scope.id for RLS helpers that read ->> 'active_scope'

  // Legacy (backward compat)
  permissions: string[];           // ["app_access", "org_admin"]
  groups: string[];                // Group names
  member_type: string;             // "Broker" | "Staff" | "OfficeManager" | etc.
}
```

## Portal app-tile visibility (`allowed_apps`)

`allowed_apps` is the union of `sso_roles.apps_allowed` across all of a user's assigned roles, resolved live by `oauth-userinfo` (and embedded in the JWT by `oauth-token`). Each entry's `id` is an application's OAuth `client_id`.

**Enforcement point — Agency Portal launcher.** `AppLauncher.tsx` renders a tile only when an app has `show_in_portal=true` **and** its `client_id` is in the signed-in user's `allowed_apps`:

```
visible tiles = (sso_applications WHERE show_in_portal = true) ∩ user.allowed_apps
```

This is a strict intersection with **no admin bypass** — a `system_admin` who lacks an app in `allowed_apps` does not see its tile. Granting/revoking a tile is pure configuration: edit the relevant role's `apps_allowed` (SSO Console → Roles) and the change takes effect on the user's next `oauth-userinfo` fetch (no redeploy).

**Scope of enforcement.** This controls **tile visibility**, not deep-link authorization. `oauth-authorize` still gates the actual app launch on the coarse `rw_*` / `app_access` permissions, so `allowed_apps` is the discoverability/visibility layer rather than a hard per-app launch gate. Apps requiring a hard block must enforce it inside their own `ProtectedRoute` / RLS.

**CORE-exclusive policy.** Eight apps (HRMS, Matrix FM, Management Console, Matrix Stardom, Matrix Comms, Nyx Monitoring, Matrix Analytics 2.0, IT Service & Asset Management / ITSM 2.1) are present only in the `CORE Team` role's `apps_allowed`; three apps (Portal, New Client Registration, Appointment Reports) are backfilled into every role. See [app-catalog.md — App Access Control](app-catalog.md#app-access-control-portal-tile-visibility) for the full `client_id` mapping.

**UAT exception (tenant-isolated).** There is no per-tenant/per-user `apps_allowed` override, so granting a CORE-exclusive app to a UAT tenant is done with **dedicated cloned roles**, never by editing a shared production role. The Acme UAT tenant (`025a9ba8-2b99-42a1-b6aa-cc573cbef1b5`) uses tenant-scoped roles (`sso_roles.tenant_id` = Acme, UUIDs `ac000001..ac000020`):

| Domain | Roles (scope) |
|--------|----------------|
| Admin | Organization Admin (`org_admin`), IT Staff (`org_admin`) |
| Sales | Area Manager (`team`), Senior Broker (`self`), Broker (`self`), Sales Director (`team`), Call Centre / Lead Qualifier (`team`), Listing Coordinator (`team`), Marketing Manager (`team`) |
| Executive / Ops | Managing Director (`global`), Operations Manager (`team`) |
| HR | HR Manager (`team`), HR Officer (`team`) |
| Finance | Finance Manager (`team`), Finance Officer (`team`) — FM page config in FM app (not `sso_role_configurations`) |
| ITSM | IT End User / Requester (`self`), Service Desk Agent (`team`), Service Desk Manager (`global`), Asset Manager (`team`), Change Approver (`team`) |

Per-app page/action access for HRMS, ITSM, Qobrix v1.0, and Qobrix RLS is seeded in `sso_role_configurations` (`20260709150000_acme_cross_domain_roles.sql`). **Financial Management (FM)** reachability is via `apps_allowed`; FM uses its own `role_configurations` store. Console disambiguates same-named global vs tenant roles via the **Organization** column. See `matrix-platform-foundation/supabase/sso/migrations/20260702220000_acme_uat_hrms_roles.sql` through `20260709150000_acme_cross_domain_roles.sql`. This keeps the CORE-exclusive policy intact for production Sharp SIR.

## RLS Helper Functions

All functions are `STABLE` with `SET search_path = public` for security and performance. Wrap calls in `(SELECT func())` in RLS policies for initPlan caching.

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_current_tenant_id()` | `uuid` | Tenant UUID from JWT `uoi` claim — used in every RLS policy for tenant isolation |
| `get_active_scope()` | `text` | Scope string from JWT — defaults to `'self'` if missing. |
| `get_crud()` | `text` | CRUD permission string (e.g., `"crud"`, `"cr"`, `"r"`) from JWT. |
| `get_current_user_id()` | `uuid` | SSO User UUID from JWT `sub` claim |
| `get_current_team_ids()` | `uuid[]` | Array of team UUIDs from JWT. |
| `is_sso_admin_v2()` / `is_admin_scope()` | `boolean` | `true` if scope is `org_admin` or `system_admin` |
| `update_updated_at_column()` | trigger | Auto-sets `updated_at = now()` on UPDATE |

### CDL is JWT-only (no `app_metadata` fallback) — ADR-012

> **Updated Apr 2026 (ADR-012):** The Matrix CDL is a **separate
> Supabase project** (`ofzcokolkeejgqfjaszq`) configured with
> **Supabase Third-Party Auth** against the SSO JWKS URL + issuer. CDL
> PostgREST verifies SSO-issued ES256 tokens natively. All CDL RLS
> helpers read claims exclusively from `auth.jwt()` — no
> `auth.users.raw_app_meta_data` fallback, no
> `current_setting('request.jwt.*')` GUC dependency. Keeping the
> helpers JWT-only is what makes the shared CDL schema portable to
> Databricks Lakebase.
>
> Historically (before Apr 2026) the CDL lived inside the SSO project
> and CDL RLS helpers had an `app_metadata` fallback to support the
> "Supabase native token" path. That code is gone on the new CDL
> project. Per-app DBs may still read `app_metadata` if they choose,
> but this is not required and not the recommended pattern.
>
> **SSO-project helpers (`sso_get_active_scope`, `sso_get_crud`,
> `sso_get_current_team_ids`) — JWT-first, `app_metadata` fallback (2026).**
> Unlike the CDL helpers, the SSO project's own helpers retain a
> `raw_app_meta_data` fallback, but they read `request.jwt.claims` **first**
> (`scope.id` / `scope` / `crud` / `team_ids`) and only consult `app_metadata`
> when the claim is absent. Because every token minted by `oauth-token`,
> `switch-role`, and `switch-tenant` now carries those claims, the fallback is
> belt-and-suspenders for legacy/opaque tokens only. Consequently `oauth-token`
> persists `active_scope` / `active_crud` / `active_team_ids` to `app_metadata`
> **asynchronously** (`EdgeRuntime.waitUntil`) off the token-mint critical path —
> a deferred write cannot affect RLS for the freshly-minted token, since the
> helpers resolve those values from the JWT it already carries.

### SQL Implementations

```sql
-- get_current_tenant_id() — reads JWT "uoi" claim
SELECT NULLIF(auth.jwt() ->> 'uoi', '')::uuid;

-- get_active_scope() — JWT-only, defaults to 'self'
SELECT coalesce(
  nullif(auth.jwt() -> 'scope' ->> 'id', ''),
  nullif(auth.jwt() ->> 'scope', ''),
  'self'
);

-- get_crud() — JWT-only, defaults to ''
SELECT coalesce(nullif(auth.jwt() ->> 'crud', ''), '');

-- get_current_user_id() — JWT "sub" claim
SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;

-- get_current_team_ids() — JWT "team_ids" array, defaults to {}
SELECT coalesce(
  ARRAY(SELECT (value)::uuid FROM jsonb_array_elements_text(
    coalesce(auth.jwt() -> 'team_ids', '[]'::jsonb)
  )),
  '{}'::uuid[]
);

-- is_sso_admin_v2() — SECURITY DEFINER
SELECT COALESCE(
  (SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->'scope'->>'id',
    current_setting('request.jwt.claims', true)::json->>'scope'
  ) IN ('system_admin', 'org_admin')),
  false
);

-- is_in_my_teams(target_user_id) — CDL only, SECURITY DEFINER
SELECT EXISTS (
  SELECT 1 FROM sso_user_group_memberships m
  WHERE m.user_id = target_user_id
    AND m.group_id = ANY(get_current_team_ids())
);
```

> **App DB instances** use the simpler JWT-only versions (no `app_metadata` fallback) because they receive the SSO JWT directly via `accessToken` hook.

### Team-Scope Resolution

The `team` scope requires checking whether a record's owner is in the same team as the current user. Two resolver functions exist for different contexts:

| Function | Location | Resolution Method | Used By |
|----------|----------|------------------|---------|
| `is_my_direct_report_v2(target_id)` | App DB | Checks manager-subordinate hierarchy via app's manager table | HRMS (employees) |
| `is_in_my_teams(user_id)` | CDL | Checks shared team membership via `sso_user_group_memberships` | MLS (listings, contacts) |

Apps deploying tables to CDL should use `is_in_my_teams()`. Apps with their own DB should create an app-specific `get_my_record_id_v2()` and `is_my_direct_report_v2()` following the template in `001_sso_helper_functions.sql`.

### ITSM-specific ticket scope (matrix-itsm)

ITSM **diverges** from generic Pattern B for `service_desk_tickets`:

| Scope | Ticket visibility | Cross-tenant |
|-------|-----------------|--------------|
| `self` | Own tickets only (`created_by` or `assigned_to` = JWT `sub`) | Active tenant only |
| `team` | Own/assigned **or** `requester_team_id` ∈ JWT `team_ids` | Active tenant only |
| `global` / `org_admin` | All tickets in active tenant | Active tenant only |
| `system_admin` | All tickets in **active tenant only** (`uoi`) | **No** cross-tenant read at RLS — use Switch Organization to change `uoi` |

- **`requester_team_id`** is stamped on ticket create from the requester's primary SSO team (`UnifiedTicketForm`).
- **`Broker`** role uses `scope=self`, `crud=cru` — requesters can create/read/update own tickets without global scope.
- UI queries use `scopeRead(query, tenantId)` as defense-in-depth alongside RLS.

Migration: `matrix-itsm/supabase/migrations/20260619130000_p2_ticket_team_tenancy.sql`

### Qobrix Sales Automation — `global` write-all (app-specific exception)

Canonical Pattern B treats `global` as tenant-wide **read** (writes of others'
rows reserved for `org_admin` / `system_admin`; see golden-principles S1 and
`003_data_model_template.sql`). **Qobrix Sales Automation**
(`matrix-qobrix-sales-automation-rls` / `matrix-sales-automation`,
app DB `ycbwgnihbrqammkgngum` / `rpoeezssicpzexarmwqq`)
**intentionally diverges**: UPDATE/DELETE on owned CRM tables include
`'global'`, so a sales director can mutate any tenant CRM row for oversight.

- **Justification:** sales-director oversight of broker pipeline/contacts/offers.
- **App doc:** `matrix-sales-automation/docs/supabase/app-owned-data.md` (repo `gca-ltd/matrix-sales-automation`)
  (three-toggle source-gating contract + Pattern B divergence).
- **Campaigns** use Pattern C tenant-shared SELECT; **notifications** INSERT
  binds `tenant_id` to JWT `uoi` —
  migration `20260709120000_campaigns_shared_read_and_notifications_tenant_check.sql`.
- **Related:** HRMS also documents app-specific `global` full-CRUD on many
  tables in `docs/data-models/hrms-data-access-matrix.md` — same class of
  exception (app matrix overrides platform default).

### Qobrix / App-DB source gating (v1.0 three toggles)

`matrix-sales-automation` (was `matrix-qobrix-sales-automation-v1-0`) exposes three independent client toggles
(Qobrix avatar menu + Setup). Contract:

| Toggle | OFF | ON |
|---|---|---|
| Write Qobrix | No write reaches Qobrix; **App-DB writes always allowed** (RLS) | Qobrix-sourced rows editable; writes route back to Qobrix |
| Read Qobrix | Non-listing readers App-DB only / empty | Merge Qobrix for everything except properties/projects |
| Read Qobrix Listings | Properties/projects App-DB only | Merge Qobrix listings (independent of Read Qobrix) |

Auth/session and explicit backfill/sync are exempt from the read gates. UI
edit-ability keys off `row_source` via `useCanEdit` / `isEditable(row, writeMode)`.
Canonical detail: `matrix-sales-automation/docs/supabase/app-owned-data.md`.


The CDL instance also has legacy helper functions used by older apps (`matrix-client-connect`, `matrix-meeting-hub`). These are kept for backward compatibility and should NOT be used by new apps:

| Legacy Function | New Equivalent |
|----------------|---------------|
| `get_my_tenant_id()` | `get_current_tenant_id()` (note: `get_my_tenant_id()` has a 4-step fallback and is still used by MLS for compatibility) |
| `is_admin()` / `has_rw_global_permission()` | `(SELECT get_active_scope()) IN ('org_admin', 'system_admin')` for admin ops; `get_crud() LIKE '%u%'` for write checks |
| `can_access_all_tenant_data()` | `get_active_scope() IN ('global', 'org_admin', 'system_admin')` |
| `is_manager_or_above()` | `get_active_scope() IN ('team', 'global', 'org_admin', 'system_admin')` |

## RLS Policy Patterns

From `matrix-apps-template-2-1/supabase/migrations/003_data_model_template.sql` (canonical starter kit; the old `matrix-apps-template` is obsolete):

| Pattern | Use Case | Logic Summary |
|---------|----------|---------------|
| **A** | Reference tables (lookups, types) | Tenant isolation + CRUD check; admin-only write |
| **B** | User-owned records (listings, contacts, deals) | Self: own records; Team: own + direct reports; Global+: all in tenant |
| **C** | Tenant-wide records (shared config, announcements) | All records in tenant for anyone with read access |
| **D** | Admin-only tables (audit, configuration) | Full CRUD restricted to `org_admin` / `system_admin` |
| **E** | System tables (cross-tenant) | Cross-tenant access for `system_admin` only |

### Pattern B (most common) — scope-aware SELECT

This is the workhorse pattern used for any table where record ownership matters:

```sql
CASE (SELECT get_active_scope())
  WHEN 'system_admin' THEN true
  WHEN 'org_admin'    THEN tenant_id = (SELECT get_current_tenant_id())
  WHEN 'global'       THEN tenant_id = (SELECT get_current_tenant_id())
  WHEN 'team'         THEN tenant_id = (SELECT get_current_tenant_id())
                       AND (owner_id = (SELECT get_my_record_id_v2())
                            OR (SELECT is_my_direct_report_v2(owner_id)))
  WHEN 'self'         THEN tenant_id = (SELECT get_current_tenant_id())
                       AND owner_id = (SELECT get_my_record_id_v2())
  ELSE false
END
```

## `role_configurations` Table

Each app has this table in its App DB instance. It maps SSO roles to app-specific page and action access.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Auto-generated |
| `role_id` | text | SSO role UUID from `sso_roles.id` |
| `pages` | text[] | Array of page keys (e.g., `['home', 'listings', 'contacts']`) |
| `actions` | text[] | Array of action keys (e.g., `['create', 'edit', 'delete']`) |
| `tenant_id` | uuid | Multi-tenant support |

**Wildcard**: `pages: ['*']` or `actions: ['*']` grants full access.

**Auto-bootstrap**: If the table is empty and the user has admin scope, the app auto-inserts the current role with `['*']` for both pages and actions. Once any config exists, strict mode applies.

## Platform-Standard Page Keys

Apps use `role_configurations.pages` to control which pages each role can access. Apps may add domain-specific keys.

| Category | Keys |
|----------|------|
| **Account** (all apps) | `home`, `profile`, `settings`, `design-showcase` |
| **Real Estate** (CDL-Connected) | `listings`, `listing-detail`, `listing-create`, `listing-edit`, `properties`, `showings`, `open-houses` |
| **CRM** (CDL-Connected) | `contacts`, `contact-detail`, `leads`, `opportunities`, `pipeline`, `deals` |
| **Marketing** | `campaigns`, `analytics`, `reports`, `marketing-dashboard` |
| **Operations** | `team-dashboard`, `team-management`, `calendar`, `tasks` |
| **Admin** | `users`, `roles`, `permissions`, `tenants`, `applications`, `audit-log` |
| **HR** (HRMS) | `directory`, `org-structure`, `personnel`, `onboarding`, `offboarding`, `vacations`, `vacations-admin`, `performance`, `my-performance`, `compensation`, `documents`, `my-documents`, `changes`, `social`, `hr-dashboard` |
| **Finance** | `invoices`, `commissions`, `payments`, `finance-dashboard`, `finance-reports` |

## Platform-Standard Action Keys

| Action Key | Description |
|------------|-------------|
| `create` | Create new records |
| `edit` | Edit existing records |
| `delete` | Delete records |
| `export` | Export data (CSV, PDF) |
| `import` | Bulk data import |
| `approve` | Approve requests/workflows |
| `reject` | Reject requests/workflows |
| `assign` | Assign records to users/teams |
| `archive` | Archive records (soft delete) |

## App-Side Hooks

| Hook | Returns | Usage |
|------|---------|-------|
| `useAuth()` | user, roles, tenant, scope, crud, teams, isLoading | Global auth state |
| `useActiveRole()` | canCreate, canRead, canUpdate, canDelete, scope | Per-action permission checks |
| `useRoleConfig()` | canAccessPage(pageKey), canPerformAction(actionKey), permissionsLoading, permissionsError, retryPermissions | Page/route/action guards — **three-state** (loading / load-failed / denied); see [ADR-045](../architecture/decisions/ADR-045.md) |

### Permission-load contract (ADR-045)

Permission rows are **not** in the JWT. A failed or still-pending
`sso_role_configurations` read must never be treated as a real denial (or, for
legacy `app_permissions` apps, as a silent grant):

1. **Loading** → spinner only while the query is pending **and** there is no cached config.
2. **Load failed** → "Couldn't verify your permissions" with Retry / Sign in again when the query errored **with no cache** and the page is not already granted (admin fallback or cached `pages`); report to SSO `log-permission-failure`. A background refetch failure that leaves cached data in hand must not raise this screen.
3. **Denied** → only after a successful load with the page key absent from `pages`.

A signed-in session with no `tenantId` (apps that gate the query on tenant) is
load-failed, not loading. Query functions throw on missing access token or
PostgREST error (never `return null` / `return true`). Telemetry table:
`sso_permission_load_failures`.

## Role-to-Page Mapping Example (HRMS)

| Role | Scope | Pages | Actions |
|------|-------|-------|---------|
| System Admin | system_admin | `['*']` | `['*']` |
| Organization Admin | org_admin | `['*']` | `['*']` |
| HR Director | global | home, directory, profile, org-structure, onboarding, offboarding, vacations, vacations-admin, performance, compensation, documents, reports, settings | create, edit, delete, export |
| HR Manager | team | home, directory, profile, org-structure, onboarding, offboarding, vacations, vacations-admin, reports | create, edit, delete |
| Sales Director | global | home, directory, profile, org-structure, reports, settings | create, edit, delete, export |
| Broker | self | home, directory, profile | (none) |

## Role-to-Page Mapping Example (Qobrix Sales Automation)

App DB project: `ycbwgnihbrqammkgngum`. Config store: SSO `sso_role_configurations` with `app_id = yeBljGGVpyC96RljEDov8n-td2I52cgX`.

| Role | Scope | Pages | Actions |
|------|-------|-------|---------|
| Organization Admin | org_admin | `['*']` (admin fallback) | `['*']` |
| Managing Director / Sales Director | global/team | `['*']` | `['*']` |
| Area Manager | team | home, management, profile | create, edit, delete, export |
| Operations Manager | team | home, management, profile, properties | export |
| Listing Coordinator / Marketing Manager | team | home, profile, properties | create, edit, export |
| Call Centre / Lead Qualifier | team | home, profile | create, edit |
| Broker / Senior Broker | self | home, profile | create, edit |

**Section-level page keys (2026-07-09).** The sidebar is split into sections so
managers and individual contributors can be gated separately:

| Page key | Sidebar section / items |
|----------|-------------------------|
| `home` | **Agent Workspace** — My Day, Calendar, Pipeline, Follow-ups, Offers, Contacts, Properties, Projects |
| `management` | **Management View** — Dashboard, Agents, Reports |
| `trash` | Trash / Restore |
| `properties` | MLS Properties (CDL catalog) |
| `ad-employees` | Employees |
| `design-showcase`, `settings`, `profile` | template / admin / account |

Both Qobrix apps share this taxonomy (RLS `yeBljGGVpyC96RljEDov8n-td2I52cgX`,
v1.0 `Dk4cIY3~VvwYYgFIU.2gCdAfewWb34AZ`). Only team-managing roles receive
`management`; ICs keep Agent Workspace only. Listings catalog visibility is L2
(RLS), not L1 — see [ADR-036](../architecture/decisions/ADR-036.md).
Migration: `20260709170000_qobrix_section_page_keys.sql`.

**Sharp SIR production (v1.0 / MSA staging).** Acme UAT keeps the stricter Area Manager
page list above. Sharp SIR sales roles match Broker on MSA
(`Dk4cIY3~VvwYYgFIU.2gCdAfewWb34AZ`): `pages = ['*']`, `actions = ['*']`, and
the client id in `apps_allowed` for Broker, Senior Broker, Area Manager,
Team Leader, Sales Manager, Sales Director, and CORE Team; Call Centre has
`apps_allowed` plus a narrower page set (leads/approvals/analytics). Portal
tile is enabled (`show_in_portal`, `app_url` → `/msa-staging-main/`) via
`20260824110000_msa_staging_main_portal_and_sales_access.sql` (Area Manager
wildcard originally from `20260803120000_sir_area_manager_qobrix_v10_wildcard.sql`).
Team-scope roles without a config row get `NO_ACCESS` in `useRoleConfig` — the
wildcard grant is required for those roles to pass `ProtectedRoute`.

**Team membership is required for management visibility (MSA / Qobrix).** Granting
a role + `apps_allowed` is not enough. JWT `team_ids` is built from
`sso_user_group_memberships` by `oauth-token` / `oauth-userinfo`. New MSA rows are
stamped `owner_team_id = get_primary_team_id()` (= `team_ids[1]`). Team-scoped RLS
(`can_read_scoped_row`) matches `owner_team_id = ANY(team_ids)`. A user with **no**
group membership stamps `owner_team_id = NULL`, and Team Leaders / Area Managers /
Sales Managers never see those rows — with no error.

**One group per broker; managers may cover one or many offices.** `resolveTeams`
returns memberships unordered, so a Broker in two groups gets a nondeterministic
primary team across sessions. Brokers / Senior Brokers must belong to **exactly
one** SSO group. Managers (team scope) may belong to many when they truly oversee
multiple offices (`= ANY(team_ids)`).

**Cyprus Sotheby's offices (ground-truth roster, 32 people).** Three offices, each
with one regional Area Manager lead. SSO groups (migration
`20260824130000_cy_roster_office_group_align.sql`):

| Office | Headcount | Lead (Area Manager) | SSO group |
|--------|----------:|---------------------|-----------|
| Paphos (Pafos) | 14 | Iness Karayianni | `CSIR Sales Paphos` (`cb453422-…`) |
| Limassol | 11 | Olga Khokhlova (AD: Olga McKibben) | `CSIR Sales Limassol` (`5b3996a5-…`) |
| Larnaca | 7 | Liza Kazares (AD: Liza Kazarez; CRM: Liza Kucere) | `CSIR Sales Larnaca` (`f85fb092-…`) |

Each roster member is in **exactly one** of those three groups (not the coarse
`CSIR Sales` bucket). Each lead's `team_ids` is only their own office, so
team-scoped RLS keeps Paphos / Limassol / Larnaca pipelines separate. Olga was
granted Area Manager (primary) + Broker to match Iness / Liza.

Two Paphos roster members are still AD-only (no `auth.users` yet) and must be
assigned to `CSIR Sales Paphos` after first SSO login: Alexand Siomin
(`siomin@` / `asiomin2@`) and Lilia Chrysostomou (`lchrysostomou@`) — see
`~/tmp/cy_roster_missing_auth_20260824.md`.

The coarse **CSIR Sales** group (`4d2bdfe9-…`) remains for non-roster Cyprus
accounts (shared mailboxes, back-office, etc.). Do **not** infer CY office
coverage from the Sharp SIR `Sales Manager` role alone — e.g. Elena Nedvetskaya
(`enedvetskaya@…`) is AD **Chief People Officer** / HR and belongs only in
`CORE HR` (fix: `20260824131000_remove_cpo_csir_sales_groups.sql`). HSIR /
RUSIR office groups are unchanged
(`20260824123000_msa_staging_team_membership_backfill.sql`).

Area Manager stays at scope `team` (not `global`), so Hungary/Kazakhstan leads stay
out of a CY manager's view unless that manager is also in the matching HSIR/Kaz
group. Dual-role users (Broker + Area Manager) switch via the avatar RoleSwitcher;
`oauth-token` honours `user_metadata.active_role_id` on both code exchange and
refresh so the chosen role survives re-login. With a single office group, the
`owner_team_id` stamp is stable when they act as Broker.

## Role-to-Page Mapping Example (ITSM)

App DB project: `irjrcskfcyierdbefrpk`. Config store: SSO `sso_role_configurations` with `app_id = itsm` (same shared model as HRMS / Qobrix; migrated from app-local `app_permissions` on 2026-07-09).

| Role archetype | Scope | Pages |
|----------------|-------|-------|
| Requester (Broker, Senior Broker) | self | dashboard, sd-catalog, kb, myrequests, sd-my-assets |
| Agent (Area Manager) | team | above + sd-my-queue, sd-team-queue, sd-approvals, sd-analytics |
| Organization Admin | org_admin | `['*']` (admin fallback) |

Ticket visibility is L2: self sees own tickets; team sees own/assigned + `requester_team_id ∈ team_ids`. See [tenant-role-configuration.md](tenant-role-configuration.md).

## How-To Guides

### Add a New Role

1. Insert into `sso_roles` via SSO Console or `admin-roles` Edge Function
2. Assign to users via `user_role_assignments`
3. Configure page/action access in each app's `role_configurations` table

### Add a New Page Key

1. Add the page key to the app's `RoleConfigPanel.tsx` → `PAGE_GROUPS` array
2. Add matching `pageKey` to sidebar items in `AppSidebar.tsx`
3. Add `requiredPage` to the route's `ProtectedRoute` wrapper
4. Configure which roles see this page in `role_configurations`

### Add a New Action Key

1. Add the action key to the app's `RoleConfigPanel.tsx` → `ALL_ACTIONS` array
2. Use `canPerformAction('action-key')` in component logic
3. Configure which roles can perform this action in `role_configurations`

## Delegated minting for chat agents (ADR-032)

SSO is the **sole identity authority** — apps never store user credentials
(passwords, refresh tokens). For the ITSM MCP chat-identity binding, the
chat agent acts for a chat user **without holding any token**: the MCP calls
the SSO `mint-delegated-token` EF (service credential only) to mint a
**short-lived ES256 JWT per request** against a **revocable delegation grant**
(`sso_delegation_grants`), and runs tools through a per-user RLS-bound PostgREST
client (Third-Party Auth). No user credential is duplicated into the app; access
ends on grant revoke or 90-day inactivity. Agents authenticate with **OAuth 2.1
authorization-code + PKCE** (HubSpot-style): each agent is its own client with its
own `client_id` + `client_secret` + redirect URL(s); the operator
authorizes once in a browser via SSO, and the connector exchanges the code (PKCE +
client secret) at `mcp-oauth/token` for a 1h MCP access token + 30d refresh token.
The secret is kept as a **SHA-256 hash** (token-endpoint verification) **and**
AES-256-GCM-**encrypted at rest** (`client_secret_enc`) so an admin can **re-Show**
it from Settings → MCP → Agents → Manage; the encryption key (`MCP_SECRET_ENC_KEY`)
lives only in the `mcp-admin` EF env, and every reveal is **admin-only and audited**.
The signing key (`app_settings.mcp.jwt_secret`) is **server-only** — it signs
issued access tokens and is never a bearer, so a leaked signing key cannot be
replayed as an agent credential, and a leaked agent secret is rotated or the agent
permanently **deleted** **per-agent** (blast radius unchanged). Least privilege is
enforced by **tool tiering**: *public* tools (`whoami`, `tool_guidance`, `search_kb`, `get_article`,
`create_ticket`) need only the agent access token and run leak-safe (KB published-only,
write-only ticket creation), while *private* tools require a verified **1:1**
identity and a linked SSO account — Telegram/WhatsApp/Teams via platform id +
linkage; **web** via `X-Chat-User-Bearer` (SSO access token verified on every
request). Group chats and unidentified users are public-only and get a
`private_requires_dm` nudge (`no_verified_session` for web). **Step-up consent** still gates
ticket close/resolve via `update_ticket`. Binding assurance is per-platform:
Teams auto-binds (`aadObjectId` = `azure_oid`, high), Telegram/WhatsApp require a
one-time interactive login (interactive), web auto-binds via SSO bearer (interactive). See
[ADR-032](../architecture/decisions/ADR-032.md).

## OAuth 2.1 + PKCE posture

All Matrix Apps are **public OAuth clients** and authenticate with OAuth 2.1 +
PKCE (`code_challenge` S256). The `code_verifier` is the client-side defense
against authorization-code interception.

**Server-managed PKCE (opt-in per app — [ADR-019](../architecture/decisions/ADR-019.md)).**
Apps flagged `sso_applications.server_managed_pkce = true` exchange the
authorization code **without** a client `code_verifier`. This is required for
first-party apps that must log in inside **storage-stripping embedded browsers**
(e.g. the Cursor in-IDE webview), which drop `sessionStorage` *and* `localStorage`
across the cross-origin OAuth redirect and therefore cannot carry a verifier.

For opted-in apps the client-side PKCE code-interception protection is replaced by
the server-side protections that remain on `oauth-token`: **single-use** codes,
**short TTL** (10 min), strict **`redirect_uri` allowlist** match, **`client_id`
binding** (enforced in `oauth-token` as of 2026-06-01 — previously documented here
but not implemented; a spec/impl drift now closed), and a valid authenticated
**SSO session**.

The client-side CSRF `state` check, however, is **not** replaced by an equivalent
server-side `state` check: a sound `state` defense needs a client-held secret that
the storage-stripping webview cannot keep, so a server-side comparison of the
URL-supplied `state` would be a placebo. The loss is therefore an **accepted
residual risk for first-party public clients**, bounded by the bindings above plus
the authorize-step app-access gate (the attacker must be an *authorized* SSO user)
and an all-authenticated-employee population. The durable fix is the
[ADR-017](../architecture/decisions/ADR-017.md) BFF / HttpOnly-cookie direction.
This is the confidential-client/BFF posture for first-party clients only; the flag
defaults `false` and MUST stay `false` for any third-party / lower-trust client,
which keeps full client-side PKCE.

The app-side single-use guard in `AuthCallback.tsx` is **belt-and-suspenders**: the
SSO server's single-use enforcement is authoritative, and the client marks a code
"used" only **after a terminal outcome** (success or terminal failure), never before
the exchange. Burning pre-flight previously poisoned benign React remounts with a
false "this sign-in link has already been used" error.

**Bounded authorization-code replay window (2026-06-01 — [ADR-019](../architecture/decisions/ADR-019.md)).**
Strict single-use still broke fresh login in browsers that *reload* the callback and
**cancel** the winning exchange before its response is read (the Lovable preview's
`callback_lovable_sha` reload storm; React StrictMode / prefetch double-submits) —
the code is spent server-side but the tokens die with the torn-down fetch. `oauth-token`
now grants a **bounded same-client replay window** (`REPLAY_WINDOW_MS = 60_000`): on
first consumption it records `consumed_at` and caches the issued access + refresh token
on the code row, and a re-presentation of the **same** code by the **same** `client_id`
+ `redirect_uri` within the window **re-delivers the identical tokens** (no new session,
no refresh-token rotation, no new credential). All bindings above are still enforced on
the replay path; outside the window the code is fully spent and the cached tokens are
nulled (`sso_clear_expired_authcode_tokens()`). This is a bounded (≤60 s),
security-reviewed relaxation of strict single-use, risk-equivalent to the code's own
in-transit value extended by the window. Consumption is also now recorded **after** a
successful mint, so a transient signing/storage error no longer burns the code.

**Identity claims in the access token / PII-at-rest (2026).** To eliminate the
post-login `oauth-userinfo` round-trip, the `oauth-token` JWT now embeds identity
claims (`email`, `email_verified`, `name`, `picture`) alongside the role/scope
claims it already carried. Since apps persist the access token in `localStorage`,
this marginally increases PII-at-rest. **No new control is weakened**: the same
token already exposed role, tenant, team, and permission claims, and the exposure is
bounded by the *same* XSS threat already accepted under
[ADR-017](../architecture/decisions/ADR-017.md). The durable mitigation is the
same BFF / HttpOnly-cookie direction below.

**BFF intentionally deferred.** This change set (JWT enrichment + login-path
simplification) deliberately does **not** adopt the BFF / HttpOnly-cookie posture of
[ADR-017](../architecture/decisions/ADR-017.md). BFF is the only step that would
*raise* the security posture (removing tokens from `localStorage` entirely) and it
remains the tracked future security-upgrade initiative — it is out of scope here,
which keeps this change "same security level, faster + simpler."

## Anti-pattern: a service-harvested cache on a user read path

**Rule.** A table populated under a service account or a shared upstream login
carries the **harvester's** visibility, not the caller's. It may only be served to
viewers whose scope already entitles them to everything (`global`, `org_admin`,
`system_admin`). Restricted viewers (`self`, `team`) must read the authoritative
source **as themselves**.

This applies to any read path where the upstream system owns the ACL — a mirror of
a third-party CRM, a denormalised cache, a materialised view, or a pre-joined
"fast path" table. `service_role`-only + RLS-enabled-with-no-policies protects the
table from the *anon/authenticated* client, but says nothing about an Edge Function
that reads it with the service key and returns the rows to whoever called.

**How it ships undetected.** Where the permission guarantee is carried by the
*transport* — a per-user token on a live upstream call — replacing the transport
with a shared cache removes the guarantee while **deleting no permission code**.
The diff reads as a pure performance change and review passes.

MSA, 2026-08-28 → 2026-08-31: the Leads list was repointed from a live per-user
Qobrix read to `qobrix_opportunity_mirror` (harvested every 5 min by one shared
Qobrix account). Any Broker (`self` scope) could then read **45,901 opportunities
across 66 owners, 45,778 of them carrying a client phone or email**. It also
silently reverted an earlier deliberate fix that had removed an MSA-side
`owner==CURRENT_USER` filter, because that filter *under*-shows rows to users with
legitimate team or delegated access — the upstream ACL is richer than any flag MSA
can reconstruct.

**MSA status (2026-09-01).** [ADR-050](../architecture/decisions/ADR-050.md)
retires that service-harvested cache entirely: CRM screens read App DB under
MSA RLS; every Qobrix fetch uses the caller's own token; mirrors and
`QOBRIX_SHARE_*` leave the read path. The historical incident and the
controls below remain the platform template for **any other** service-harvested
cache — MSA itself must not reintroduce one.

**Required controls** (all three — docs alone did not hold) when a privileged
cache still exists:

1. **Type-level.** Make the viewer scope a **required** parameter of the cache
   query helper, and throw for restricted callers. Omitting it must be a compile
   error, not a review comment.
2. **Guardrail in CI.** Static check that every call site passes it
   (historical MSA: `scripts/check_mirror_viewer_scope.mjs`).
3. **Fail-safe + signal.** Strip PII from rows the viewer does not own on
   restricted paths, and **count** the maskings. A non-zero counter means the
   upstream is not filtering per user and only the fail-safe is holding —
   escalate rather than silence it.

Also report which path served the response (`source: 'upstream' | 'mirror'`) so
the guarantee is observable in UAT rather than inferred.

Contract for MSA after cutover: [ADR-050](../architecture/decisions/ADR-050.md).
Historical D3c/D3d wording lives under
[ADR-044](../architecture/decisions/ADR-044.md). Performance framing:
[`performance.md`](performance.md) § "Safety properties carried by transport".

## Anti-pattern: unique key vs per-agent visibility

A tenant-global unique key on an upstream id (`(tenant_id, external_qobrix_id)`)
combined with **owner-scoped** SELECT RLS creates a silent trap: agent B
legitimately authorised upstream cannot INSERT a second copy of a contact or
deal that agent A already holds, and the `23505` error itself leaks that
another agent owns the row — while B still cannot SELECT it.

**Required shape.** One shared row per upstream id; a second authorised agent's
write raises a **claim** (`mirror_claim_state = 'pending'`, …) via a
`SECURITY DEFINER` admission RPC so B gains read immediately, and an admin
adjudicates *ownership*. Do not invent per-agent duplicate rows or drop the
unique key.

## Anti-pattern: `created_by` as an accidental permanent grant

INSERT policies that force `created_by = get_current_user_id()` look like
provenance hygiene. On a **caller-harvested** cache they are a privilege
escalation: whoever first refreshes a colleague's row keeps durable MSA read
via the creator branch of `can_read_scoped_row`, even after their upstream
visibility narrows. Same leak class as a service-harvested mirror, with a
person as harvester (especially call-centre / team-lead roles with broad
upstream visibility and restricted MSA scope).

**Required shape.** Cache/admission writes set `created_by` to the **resolved
owner** (via the identity map), never the refresher. Prefer a single
`SECURITY DEFINER` write path; block direct client INSERTs on those tables.
See [ADR-050](../architecture/decisions/ADR-050.md) D4.

## Security Hardening Backlog

> Tracked findings from Supabase security linter and platform audit (April 2026).
> Items are ordered by priority. Resolve before promoting ES256 to "current" key.

### Immediate (Security)

| # | Finding | Severity | Detail | Remediation |
|---|---------|----------|--------|-------------|
| S1 | **CDL multi-tenancy on `public.properties` / `properties_published` / `property_media`** | HIGH | The canonical listing tables are not tenant-scoped today (single CDL-wide dataset keyed by `source_id`). Multi-tenant scoping for distinct tenants pulling distinct MLS feeds is an open item. | Decide between (a) adding `tenant_id` to `properties`/`property_media` and tenant-scoped RLS, or (b) keeping `source_id` as the tenancy key and enforcing per-tenant `source_id` allow-lists at the EF layer. Resolve before more than one tenant ingests via `mls-sync`. (The MLS Sync control plane — `mls_settings`, `mls_sync_jobs`, `mls_sync_state`, `mls_orchestrator_runs` — is already per-tenant.) |
| ~~S2~~ | ~~**4 SECURITY DEFINER views on SSO tables**~~ | RESOLVED (2026-08-25) | Compatibility views (`tenants`, `user_role_assignments`, `role_configurations`, `app_permissions`) ran as owner and skipped caller RLS. | `20260825153000_s2_views_security_invoker.sql`: `ALTER VIEW … SET (security_invoker = true)`. Advisors ERROR `security_definer_view` cleared (SSO 0 ERROR). Login/OAuth EFs remain `service_role`. |
| S3 | **`app_settings` allows anonymous INSERT/UPDATE** | RESOLVED (2026-08-19) | Wave 2C (`20260819163000_sso_wave2c_anon_revoke_business.sql`): `REVOKE ALL … FROM anon` on all SSO public tables; `app_settings` policies now `TO authenticated` only. Browser apps already executed as `authz_role=authenticated`. |
| S4 | **Leaked password protection disabled** | MEDIUM | Supabase Auth's HaveIBeenPwned integration is off. Confirmed still off (`password_hibp_enabled=false`) on SSO and CY website Auth in weekly audits 2026-08-25 and **2026-09-01**. | Enable in Dashboard → Auth → Security → "Leaked password protection". |
| ~~S5~~ | ~~**`sso_scope_levels` RLS disabled**~~ | RESOLVED (2026-08-19) | Migration `20260819151000_sso_enable_rls_category_b.sql`: RLS enabled + `sso_scope_levels_authed_read` (authenticated SELECT). EFs continue via `service_role`. |
| S6 | **TRUNCATE on MSA Hungary (HRMS portion closed)** | HIGH | **HRMS RESOLVED 2026-09-01** (`matrix-hrms` `20260901123000_wave2f_anon_dml.sql` — truncate + anon DML = 0). MSA Hungary still **64/64** TRUNCATE — deferred while app is in active testing. Other projects: see **S10**. | Apply Wave 2F on MSA Hungary after test freeze; remaining S10 projects separately. See [security-audits/2026-09-01.md](security-audits/2026-09-01.md). |
| ~~S7~~ | ~~**Comms: RLS disabled on operational tables**~~ | RESOLVED (2026-08-25) | Migration `matrix-comms/supabase/migrations/20260825140000_s7_rls_ops_tables.sql`: RLS + service_role-only policies + `REVOKE` from anon/authenticated on `gdpr_requests`, `audit_log`, `campaign_jobs`, `api_rate_counters`. Advisors no longer ERROR `rls_disabled_in_public` on those four (remaining Comms ERROR is `conversations_enriched` SECURITY DEFINER view — deferred). |
| S8 | **CY Web Site: anon EXECUTE on admin SECURITY DEFINER RPCs** | HIGH | Anon can call `update_user_role`, `remove_user_role`, `update_user_permission`, `handle_new_user_admin`, etc. via `/rest/v1/rpc/…`. Still **16 anon SECDEF EXECUTE** in audit **2026-09-01**. | `REVOKE EXECUTE … FROM PUBLIC, anon` (and tighten `authenticated` where needed); leave only intentional public RPCs. Proposed migration in audit `proposed/s8_cy_website_revoke_admin_rpc.sql`. |
| ~~S9~~ | ~~**CDL anon DML grants remain on ~30 tables**~~ | RESOLVED (2026-08-25) | Migration `matrix-platform-foundation/supabase/cdl/migrations/20260825142000_s9_anon_revoke_dml.sql`: `REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon` (SELECT kept for catalog reads). Holds in **2026-09-01** audit (0 anon DML). |
| S10 | **Wave 2F TRUNCATE drift (remaining projects)** | HIGH | Audit **2026-09-01**: FM (11), Comms (17), Analytics+Stardom (50), Vacations Mgmt (17), matrix-lead-generator (7), Pipeline v1 (50), HRMS Sandbox (42). **HU Storefront + Career Connect TRUNCATE fixed 2026-09-01**. | Per-project Wave 2F. Template: audit `proposed/s10_wave2f_template.sql`. |
| S11 | **MSA CY: SECURITY DEFINER view `opportunity_field_mismatches`** | MEDIUM | Advisors ERROR (new vs 2026-08-25). Deferred — active testing. | `ALTER VIEW … SET (security_invoker = true)` after test freeze. |
| S12 | **Pipeline 2.0: anon DML on 9 CRM tables** | MEDIUM | TRUNCATE fixed 2026-08-25 but anon INSERT/UPDATE/DELETE remain. Deferred. | Wave 2 anon DML revoke (S9 pattern). |
| ~~S13~~ | ~~**SSO: anon DML on `sso_permission_load_failures`**~~ | RESOLVED (2026-09-01) | EF `log-permission-failure` writes via service_role; SPA call EF only. | `20260901122000_sso_anon_hygiene.sql` (+ revoke orphaned `handle_new_user*` / metadata readers from anon). |
| ~~S14~~ | ~~**HU Storefront: anon write hole on admin tables**~~ | RESOLVED (2026-09-01) | CRITICAL: policies `Allow anon insert/update` on `properties` / `Member` / `Office` with `USING(true)`; anon SELECT of full `audit_log`. | Dropped exploitable policies; revoked anon DML on admin tables; Wave 2F TRUNCATE; retained public INSERT surfaces. `20260901124000_s14_hu_anon_write_hole.sql`. |
| S15 | **HU Storefront: anon can UPDATE any `shared_collections` row** | HIGH | Policy `Anyone can update view count` is `UPDATE … USING (true) WITH CHECK (true)` for role `public`, and `anon` retains the UPDATE grant, so the write is not limited to the counter column. Same class as S14; survived the S14 migration because the policy name did not match the drop list. Found by the post-remediation re-audit. | Move the counter behind a `SECURITY DEFINER` RPC (or a column-scoped policy), then revoke anon UPDATE. Not behaviour-neutral — needs a UI change. |
| S16 | **HU Storefront: default privileges still grant anon write on future tables** | HIGH | The `ALTER DEFAULT PRIVILEGES` half of the S14 migration never ran (the transaction aborted on a pre-existing policy). `pg_default_acl` for `postgres` reads `anon=arwdxtm`, so the next Lovable-created table re-opens the S14 class with no code change. HRMS shows `anon=rxtm` — proof the statement works when it lands. | **Deferred by ops decision 2026-09-01** — the fix (re-running the `ALTER DEFAULT PRIVILEGES` block alone) affects future objects only and is provably behaviour-neutral, but HU is the live Hungarian production site and no further changes were authorised. **Compensating control: re-check HU anon DML after any release that adds tables** — the invariant is not self-sustaining while this is open. |
| S17 | **HU Storefront: any authenticated user can forge `audit_log` rows** | MEDIUM | Policy `Service role can insert audit logs` is declared for `public` with `WITH CHECK (true)` while `authenticated` holds the INSERT grant. The real writer, `audit_trigger_function`, is `SECURITY DEFINER` and does not need that grant. | Scope the policy to `service_role` and revoke `authenticated` INSERT, once confirmed no client writes audit rows directly. |

**Durability caveat on Wave 2F (S6/S10):** on SSO, CDL, HRMS, ITSM and HU Storefront the
`supabase_admin`-owned default ACL still reads `anon=arwdDxtm`, TRUNCATE included. Wave 2F
holds for tables created by `postgres` (the normal path) but not for ones created by
`supabase_admin`. Do not state the invariant more strongly than that.

### Medium-Term (Hardening)

| # | Finding | Severity | Detail | Remediation |
|---|---------|----------|--------|-------------|
| H1 | **Promote ES256 standby key to "current"** | MEDIUM | ES256 key is standby in SSO project. Once stable, promote to current and retire HS256. | Dashboard → Settings → JWT Signing Keys → Promote. Then update Edge Functions to remove HS256 fallback. |
| H2 | **5 functions with mutable `search_path`** | LOW | `match_kb_embeddings`, `create_jwt_secret`, `mask_secret`, `update_ad_users_updated_at`, `audit_sso_applications` lack `SET search_path = public`. | Add `SET search_path = public` to each function definition. |
| H3 | **`pg_trgm` extension in public schema** | LOW | Should be in a dedicated `extensions` schema. | `ALTER EXTENSION pg_trgm SET SCHEMA extensions;` (create schema first if needed). |
| ~~H4~~ | ~~`oauth-userinfo` not updated for ES256~~ | RESOLVED (2026-07-09) | `oauth-userinfo` now delegates to the shared `verifySsoJwt()` helper — ES256 via public JWKS first, then HS256, then opaque lookup. See [ADR-011 §Verification consolidation](../architecture/decisions/ADR-011.md). |
| H5 | **`developer_projects` / `developers` permissive INSERT/UPDATE** | PARTIAL (2026-08-19) | Wave 2C replaced `{public} USING(true)` policies with `TO authenticated` only — **anon can no longer read/write** developer rows. Cross-tenant `USING(true)` for `authenticated` remains (separate Phase 3 ticket). | Add tenant_id checks to INSERT/UPDATE/SELECT policies for `authenticated`. |

### Completed

| # | Finding | Date | Resolution |
|---|---------|------|------------|
| ~~C1~~ | sso_roles CRUD flags wrong (Broker=cru, Staff=cru) | 2026-04-09 | Migration 041: Broker→r, Staff→ru, Senior Broker→ru |
| ~~C2~~ | sso_user_permissions RLS uses stale `active_scope` claim | 2026-04-09 | Migration 041: replaced with `get_active_scope()` helper |
| ~~C3~~ | sso_role_configurations not readable by native tokens | 2026-04-09 | Migration 041: added `auth.uid()` tenant fallback |
| ~~C4~~ | sso_applications anonymous read exposes all columns | 2026-04-09 | Migration 041: restricted anon to display columns only |
| ~~C5~~ | ES256 JWT signing for SSO instance | 2026-04-09 | ADR-011: ES256 key generated, vault stored, standby imported, Edge Functions updated |
| ~~C7~~ | SSO/CDL/MSA/ITSM anon GRANT + `USING(true)` bypass | 2026-08-19 | Wave 2 (`20260819162000`–`20260819165000`): revoked anon DML on SSO token/permission/business tables, MSA app DB, ITSM, Qobrix RLS, CY Web Site; CDL anon SELECT removed from `properties`/`property_media`/`mls_sources` after app repos switched to `cdlClient`. Rollback SQL in `matrix-platform-foundation/supabase/*/rollback/20260819_wave2_*.sql`. |
| ~~C8~~ | `TRUNCATE` granted to anon/authenticated on every public table (RLS does not apply) | 2026-08-19 | Wave 2F (`20260819170000_wave2f_revoke_truncate.sql`, all six projects): revoked `TRUNCATE` from `anon` + `authenticated`; `service_role` keeps it. Default privileges for role `postgres` also revoked so new tables no longer inherit it. |
| ~~C9~~ | Comms RLS-off ops tables (S7) | 2026-08-25 | `20260825140000_s7_rls_ops_tables.sql` on `ujowkipnqgtazmtdsnlm` |
| ~~C10~~ | Pipeline 2.0 TRUNCATE (S6 slice) | 2026-08-25 | `20260825141000_wave2f_revoke_truncate.sql` on `kzvhqgpedapzqmwgikrw` |
| ~~C11~~ | CDL anon DML (S9) | 2026-08-25 | `20260825142000_s9_anon_revoke_dml.sql` on `ofzcokolkeejgqfjaszq` |
| ~~C12~~ | SSO SECURITY DEFINER compatibility views (S2) | 2026-08-25 | `20260825153000_s2_views_security_invoker.sql` on `xgubaguglsnokjyudgvc` |

### Anon GRANT vs RLS (defect class)

Supabase security linter flags **RLS disabled** tables. A separate class — not caught by that alert — is **RLS enabled + anon still holds GRANT + policy `USING(true)` / `WITH CHECK(true)` for role `{public}` or `{anon}`**. PostgREST then executes as `authenticated` when the client sends a valid JWT (normal browser path), but anyone with the **publishable anon key alone** can still read/write every row the policy allows. Wave 1 (Aug 2026) enabled RLS on CDL/SSO tables missing it; Wave 2 closed the remaining anon GRANT holes project-wide. **Remediation pattern:** `REVOKE` anon DML (and sensitive SELECT) + narrow policies to `TO authenticated` or `service_role` as appropriate; never rely on "apps always send JWT" without revoking anon grants.

### TRUNCATE bypasses RLS (defect class)

`TRUNCATE` is **not** subject to row security — Postgres checks only the table-level privilege, so no `USING` / `WITH CHECK` clause can restrict it. A role holding `TRUNCATE` can empty a table regardless of how carefully its policies are scoped. Supabase's default grants hand `arwdDxtm` to `anon` and `authenticated` on every new table in `public`, and `D` is `TRUNCATE`.

Wave 2F revoked it from both roles across all six projects (253 `authenticated` + 30 `anon` table privileges) and left `service_role` untouched, since Edge Functions and ingestion legitimately truncate staging tables. Because the grant comes from *default privileges*, a one-off revoke drifts back on the next table: the migration therefore also runs `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated`.

**Residual:** the `supabase_admin` default ACL still carries `D` and cannot be altered without superuser. Tables created by that role would re-acquire `TRUNCATE`; Matrix migrations and Lovable both create tables as `postgres`, so this is latent rather than active. Re-check with:

```sql
SELECT grantee, count(*) FROM information_schema.role_table_grants
WHERE table_schema='public' AND privilege_type='TRUNCATE'
  AND grantee IN ('anon','authenticated') GROUP BY grantee;
```

| ~~C7~~ | Fresh login looped in storage-stripping embedded browsers (Cursor webview) — orphaned PKCE verifier | 2026-05-31 | ADR-019: server-managed PKCE opt-in (`sso_applications.server_managed_pkce`); `oauth-token` requires `code_verifier` only when not flagged. Enabled for Matrix Pipeline 2.0. |

## Cross-Reference

| For | See |
|-----|-----|
| How apps consume auth/permissions | [app-template.md](app-template.md) |
| Weekly infosec audit runbook + dated reports | [security-audit-runbook.md](security-audit-runbook.md), [security-audits/](security-audits/) |
| ES256 migration decision and progress | [ADR-011](../architecture/decisions/ADR-011.md) |
| App catalog with per-app RESO resource access | [app-catalog.md](app-catalog.md) |
| Full ecosystem architecture | [ecosystem-architecture.md](ecosystem-architecture.md) |
| Compliance and data protection | [compliance.md](compliance.md) |
