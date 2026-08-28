# Matrix App Template — How to Build Sharp Matrix Apps

> Source: `/home/bitnami/matrix-apps-template-2-1` (canonical starter kit — GitHub `sharpsir-group/matrix-apps-template-2-1`). The prior `/home/bitnami/matrix-apps-template` is **obsolete**; do not scaffold from or update it.
> Examples:
> - `/home/bitnami/matrix-hrms` — Domain-Specific app (HR, 25+ tables)
> - `/home/bitnami/matrix-pipeline` — CDL-Connected app (CRM, leads, pipeline)
> - `/home/bitnami/matrix-itsm` — Domain-Specific app (IT service desk, CMDB; repo: `gca-ltd/matrix-itsm`)
> - `/home/bitnami/matrix-fm` — Domain-Specific app (financial reporting, budgeting)
>
> **For Lovable**: Read this document before building ANY Matrix App. It defines the
> exact patterns, conventions, and architecture you must follow.

## Two Types of Matrix Apps

Before building, determine which type of app you're creating:

| Type | CDL Usage | App DB Usage | Example |
|------|-----------|-------------|---------|
| **CDL-Connected** | Reads/writes shared RESO tables (`Property`, `Member`, `Contacts`, `SavedSearch`, `ShowingAppointment`, `TransactionManagement`, …) | May have some app-private tables (e.g. matrix-pipeline Commission Engine ERP-lite) | Matrix Pipeline 2.0 (`/home/bitnami/matrix-pipeline`, consolidates broker / manager / contact-center / listing-coordinator workflows), Client Portal, Marketing App |
| **Domain-Specific** | Only uses CDL for auth/permissions/tenants | Has its own Supabase instance with domain tables | HRMS (`/home/bitnami/matrix-hrms`), Matrix FM (`/home/bitnami/matrix-fm`), ITSM (`/home/bitnami/matrix-itsm`) |

**Decision rule**: If your app works with real estate listings, contacts, agents, or showings → CDL-Connected. If your app has its own domain (HR, finance, operations) → Domain-Specific.

**What stays the same in BOTH types:**
- Dual-Supabase architecture (SSO instance + App DB instance)
- SSO auth (OAuth 2.0 + PKCE + JWT)
- Permission model (5-level scope + CRUD + page/action access)
- RLS patterns (A-E)
- UI framework (shadcn/ui + Tailwind + Sharp design system)
- Data fetching (Supabase client + React Query)
- Routing (React Router v6 + ProtectedRoute)
- i18n (runtime DB-driven via CDL `app-i18n`; single bundled English baseline; CDL-backed tenant terminology overrides)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vite + React 18 + TypeScript |
| UI | shadcn/ui (60+ Radix components) + Tailwind CSS |
| Design | Sharp design system: Navy palette, Playfair Display (headings) + Inter (body) |
| Data | `@supabase/supabase-js` v2 + TanStack Query (React Query) |
| Auth | Custom SSO (OAuth 2.0 + PKCE) via Supabase Edge Functions, ES256 JWT signing ([ADR-011](../architecture/decisions/ADR-011.md)) |
| i18n | Runtime DB-driven i18next: bundled `en` baseline + CDL `app_ui_strings`/`app-i18n` ([ADR-021](../architecture/decisions/ADR-021.md)) + CDL terminology overrides ([ADR-020](../architecture/decisions/ADR-020.md)) |
| Routing | React Router v6 with `ProtectedRoute` guards |

## Dual-Supabase Architecture

Every Matrix App connects to **two Supabase instances**:

> **Updated Apr 2026 (ADR-012 / ADR-013):** SSO and CDL are now **two
> separate Supabase projects**, both owned by
> `matrix-platform-foundation`. Client code splits into `ssoClient`
> and `cdlClient` (exported from the same `dataLayerClient.ts` for
> migration ergonomics, but pointing at different projects).

| Instance | Project ID | Client Export | Purpose |
|----------|-----------|---------------|---------|
| **SSO** | `xgubaguglsnokjyudgvc` | `ssoClient` from `dataLayerClient.ts` | Authentication, roles, permissions, tenants, SSO admin EFs |
| **CDL** | `ofzcokolkeejgqfjaszq` | `cdlClient` from `dataLayerClient.ts` | Shared `mls_*` business data, ingestion control plane |
| **App Database** | Per-app (e.g., HRMS: `wltuhltnwhudgkkdsvsr`) | `supabase` from `client.ts` | App-specific business data with RLS |

### SSO Instance Tables

| Table | Purpose |
|-------|---------|
| `ad_users` | Azure AD user directory cache |
| `tenants` | Organization/tenant records |
| `app_settings` | Per-tenant app configuration (JSON) |
| `sso_user_groups` | Team/group memberships |
| `sso_role_configurations` | Per-role page and action access lists (shared across apps; keyed by `(role_id, app_id, tenant_id)`) |

> Role config is stored in the shared SSO table `sso_role_configurations`, whose unique key is `(role_id, app_id, tenant_id)`. Every role-config read, upsert (`onConflict: 'role_id,app_id,tenant_id'`), and delete MUST be scoped by `app_id` (exposed as `ROLE_CONFIG_APP_ID` from `src/integrations/supabase/dataLayerClient.ts`) — omitting it causes "no unique or exclusion constraint matching the ON CONFLICT specification" and/or cross-app contamination.
>
> **`app_id` = the app's OAuth client_id.** As of `matrix-apps-template-2-1`, `ROLE_CONFIG_APP_ID` defaults to the app's OAuth client_id (`VITE_SSO_CLIENT_ID`, via `getClientId()`). The client_id is already unique per app and is the identity each app is registered under in SSO, so role config is namespaced automatically with no extra env var — the old `VITE_ROLE_CONFIG_APP_ID` has been removed from the template. Legacy apps (`matrix-hrms` = `'hrms'`) still pin an explicit slug; that is back-compat only and not required for new apps.
>
> **Permission model — admin-by-default.** Admin-scope users (`system_admin`, `org_admin`, `global`) always have access; every other role has **no** access until an admin explicitly grants pages/actions in the Role Config panel. The runtime gate (`src/hooks/useRoleConfig.ts`) enforces this (admin scope → full; any other role with no config row → no access), and the `RoleConfigPanel` reflects it (an unconfigured role renders as "None", not "All Pages"). This is a deliberate divergence from the older "empty table = all roles full access, then strict once any row exists" rule that `matrix-hrms` still uses; `matrix-hrms` is left unchanged and aligning it is a separate follow-up.

### App DB Client Setup

The app database client injects the SSO JWT for RLS:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: { 'x-sso-email': userEmail },
  },
  accessToken: async () => ssoAccessToken,
});
```

The `accessToken` hook injects the SSO JWT into every request. RLS policies read claims from `current_setting('request.jwt.claims')`.

#### Provision Third-Party Auth on the App DB (REQUIRED)

A freshly connected App DB project will **not** verify the SSO ES256 token until
it has a **Third-Party Auth** integration registered against the SSO JWKS +
issuer (same mechanism the CDL project uses). Without it, every App DB PostgREST
query returns `401 PGRST301`. The app cannot self-provision this — it is
per-project Supabase config and is now done **centrally from the SSO Console**
(ADR-018 + ADR-027).

Canonical values (SSO project `xgubaguglsnokjyudgvc`):

- OIDC Issuer URL: `https://xgubaguglsnokjyudgvc.supabase.co/auth/v1`
- JWKS URL: `https://xgubaguglsnokjyudgvc.supabase.co/auth/v1/.well-known/jwks.json`

**What does NOT work.** `config.toml` cannot configure TPA — in the Lovable flow
it only controls Edge Function `verify_jwt`, and `[auth.third_party.*]` supports
only the named providers `firebase` / `auth0` / `aws_cognito` (no generic
issuer/JWKS block). The Dashboard's **Custom OIDC Providers** is also the wrong
feature: it is a *relying-party login* flow (`signInWithOAuth({ provider:
'custom:...' })`) that mints a second App-DB session/token and breaks the
single-SSO-token + RLS model. The **Third-Party Auth** section is correct, but
its dashboard UI only lists the named providers and cannot take our Supabase
issuer (see [supabase/supabase#28743](https://github.com/supabase/supabase/issues/28743)).

**Provisioned from the SSO Console (recommended, ADR-027).** An admin opens
the app in the Console (**Applications → app → Third-Party Auth (App DB)**),
pastes the App DB **project ref**, and clicks **Provision TPA**. The
`admin-apps` Edge Function reads one platform-held Supabase Management PAT from
the SSO Vault (`sso_supabase_management_pat`) and makes the Management API call
below on the app's project. It records the outcome on `sso_applications`:

- `app_supabase_project_ref` — the App DB project ref
- `tpa_status` — `null | provisioned | failed`
- `tpa_provisioned_at`, `tpa_integration_id`, `tpa_last_error`

On success it also sets `jwt_secret_name = NULL` so `oauth-token` mints ES256
(the TPA-trusted alg). Endpoints: `POST /admin-apps/{id}/provision-tpa`
(`{ project_ref?, reload? }`) and `GET /admin-apps/{id}/tpa`. The app installs
nothing — a business user just gives their admin the project ref. The Console's
**Force Data-API reload** toggle re-registers the integration (DELETE + POST) to
clear a lingering `401 PGRST301` (~60–90s).

The underlying Management API call (what the Console performs):

```http
POST https://api.supabase.com/v1/projects/{APP_DB_REF}/config/auth/third-party-auth
Authorization: Bearer {SUPABASE_PAT}
Content-Type: application/json

{
  "oidc_issuer_url": "https://xgubaguglsnokjyudgvc.supabase.co/auth/v1",
  "jwks_url": "https://xgubaguglsnokjyudgvc.supabase.co/auth/v1/.well-known/jwks.json"
}
```

**Deprecated fallback (pre-ADR-027).** Where the Console is unreachable, the
template still ships a **one-time bootstrap Edge Function** (`bootstrap-tpa`)
that calls the Management API from inside Lovable using an `ACCOUNT_ACCESS_TOKEN`
secret (a **Supabase Personal Access Token**), gated by the project's
auto-injected `service_role` key — **invoke once, then delete the function and
rotate the PAT**. Documented (not committed) in `.lovable/instructions.md`. Avoid
for new apps; prefer the Console action.

**Verified working** on the HU app's App DB (`rwgfixcfgviaqonhhqev`): the
Management API resolved the SSO ES256 keys (integration present with resolved
JWKS), so a live logged-in SSO token against the App DB is trusted (no
`401 PGRST301`).

### CDL Client Setup (for CDL-Connected Apps)

CDL-Connected apps read the shared CDL tables through the `cdlClient`
exported from `dataLayerClient.ts`. The CDL project is configured with
**Supabase Third-Party Auth** pointing at the SSO JWKS URL + issuer,
so PostgREST verifies SSO-issued ES256 tokens directly. Apps forward
the SSO access token as the bearer — no Supabase-native token juggling.

```typescript
// dataLayerClient.ts — split SSO and CDL clients
export const SSO_SUPABASE_URL = 'https://xgubaguglsnokjyudgvc.supabase.co';
export const CDL_SUPABASE_URL = 'https://ofzcokolkeejgqfjaszq.supabase.co';

export function buildSsoClient() { /* …SSO anon key… */ }
export function buildCdlClient() { /* …CDL anon key… */ }

export const ssoClient = buildSsoClient();
export const cdlClient = buildCdlClient();
```

> **SSO-data reads (org switcher, branding, role config) — direct authenticated
> `ssoClient` read, not an Edge Function.** The `TenantSwitcher` tenant roster,
> `useTenantBranding` / `useTenantCurrency` / `useTenantTimezone`, and
> `sso_role_configurations` are read through the **authenticated** `ssoClient`
> (SSO JWT via `postgrestAccessToken`) against SSO PostgREST, gated by RLS
> (`"Users can view own tenant"`). Do **not** route the switcher through the
> `admin-tenants` Edge Function — that EF hop was a workaround for the
> (now-fixed) private-JWK verify bug and was reverted 2026-07-09. SSO EF calls
> that genuinely need an EF go through the single `invokeWithAuth` invoker.
> See [ADR-011](../architecture/decisions/ADR-011.md) and
> [security-model.md](security-model.md).

### Preferences vs Administration vs org settings (canonical IA)

| Surface | Route | Owns |
|---|---|---|
| **Preferences** | `/preferences` | Per-user prefs (theme, language, MCP, mailbox connect) |
| **Administration** | `/administration` | Per-app admin (permissions, data layer, AI providers, labels, integrations, write mode, MSA Qobrix ops) |
| **Organization** | Console `/iam/orgs/:id` only | Tenant identity, branding, currency, timezone, locations |

Do **not** scaffold `/settings`, `/setup`, an Organization tab, `OrgAdminPanel`, or
`update-tenant-settings` (removed). Apps are **read-only** for org branding/regional
settings via the hooks above. Hard cutover: no redirect aliases for retired paths.

Preferences is reachable by every signed-in user (`pageKey: profile`), so it must
carry **only** per-user preferences. Anything that changes behaviour for other users
— write mode above all, since it gates live CRM writes — belongs on Administration
(`pageKey: settings`) behind an admin check. Putting write mode on Preferences is a
privilege expansion, not a convenience.

**How RLS claims reach CDL PostgREST**: the CDL RLS helpers
(`public.get_active_scope`, `public.get_crud`,
`public.get_current_tenant_id`, …) read claims directly from
`auth.jwt()`. There is no `app_metadata` fallback on the CDL project
— the helpers are JWT-only so the policies remain portable to
Databricks Lakebase. See [security-model.md](security-model.md) and
ADR-012.

### Resolving user display names across projects

Because `mls_*` rows live on a different Supabase project than
`auth.users`, apps must NOT try to SQL-join listings to SSO users.
Use the `useUserDisplay` React hook (from `matrix-apps-template-2-1`),
which batches IDs and calls the `resolve-users` SSO Edge Function.

### CDL Read & Write Patterns (current)

CDL-Connected apps reach the CDL project (`ofzcokolkeejgqfjaszq`) via
EFs deployed on that project, never via direct PostgREST writes:

```
App UI → cdlClient.functions.invoke('listings-search', body)            ← filtered listing reads
App UI → cdlAnonClient.from('properties_published').select(...)         ← simple anon snapshot reads (RLS gated)
App UI → cdlClient.functions.invoke('mls-sync' | 'mls-sync-orchestrator', { action, ... })
                                                                         ← MLS Sync admin (start/cancel/save-settings/...)
```

Each CDL EF runs with `verify_jwt = false` and verifies the SSO JWT
itself (HS256 / JWKS fallback) and checks `scope` ∈
`SSO_ALLOWED_SCOPES`. The previously-planned generic `cdl-write` proxy
was never built; if a future app needs generic CRUD, add a dedicated
EF to `matrix-platform-foundation/supabase/cdl/functions/`.

## SSO Auth Flow

1. App redirects to `https://intranet.sharpsir.group/sso-login/` with PKCE code challenge
2. User authenticates via Azure AD
3. Callback at `/auth/callback` exchanges authorization code for JWT via `oauth-token` Edge Function
4. Tokens stored in `localStorage`, **namespaced per OAuth `client_id`**
   (see [ADR-042](../architecture/decisions/ADR-042.md)) so co-hosted SPAs on
   `intranet.sharpsir.group` do not overwrite each other's session:
   - `matrix_sso_access_token.<client_id>` — SSO JWT (custom claims: scope, crud, team_ids, uoi, **client_id**)
   - `matrix_sso_refresh_token.<client_id>` — for token renewal
   - `matrix_sso_user.<client_id>` — cached userinfo
   - `matrix_last_role.<client_id>` / `matrix_role_switch_ts.<client_id>` — role switch state
   - `matrix_supabase_access_token.<client_id>` — cached SSO-Supabase token for revoke
   - Legacy un-namespaced keys are adopted once when the token's `client_id`
     claim matches this app; foreign tokens are ignored
   - Always read/write via `MatrixSSOStorage` — never raw `localStorage` for SSO keys
   - `clearAll()` must clear **only** this app's namespaced keys (never the
     legacy shared PKCE verifier/state — another app may be mid-login)
5. `oauth-token` also persists `active_scope`, `active_crud`, `active_team_ids` to user's `app_metadata` (enables RLS for native token)
6. SSO JWT injected into App DB / CDL clients via the `accessToken` hook (`postgrestAccessToken`)
7. Proactive token refresh at 80% of expiry time; `BroadcastChannel` is also namespaced per `client_id`

### JWT Claims Structure

```typescript
{
  sub: string;                     // User UUID (permanent ID across all apps)
  email: string;                   // User email
  sso_role: { id: string; name: string };   // Active role (object, not string)
  scope: { id: string; name: string };      // Access scope (object, not string)
  crud: string;                    // "crud" | "cr" | "r" | "ru" | etc. (c/r/u/d letters)
  uoi: string;                     // Tenant UUID (organization ID)
  teams: Array<{ id: string; name: string }>;  // Team memberships
  team_ids: string[];              // Team UUIDs (flat array for RLS)
  allowed_apps: Array<{ id: string; name: string }>;  // Apps user can access
}
```

> See [security-model.md](security-model.md) for the full JWT claims structure with all fields.

### JWT Signing Algorithm

SSO JWTs are signed with **ES256 (ECDSA P-256)** — Supabase's default asymmetric algorithm. During migration, apps with their own Supabase project may receive **HS256** tokens signed with an app-specific secret. See [ADR-011](../architecture/decisions/ADR-011.md) for the full migration plan and [security-model.md](security-model.md#jwt-signing--es256-target--hs256-legacy) for implementation details.

**For app developers**: The signing algorithm is transparent. The Supabase JS client passes the token string; PostgREST validates it against registered keys. No app code changes are needed.

### SSO Edge Functions Called

| Function | When Called |
|----------|-----------|
| `oauth-authorize` | Initiating login redirect |
| `oauth-token` | Exchanging auth code for JWT (signs ES256 or HS256 per app config) |
| `oauth-userinfo` | Fetching user info with claims |
| `switch-role` | User switches active role → re-issues JWT (signs ES256 or HS256 per app config) |
| `switch-tenant` | System admin switches active tenant → re-issues JWT with new org context |
| `admin-ad-users` | Querying Azure AD user directory |

### Lovable Environment Detection

```typescript
function isLovableEnvironment(): boolean {
  const host = window.location.hostname;
  return host.includes('lovable.dev')
      || host.includes('lovable.app')
      || host.includes('lovableproject.com');
}
```

In Lovable dev mode: uses in-app login (bypasses external SSO redirect).
In production: redirects to external SSO login page.

## Permission Model

### 5-Level Scope Hierarchy

```
self → team → global → org_admin → system_admin
```

| Scope | Sees |
|-------|------|
| `self` | Own records only |
| `team` | Own records + team members' records |
| `global` | All records in tenant |
| `org_admin` | Full tenant access + admin functions |
| `system_admin` | Cross-tenant access + tenant switching via `switch-tenant` |

### CRUD Permission String

Format: any combination of `c`, `r`, `u`, `d`.

| Value | Meaning |
|-------|---------|
| `r` | Read only |
| `cr` | Create + Read |
| `crud` | Full access |
| `ru` | Read + Update (no create, no delete) |

### Auth Hooks

| Hook | Returns | Usage |
|------|---------|-------|
| `useAuth()` | `user`, `roles`, `tenant`, `scope`, `crud`, `teams`, `isLoading` | Global auth state |
| `useActiveRole()` | `canCreate`, `canRead`, `canUpdate`, `canDelete`, `scope` | Per-action permission checks |
| `useRoleConfig()` | `canAccessPage(pageKey)`, `canPerformAction(actionKey)`, `permissionsLoading`, `permissionsError`, `retryPermissions` | Page/route/action guards — three-state (loading / load-failed / denied); see [ADR-045](../architecture/decisions/ADR-045.md) |

### Usage Patterns

```typescript
// Check if user can create records
const { canCreate, scope } = useActiveRole();
if (!canCreate) return <AccessDenied />;

// Page gate — ProtectedRoute already waits for permissionsLoading and
// surfaces load-failed separately from a real denial. Prefer that over
// ad-hoc canAccessPage checks that ignore loading/error.
// permissionsError is only set when nothing is cached; a provable grant
// (admin fallback or cached pages) still wins over the error screen.
const { canAccessPage, permissionsLoading, permissionsError } = useRoleConfig();
if (permissionsLoading) return <BrandedLoading message="Checking permissions..." />;
if (permissionsError && !canAccessPage('hr-dashboard')) return <PermissionsLoadFailed />;
if (!canAccessPage('hr-dashboard')) return <NotFound />;

// Scope-aware data filtering (automatic via RLS, but useful for UI)
if (scope === 'self') showOnlyMyRecords();
if (scope === 'team') showTeamRecords();
if (scope === 'global') showAllRecords();
```

## Data Fetching Pattern

All data queries use Supabase client + TanStack React Query:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// READ
const { data, isLoading, error } = useQuery({
  queryKey: ['employees'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('last_name');
    if (error) throw error;
    return data;
  },
});

// CREATE
const queryClient = useQueryClient();
const createMutation = useMutation({
  mutationFn: async (newEmployee: EmployeeInsert) => {
    const { data, error } = await supabase
      .from('employees')
      .insert(newEmployee)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  },
});
```

## RLS Migration Patterns

From `supabase/migrations/003_data_model_template.sql` — choose the pattern that matches the table's **use case**, not just a scope level. Each pattern uses `get_active_scope()` internally to apply the full 5-level hierarchy.

> **Authoritative reference**: [security-model.md — RLS Policy Patterns](security-model.md#rls-policy-patterns) has the full SQL for each pattern.

| Pattern | Use Case | When to Use | Logic Summary |
|---------|----------|-------------|---------------|
| **A** | Reference tables (lookups, types) | Tenant-isolated read for all; admin-only write | Tenant isolation + CRUD check; `org_admin`/`system_admin` for INSERT/UPDATE/DELETE |
| **B** | User-owned records (listings, contacts, deals) | Record ownership matters | Scope-aware CASE: self→own, team→own+reports, global+→all in tenant |
| **C** | Tenant-wide records (config, announcements) | Everyone in tenant reads all | All records in tenant for anyone with read access |
| **D** | Admin-only tables (audit, configuration) | Only admins write | Full CRUD restricted to `org_admin` / `system_admin` |
| **E** | System tables (cross-tenant) | Platform-wide data | Cross-tenant access for `system_admin` only |

RLS helper functions (available on both App DB and CDL projects — all read from `auth.jwt()` only):
- `get_current_tenant_id()` — extracts tenant UUID from JWT `uoi` claim
- `get_active_scope()` — extracts scope from JWT (`self` / `team` / `global` / `org_admin` / `system_admin`)
- `get_crud()` — extracts CRUD string from JWT
- `get_current_user_id()` — extracts SSO user UUID from JWT `sub` claim
- `get_current_team_ids()` — extracts team UUID array from JWT
- `is_sso_admin_v2()` / `is_admin_scope()` — returns true if scope is `org_admin` or `system_admin`

> **CDL Token Architecture (Apr 2026, ADR-012):** CDL PostgREST uses
> **Supabase Third-Party Auth** against the SSO JWKS URL + issuer. Apps
> send the SSO-issued ES256 JWT directly to CDL. There is **no**
> Supabase-native-token path and **no** `app_metadata` fallback on CDL
> RLS helpers — `oauth-token` embeds `scope`, `crud`, `team_ids`, and
> `uoi` in the JWT payload itself. Keeping the helpers JWT-only is what
> makes the CDL portable to Databricks Lakebase.

## UI Conventions

### Layout

Every page uses `SidebarLayout`:

```tsx
import SidebarLayout from '@/layouts/SidebarLayout';

export default function MyPage() {
  return (
    <SidebarLayout>
      <div className="p-6">
        {/* Page content */}
      </div>
    </SidebarLayout>
  );
}
```

### Route Protection

Every route uses `ProtectedRoute` with a `requiredPage` key:

```tsx
<Route
  path="/hr-dashboard"
  element={
    <ProtectedRoute requiredPage="hr-dashboard">
      <HRDashboard />
    </ProtectedRoute>
  }
/>
```

The `requiredPage` key is checked against the role's `pages` list from `sso_role_configurations` (scoped by the app's `ROLE_CONFIG_APP_ID`) for the user's role. `ProtectedRoute` must wait for the role-config query and treat load failure as distinct from denial — see [ADR-045](../architecture/decisions/ADR-045.md).

### Sidebar Structure

The sidebar is defined in `AppSidebar.tsx` as an array of sections. Each item has a `pageKey` for permission-based visibility:

```typescript
const sidebarSections = [
  {
    title: 'Employee',
    items: [
      { title: 'My Dashboard', url: '/', icon: Home, pageKey: 'home' },
      { title: 'My Vacations', url: '/my-vacations', icon: Calendar, pageKey: 'my-vacations', countKey: 'myVacations' },
    ],
  },
  {
    title: 'Human Resources',
    requiredScope: 'global', // Section only visible to global+ scope
    items: [
      { title: 'Personnel', url: '/personnel', icon: Users, pageKey: 'personnel' },
    ],
  },
];
```

Prefer a **shared nav registry** so desktop and mobile stay in sync (see below) rather than duplicating section arrays inside `AppSidebar.tsx` alone.

### In-app notifications (`notifications` table)

The app template ships `useNotifications` + `NotificationBell` in the header. Two shapes exist in the platform:

| Shape | Used by | `recipient_id` | Read state | Live updates |
|-------|---------|----------------|------------|--------------|
| **Person-scoped** | HRMS, ITSM (workflow inbox) | SSO user UUID per row | `is_read` / `read_at` on the row | `postgres_changes` when the browser holds a user JWT on PostgREST |
| **Tenant-scoped operational** | Digital Employees (failures, approvals) | `NULL` = all tenant admins; optional UUID for direct messages | `notification_receipts` per `(notification_id, user_id)` | `realtime.send` broadcast on `notifications:<tenant_id>` + `notifications-api` EF |

**Digital Employees rules (operational inbox):**

- The browser is **anon-only** to the app DB — never query `notifications` directly from the SPA. All reads/writes go through `notifications-api` with Matrix SSO (`invokeWithAuth`).
- DB triggers on `mcp_tool_calls`, `runs`, `outbound_deliveries`, `schedule_executions`, `eval_runs`, and `employees` (publish) insert rows and ping the broadcast topic.
- Sidebar approval badges use `usePendingToolCalls()` (real count), not hardcoded template numbers.
- Do **not** ship `EXAMPLE_NOTIFICATIONS` fallbacks — an empty inbox is correct when nothing has fired.

HRMS person-scoped migrations live in `matrix-hrms/supabase/migrations/20260215200001_notifications.sql`. Digital Employees migrations live in `matrix-digital-employees/supabase/migrations/`.

### Mobile navigation and safe areas

Mobile navigation is a **real routed page** (`/menu`), not a Radix Sheet/drawer overlay. This section is the **platform design-system contract** for translucent browser chrome, safe-area gutters, and floating controls. Templates ship the utilities and shell classes; apps must not invent a parallel stack.

| Concern | Contract |
|---------|----------|
| **Entry** | Hamburger navigates to `/menu`. Desktop (`md+`) keeps the collapsible sidebar rail. |
| **History** | Nav rows use `replace` so Back never reopens the menu. |
| **Chrome** | Footer (theme / language / back-to-portal) is pinned with `pb-safe`; the nav list scrolls independently. |
| **Registry** | Templates: `src/lib/navSections.ts`. MSA-style apps: `src/config/pages.ts` (`SIDEBAR_SECTIONS`). Both `AppSidebar` and `MobileNav` import the same source. |

#### Why the bars look stable (transparency stack)

Safari’s compact URL / bottom control bars are **translucent**. Stability comes from letting page paint show through those bars — not from fighting them with opaque `theme-color` or a locked `h-screen` shell.

1. **Document scroll on mobile.** The document owns vertical scrolling. Do **not** lock the shell with `h-screen overflow-hidden` on small viewports. Desktop uses `md:h-svh md:overflow-hidden` with an internal scroller. The header is in-flow on mobile and sticky on `md+`.
2. **Transparent shell.** `SidebarLayout` outer shell is `bg-transparent` on mobile and `md:bg-background` on desktop so the document canvas (`html` / `body` `bg-background`) shows through Safari glass.
3. **Runtime `theme-color`.** Call `initThemeColor()` from `useTheme.ts` before first paint (`main.tsx`). It writes `<meta name="theme-color">` from `--background` for Chrome/Android, and **removes** the meta on iPhone/iPad so WebKit compact chrome composites over page content. Do **not** ship a static opaque `<meta name="theme-color">` in `index.html` for mobile WebKit. Viewport: `viewport-fit=cover`; do **not** set `user-scalable=no`.
4. **Menu canvas marker.** Set `html[data-surface="menu"]` while on `/menu` so the document paints the sidebar palette; Safari glass and rubber-band gaps then match the menu surface.

#### `SidebarLayout` class contract (copy these strings)

| Layer | Classes |
|-------|---------|
| **Outer shell** | `flex min-h-svh min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-transparent px-safe md:h-svh md:h-[100dvh] md:min-h-0 md:overflow-hidden md:bg-background` |
| **On `/menu`** | also `h-svh h-[100dvh] min-h-0 overflow-hidden` (lock the menu panel; list scrolls inside) |
| **Header** | `relative z-30 h-14 shrink-0 box-content pt-safe … md:sticky md:top-0` |
| **Main scroller** | normal routes: `pb-safe-content`; `/menu`: `min-h-0 flex-1 overflow-hidden` (**no** `pb-safe-content`) |

Reference implementations: `matrix-itsm`, `matrix-apps-template-2-1`, `matrix-apps-template-2-2`, MSA staging.

#### Safe-area utilities (in `index.css`)

| Class | CSS | When to use |
|-------|-----|-------------|
| `.pt-safe` / `.pb-safe` / `.px-safe` | `env(safe-area-inset-*)` only | Element has **no** competing Tailwind `p-` / `px-` / `py-` |
| `.px-safe-4` / `.px-safe-6` | `max(1rem\|1.5rem, env(…))` | Full-page flows that also need a fixed gutter. Bare `.px-safe` is unlayered CSS after Tailwind utilities and **wins the cascade**, collapsing `px-4` / `p-6` to 0 on non-notched viewports |
| `.pb-safe-6` | `max(1.5rem, env(safe-area-inset-bottom))` | Same floor rule for bottom padding |
| `.pb-safe-content` | `calc(env(safe-area-inset-bottom, 0px) + 4.5rem)` mobile; `1rem` at `md+` | Scrollable main content under Safari’s floating bottom toolbar |
| `.bottom-safe-fab` / `.right-safe-fab` | `max(1.25rem, env(…) + 0.75rem)` | Fixed FABs / floating panels (see below) |

**Decision tree**

- Pinned footers, `/menu` footer → `.pb-safe` (hardware inset only).
- Scrollable route content inside `SidebarLayout` → `.pb-safe-content` (inset + **4.5rem** toolbar reserve).
- Full-page auth / OAuth / share heroes outside the shell → `min-h-svh min-h-[100dvh]` + `.px-safe-4` (or `-6`) + `.pb-safe-content` when the page scrolls; `.pb-safe` / `.pb-safe-6` when it is a short centered card.
- Fixed floating action (Ask AI, composer, help) → `.bottom-safe-fab` + `.right-safe-fab` — **never** bare `bottom-5` alone on notched devices.

#### Floating controls vs Safari bottom bar (calculated distance)

Safari’s bottom control bar floats over the page. Content and FABs must clear it on purpose, not by accident:

| Layer | Offset from viewport bottom | Role |
|-------|----------------------------|------|
| Hardware home indicator | `env(safe-area-inset-bottom)` | Notch / home bar |
| Scroll content end | **inset + 4.5rem** (`.pb-safe-content`) | Last content clears the translucent toolbar **and** a ~48px FAB |
| FAB / chat launcher | **`max(1.25rem, inset + 0.75rem)`** (`.bottom-safe-fab`) | Sits in the glass zone, tappable; pairs with content reserve so list ends above the button |

Why **4.5rem** on content: FAB is `h-12` (3rem) + ~1.25rem bottom offset + a small gap ≈ **4.5rem**. Changing one without the other reintroduces collisions on iPhone Safari.

```tsx
// Correct — design-system utilities
<Button className="fixed z-50 h-12 w-12 rounded-full bottom-safe-fab right-safe-fab" />

// Wrong — ignores inset; collides with home indicator / toolbar on notched phones
<Button className="fixed bottom-5 right-5 …" />
```

Open chat / sheet panels that share the same corner must use the **same** `.bottom-safe-fab` / `.right-safe-fab` classes (or the expanded `inset-4` fullscreen variant on small screens).

#### Sheet overlay cut

Other Sheets still need `SheetOverlay` at `fixed inset-x-0 top-0 h-[100vh] h-[100lvh]` — plain `inset-0` resolves against iOS Safari's small viewport and leaves a gap under the overlay.

#### Adoption status (as of 2026-08-17)

| Status | Apps |
|--------|------|
| Landed (shell + safe-area + `/menu`) | `matrix-itsm`, `matrix-apps-template-2-1`, `matrix-apps-template-2-2`, `matrix-sa-staging-main` (`main` + `cdto`), `matrix-sa-hungary-staging-main` |
| FAB utilities (`.bottom-safe-fab`) | Templates + MSA Ask AI widget; other apps adopt when they add a fixed FAB |
| Still on locked shell (follow-up) | `matrix-pipeline-2-0`, `matrix-atlas-mls`, `matrix-stardom`, `matrix-fm`, `matrix-qobrix-sales-automation-rls`, `task-manager-hu-1.3`, `matrix-analytics`, `matrix-hrms`, `matrix-hrms-sandbox-3.0`, `matrix-cdl-studio` |

### Stale-bundle detection (update-available toast)

Watcher (and GitHub Actions) deploys replace hashed `assets/index-*.js` in `index.html`. Apache already sends `no-cache` for `index.html`, but an **already-open tab** keeps running the old bundle until the user reloads.

Ship `src/hooks/useAppVersionPoller.ts` and mount a tiny `<AppVersionPoller />` (hook call, returns `null`) **inside `AuthProvider`**, above `<Routes>`. In MSA-style apps with a public `/share/*` tree, mount it inside the authed shell (`TermDetailProvider` / `AuthedApp`) so share-link recipients never see a reload prompt.

The hook:

1. Polls `{BASE_URL}/index.html?t=…` every 60s, plus on `focus` and `visibilitychange`, with `cache: 'no-store'`.
2. Extracts the hashed `/assets/index-*.js` reference.
3. On the first mismatch vs the tab’s boot baseline, fires **one** sonner toast (`duration: Infinity`) with a **Reload** action. It does **not** auto-reload (that would surprise mid-edit).

**Resolve the path from Vite, not `getBasePath()`.** Use `import.meta.env.BASE_URL` (the value github-watcher patches into `vite.config.ts` `base`). Several templates still hardcode `const BASE_PATH = '/matrix-apps-template'` in `matrix-sso.ts`; polling that URL 404s and the toast never fires. `BASE_URL` is `''` on root-mounted / Lovable preview builds and `/itsm` (etc.) under the watcher.

No extra dependency: every Matrix SPA already mounts `<Sonner />` in `App.tsx`. Keep the hook free of `matrix-sso` so Lovable regenerating `App.tsx` does not pull SSO into the poller.

#### Adoption status (as of 2026-08-18)

| Status | Apps |
|--------|------|
| Landed (`useAppVersionPoller` + `App.tsx` mount) | `matrix-sa-staging-main` (`main` + `cdto`), `matrix-sa-hungary-staging-main`, `matrix-itsm`, `matrix-apps-template-2-2`, `matrix-digital-employees` |
| Follow-up (copy the same hook; mount inside `AuthProvider`) | `matrix-apps-template-2-1`, `matrix-hrms`, `matrix-pipeline-2-0`, `matrix-analytics`, `matrix-atlas-mls`, `matrix-qobrix-sales-automation-rls`, `matrix-stardom`, `matrix-fm`, `matrix-cdl-studio` |

### Sharp Design System

| Element | Value |
|---------|-------|
| Primary color | Navy/Blue (HSL variables in `index.css`) |
| Heading font | Playfair Display |
| Body font | Inter |
| Sidebar | Dark navy background |
| Components | shadcn/ui with Radix primitives |

## i18n Pattern

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('settings.title')}</h1>;
}
```

Call sites are unchanged regardless of how strings are stored: always read UI
text via `t('namespace.key')`. **How** those strings are loaded is the
runtime, DB-driven model below ([ADR-021](../architecture/decisions/ADR-021.md)).

### Runtime, DB-driven i18n (platform standard — ADR-021)

Apps **do not ship a JSON bundle per language**. Instead:

1. **One bundled English baseline** — `src/i18n/locales/en.json` is the only
   compiled-in locale. It guarantees first paint and an offline/EF-down fallback
   (`fallbackLng:'en'`), and never goes blank.
2. **Every other locale + every per-tenant relabel** (including English relabels)
   is **runtime data in the CDL** table `public.app_ui_strings` (project
   `ofzcokolkeejgqfjaszq`), served by the public **`app-i18n`** EF and fetched
   through a chained i18next backend: `LocalStorageBackend` (instant repeat
   paint, busted by a corpus `version`) → `HttpBackend` → `app-i18n`.
3. **Tenant injection** — i18n boots before auth, so `AuthContext` calls
   `setI18nTenant(tenantId)` after login (and on tenant switch) to load the
   tenant-merged bundle; the localStorage cache is purged on tenant change so a
   tenant's overrides can never mask another's.

**Adding a language is data-only**: add the code to `SUPPORTED_LANGUAGES` in
`src/i18n/index.ts`, then seed its rows in CDL (`scripts/gen_app_ui_strings_seed.mjs`
flattens your `en.json` into a CDL migration; translate the other locales as
`app_ui_strings` rows). No new bundle, no redeploy. Set `APP_KEY` in
`src/i18n/index.ts` to the app's registered key so its corpus is isolated.

The runtime + the Translations & Labels panel ship in
[`matrix-apps-template-2-1`](../../README.md) — fork them, set `APP_KEY` +
`SUPPORTED_LANGUAGES`, and seed.

### Two complementary CDL stores: chrome vs. terminology

| Layer | CDL store | Read EF | Write resource (`mls-sync`) | Settings scope |
|---|---|---|---|---|
| **Interface text** (chrome: `common`/`nav`/`settings`/`auth`/`sidebar`/`reso.*` UI) | `app_ui_strings` (app-keyed) | `app-i18n` | `app_ui_string` | "Interface text" |
| **Terminology** (RESO field/resource/lookup nouns + curated `App.*` glossary) | `reso_field_descriptions` (shared, global) | `reso-dd-descriptions` | `reso_label_override` | "Terminology" |

Both are admin-managed from Settings → **"Translations & Labels"** with a full
pager, side-by-side multi-locale editing, and an add-locale picker. Terminology
nouns render through `<ResoFieldLabel>` / `<ResoLookupValue>` / `Term`/`useTerm`.
Internal identifiers (`pageKey`, route, RESO `field`, EF `resource`) and the data
model are **never** affected — only the per-tenant, per-locale display value.
See [ADR-021](../architecture/decisions/ADR-021.md),
[ADR-020](../architecture/decisions/ADR-020.md), and
[`docs/data-models/reso-dd-descriptions.md`](../data-models/reso-dd-descriptions.md).

## Lovable-Managed Apps — Development & Maintenance Model

All Matrix business apps (HRMS, Pipeline, ITSM, Financial Management, Client Connect, Meeting Hub, MLS, etc.) are **Lovable-managed projects**. This means:

### Change Management via Lovable Prompts

The primary mechanism for modifying, fixing, or extending these apps is through **Lovable prompts** — structured instructions provided to the Lovable AI builder. Direct code edits outside Lovable are avoided because Lovable maintains its own state and may overwrite external changes on next publish.

**Best practices**:

| Practice | Detail |
|----------|--------|
| **Write prompts, not code** | Describe the desired change in a Lovable prompt; Lovable generates and applies the code |
| **Prompt files** | Store prompts as markdown files in the testing suite or project repo (e.g., `hrms-uat/prompts/`) for traceability |
| **One concern per prompt** | Each prompt should address a single feature, fix, or refactor for clarity |
| **Include file paths** | Reference exact file paths and existing code patterns so Lovable targets the right locations |
| **Specify what NOT to change** | Explicitly list files or patterns that must remain untouched to prevent regressions |
| **Test instructions** | Include testing steps in the prompt so the change can be verified after Lovable applies it |

**What CAN be changed directly (outside Lovable)**:
- SSO Edge Functions on the CDL/SSO instance (`switch-role`, `switch-tenant`, `admin-*`, etc.)
- Database migrations and RLS policies (via Supabase dashboard or CLI)
- CDL Edge Functions (`update-tenant-settings`, etc.)
- Apache deployment configuration

**What MUST go through Lovable prompts**:
- React component changes (pages, hooks, UI)
- `matrix-sso.ts` modifications (auth flow, token handling)
- Routing changes (`App.tsx`)
- State management (`AuthContext.tsx`, custom contexts)
- App-specific Edge Functions deployed from Lovable (e.g., `hrms-sync-permissions`)

### Prompt Archive

Lovable prompts for each app are stored alongside UAT materials:

| App | Prompt Location |
|-----|-----------------|
| HRMS | `/home/bitnami/matrix-testing-suite/hrms-uat/prompts/` |

## Lovable-Specific Rules

| Rule | Detail |
|------|--------|
| No `.env` files | All configuration hardcoded in `matrix-sso.ts` (Lovable doesn't support `.env`) |
| Environment detection | `isLovableEnvironment()` for dev vs production behavior |
| Component tagger | `lovable-tagger` Vite plugin in dev mode for AI component understanding |
| TypeScript strictness | Relaxed for Lovable compatibility |
| `CLIENT_ID` | Must be updated in `matrix-sso.ts` after app registration in SSO Console |
| `BASE_PATH` | Set in `matrix-sso.ts` for production subdirectory routing |
| **Remix → disable the inherited `deploy.yml`** | Both templates ship `.github/workflows/deploy.yml` — a `burnett01/rsync-deployments` job wired to `DEPLOY_PATH` / `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY`. Those secrets exist on **no** Matrix repo, so the job fails on every push to `main` and red-Xes the commit while `github-watcher` does the real deploy. Disabled platform-wide on 2026-08-18 (all 12 repos carrying it). On a new remix, disable it again: `gh api --method PUT repos/<org>/<repo>/actions/workflows/<id>/disable`. Deleting the file needs a token with `workflow` scope; the API disable does not. Leave `build.yml` (PR Build & Lint), `release.yml`, and `drift-check.yml` active. |
| **Remix → reset RN + version** | Templates keep their own generation trail (`matrix-apps-template-2-1` → `2.1.x`, `2-2` → `2.2.x`). On a **new** Lovable remix, immediately set `package.json` / lockfile `version` to `0.0.0`, rewrite `RELEASE_NOTES.md` for the new app (Unreleased only — delete template `vX.Y.Z` sections), and rebrand `AGENTS.md` (name, repo, push URL). Do not copy template GitHub tags. First product cut is this app's `v1.0.0`. Cursor and Lovable both must follow this. See template [`AGENTS.md`](https://github.com/sharpsir-group/matrix-apps-template-2-1/blob/main/AGENTS.md) § On new Lovable remix. |

## Real App Example: Matrix HRMS

Source: `/home/bitnami/matrix-hrms` — a Domain-Specific app built from the template.

### What HRMS Added Beyond the Template

| Category | Template | HRMS |
|----------|----------|------|
| Database tables | 2 (`notifications`, `role_configurations`) | 25+ domain tables |
| Custom hooks | ~5 | 30+ |
| Pages | 4 (home, auth, callback, settings) | 20+ organized by role |
| Sidebar sections | 1 | 4 (Employee, Organization, Manager, HR Admin) |

### HRMS Domain Tables

**Employee management**: `employees`, `departments`, `locations`, `employee_managers`, `employee_ad_links`

**Leave management**: `vacations`, `vacation_balances`, `leave_policies`, `public_holidays`

**Performance**: `review_cycles`, `review_participants`, `goals`

**Onboarding/Offboarding**: `onboarding_templates`, `onboarding_template_tasks`, `onboarding_checklists`, `onboarding_tasks`, `offboarding_templates`, `offboarding_template_tasks`, `offboarding_checklists`, `offboarding_tasks`

**Compensation**: `compensation_history`, `payroll_records`

**Documents**: `document_templates`, `document_distributions`, `employee_documents`

**Other**: `internal_changes`, `social_posts`, `social_comments`, `social_reactions`, `employee_agreements`, `employee_edit_requests`

### Key Patterns from HRMS

**Approval workflow** (`internal_changes`):
- Status flow: `pending` → `approved` → `applied` (or `rejected`)
- Manager approves, HR applies changes to employee record
- IF status = 'approved' AND role = 'hr_admin' THEN apply changes to `employees` table

**Template-based processes** (onboarding):
- `onboarding_templates` → defines reusable task lists
- `onboarding_checklists` → instance of a template for a specific employee
- `onboarding_tasks` → individual tasks within a checklist, tracked to completion

**Role-based sidebar sections**:
- Employee section: visible to all (scope = self+)
- Manager section: visible when user has direct reports (scope = team+)
- HR Admin section: visible to global+ scope with HR role

**Directory view with privacy** (`employee_directory`):
- Database VIEW that masks sensitive columns (salary, personal phone, etc.)
- Public queries use the view; admin queries use the full `employees` table

### HRMS Supabase Instance

| Instance | Project ID | Purpose |
|----------|-----------|---------|
| SSO | `xgubaguglsnokjyudgvc` | Auth, permissions, AD users, tenants |
| HRMS App DB | `wltuhltnwhudgkkdsvsr` | All HR tables, RLS enforced via SSO JWT |

## Key Files Reference

### In `matrix-apps-template-2-1`

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component, route definitions |
| `src/main.tsx` | Entry point, QueryClient + i18n setup |
| `src/index.css` | Sharp design system CSS variables |
| `src/lib/matrix-sso.ts` | SSO client (1000+ lines): OAuth, JWT, refresh, config |
| `src/contexts/AuthContext.tsx` | React auth context provider |
| `src/components/ProtectedRoute.tsx` | Route guard with permission checks |
| `src/integrations/supabase/client.ts` | App DB Supabase client |
| `src/integrations/supabase/dataLayerClient.ts` | SSO/CDL Supabase client |
| `src/integrations/supabase/types.ts` | App DB TypeScript types (auto-generated) |
| `src/integrations/supabase/dataLayerTypes.ts` | SSO/CDL TypeScript types |
| `src/hooks/useActiveRole.ts` | CRUD permission helpers |
| `src/hooks/useRoleConfig.ts` | Page/action permission checks |
| `src/hooks/useAppVersionPoller.ts` | Stale-bundle detector (poll `index.html`, sonner Reload toast). Canonical copy lives in `matrix-apps-template-2-2`; uses `import.meta.env.BASE_URL`, not `getBasePath()`. |
| `src/components/AppSidebar.tsx` | Main sidebar with role-based sections |
| `src/layouts/SidebarLayout.tsx` | Layout wrapper (sidebar + content) |
| `supabase/migrations/001_sso_helper_functions.sql` | RLS helper functions |
| `supabase/migrations/003_data_model_template.sql` | 5 RLS patterns (A-E) |

### In `matrix-hrms` (Domain-Specific example)

| File | What It Shows |
|------|--------------|
| `src/hooks/useEmployees.ts` | Querying employee directory with scope-aware filtering |
| `src/hooks/useVacations.ts` | CRUD operations with approval workflow |
| `src/hooks/useOnboarding.ts` | Template-based process management |
| `src/hooks/useInternalChanges.ts` | Change request workflow (create, approve, apply) |
| `src/hooks/useRoleConfig.ts` | Extended page/action permissions |
| `src/components/AppSidebar.tsx` | 4-section sidebar with badge counts and role-based visibility |

### In `matrix-atlas-mls` (CDL-Connected example)

| File | What It Shows |
|------|--------------|
| `src/integrations/supabase/cdlClient.ts` | CDL anon client (project `ofzcokolkeejgqfjaszq`) — separate from the SSO `dataLayerClient.ts` |
| `src/lib/cdl-edge-function-client.ts` | `invokeWithAuthCdl` helper — sends the SSO JWT to CDL EFs |
| `src/hooks/useMLSSync.ts` / `useMLSSettings.ts` | Calls `mls-sync-orchestrator` for sync runs (sole engine) and `mls-sync` for admin/CRUD via `invokeMlsSyncAdmin()` |
| `src/hooks/useListingsSearch.ts` | Calls the `listings-search` EF (filters / pagination / sort) |
| `src/hooks/useMlsData.ts` (`useProperties`) | Reads `public.properties_published` via the CDL anon client |
| `src/components/AppSidebar.tsx` | Sidebar groups: `Overview` / `Application` / `MLS Sync` / `Administration` |
| `src/pages/AuthCallback.tsx` | OAuth2 + PKCE callback handler |

## Common Pitfalls (LLM Guidance)

These are hard-learned lessons. Violating any of them will cause silent failures.

### 1. Do NOT reintroduce "Supabase native tokens" for CDL

**Wrong**: Juggling `localStorage.getItem('matrix_supabase_access_token')`
for CDL PostgREST calls.
**Why it's stale**: That path existed when CDL lived on the SSO project
and PostgREST validated tokens against the local project key. The
Matrix CDL is now a **separate project** (`ofzcokolkeejgqfjaszq`)
configured with **Supabase Third-Party Auth** against the SSO JWKS
URL + issuer.
**Correct**: Send the SSO-issued ES256 JWT directly as
`Authorization: Bearer …`. `buildCdlClient()` does this automatically.
See ADR-012.

### 2. CDL RLS helpers are JWT-only — no `app_metadata` fallback

**Wrong**: Copy-pasting the old CDL helper definitions that read
`auth.users.raw_app_meta_data`.
**Why it's stale**: The CDL project now verifies SSO tokens natively
via Third-Party Auth; `scope`, `crud`, `team_ids`, and `uoi` are in
the JWT payload itself. Keeping the helpers JWT-only is what makes
the CDL portable to Databricks Lakebase.
**Correct**: Use the JWT-only helpers in
`matrix-platform-foundation/supabase/cdl/migrations/` (JWT-only RLS helpers).

### 3. `oauth-token` embeds claims in the JWT payload

**Wrong**: Treating `app_metadata` as the source of truth for scope /
crud / team claims.
**Why it fails**: CDL RLS reads from `auth.jwt()` only. If the claims
are not in the payload, CDL policies silently default to `'self'` /
no CRUD and queries return empty results.
**Correct**: `oauth-token` must add `scope`, `crud`, `team_ids`,
`uoi`, and `active_app` to the JWT payload it signs. Populating
`auth.users.raw_app_meta_data` is still allowed for SSO-side
conveniences but is not the CDL fallback.

### 4. CDL writes go through CDL-project EFs (never the app's project)

**Wrong**: Calling CDL PostgREST directly for INSERT/UPDATE/DELETE
from the browser, or proxying through an EF on the app's own Supabase
project.
**Why it fails**: CORS blocks direct writes; putting a write proxy on
each app's project fragments the write boundary and requires
distributing the CDL service-role key to every app.
**Correct**: Invoke an Edge Function on the **CDL project**
(`ofzcokolkeejgqfjaszq`). Today the deployed write paths are
`mls-sync` / `mls-sync-orchestrator` for MLS ingestion and admin, and
the 5 pipeline-stage EFs for orchestrated runs. If a future feature
needs a generic CRUD proxy, add a new EF to
`matrix-platform-foundation/supabase/cdl/functions/` rather than
distributing service-role keys.

### 5. Do NOT SQL-join CDL rows to `auth.users` / `sso_users`

**Wrong**: `select properties.*, auth.users.email from properties join …`.
**Why it fails**: `auth.users` is on the SSO project, not the CDL. The
join is impossible across projects and breaks again when CDL moves to
Lakebase.
**Correct**: Resolve display names client-side with the `useUserDisplay`
React hook (from `matrix-apps-template-2-1`), which batches IDs through the
`resolve-users` SSO Edge Function.

### 6. Don't conflate scope with admin privileges

**Wrong**: Treating `global` scope as admin for write operations on
config tables.
**Why it fails**: `global` means visibility (see all records in
tenant), not admin privileges. A Sales Director with `global` scope
should NOT be able to modify checklist templates or document type
configs.
**Correct**: Restrict config table writes to
`(SELECT get_active_scope()) IN ('org_admin', 'system_admin')`.

### 7. Ingestion into CDL goes through the unified pipeline

**Wrong**: Writing a bespoke EF that inserts directly into
`public.properties` or `public.properties_published`.
**Why it fails**: Skips staging (`cdl_staging.listings_raw` /
`listings_mapped`), the merge step's dedup-by-`(source_id,
source_listing_key)`, and the per-stage `public.ingest_audit` log.
**Correct**: Add a row in `public.mls_settings` (per tenant, with
`source_id`, RESO creds, schedule), then trigger the pipeline by
calling `mls-sync-orchestrator` (`action: 'start'`). Phase 1
Best-in-Class (Apr 2026) made the orchestrator the sole sync engine —
the legacy `mls-sync` monolith path was retired and `mls-sync.start`
now proxies to the orchestrator. The orchestrator chains
`reso-import → field-mapping-apply → listing-merge → media-import (looped) →
media-merge → listing-publish` (plus `run-side-resources`) and records per-stage state in
`public.mls_orchestrator_runs`. See `docs/data-models/cdl-schema.md`
and ADR-014's Implementation Status note.
