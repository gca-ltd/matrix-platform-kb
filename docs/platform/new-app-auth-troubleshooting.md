# New App Auth Troubleshooting Guide

> When a newly registered Matrix app cannot authenticate users via SSO,
> work through the checklist below in order. Each section covers one
> failure mode with its symptoms, root cause, and fix.

## Prerequisites

- App registered in SSO Console (`https://intranet.sharpsir.group/console/iam/apps`)
- `CLIENT_ID` set in the app's `src/lib/matrix-sso.ts`
- Redirect URIs configured (Lovable custom name + project UUID)

---

## 1. `401 invalid_client` — Client ID Mismatch

### Symptoms

- Browser console: `oauth-authorize?client_id=... 401 (Unauthorized)`
- Response body: `{"error":"invalid_client","error_description":"Invalid client_id"}`
- Happens immediately on app load (before login form appears)

### Root Cause

The `CLIENT_ID` in the app's `matrix-sso.ts` does not exactly match the
`client_id` column in the `sso_applications` table. Common causes:

- **Special characters dropped or altered** — client IDs are auto-generated
  and may contain dots (`.`), underscores (`_`), tildes (`~`), or hyphens (`-`).
  Copy-paste from the SSO Console's "full data view" mode, not the friendly view.
- **Whitespace or invisible characters** — trailing space or newline after paste.
- **App not yet saved** — the SSO Console "Edit Application" dialog was open but
  "Save Changes" was never clicked.
- **`is_active` is false** — the query filters on `is_active = true`.

### How to Verify

Query the database directly:

```bash
curl -s "https://xgubaguglsnokjyudgvc.supabase.co/rest/v1/sso_applications?client_id=eq.<YOUR_CLIENT_ID>&select=client_id,is_active,app_title" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

- Empty array `[]` → client_id not found or `is_active` is false.
- Non-empty → client_id is registered; problem is elsewhere (skip to section 2).

### Fix

1. Open SSO Console → Applications → your app → toggle to **Full** data view.
2. Copy the exact `client_id` value.
3. Paste into `src/lib/matrix-sso.ts` as the `CLIENT_ID` constant.
4. Ensure the Lovable preview rebuilds (watch for the green ready indicator).
5. **Hard-reload** the preview (Ctrl+Shift+R) to pick up the new bundle.

---

## 2. `401 invalid_token` — Stale Supabase Session

### Symptoms

- Browser console: `oauth-authorize?client_id=... 401 (Unauthorized)`
- Response body: `{"error":"invalid_token","error_description":"invalid JWT: ..."}`
- SSO login page shows **"Signing in..."** spinner but never completes.
- Network tab shows **pairs of requests** to `oauth-authorize` (OPTIONS preflight +
  GET), confirming an `Authorization` header is being sent.

### Root Cause

The SSO login page (`intranet.sharpsir.group/sso-login/`) shares the Supabase
SSO instance with all Matrix apps. It stores the Supabase session in
`localStorage` under the key `sb-xgubaguglsnokjyudgvc-auth-token`.

If the user previously logged in to any Matrix app from the same browser, the
SSO login page finds this session and tries to auto-complete the OAuth flow
without prompting for credentials. If the session token has expired, the call to
`oauth-authorize` with the stale `Authorization: Bearer <expired_token>` returns
`401 invalid_token`.

The `oauth-authorize` function validates tokens at line 328-335:

```
Authorization header present → extract Bearer token → getUserFromToken()
  → token valid: proceed to generate auth code
  → token invalid/expired: return 401 invalid_token
```

### How to Verify

Test the same URL with and without an Authorization header:

```bash
# Without auth header → should return 302 (redirect to login)
curl -s -o /dev/null -w "%{http_code}" \
  "https://xgubaguglsnokjyudgvc.supabase.co/functions/v1/oauth-authorize?client_id=<ID>&redirect_uri=<URI>&response_type=code&scope=openid+profile+email&state=test&code_challenge=abc&code_challenge_method=S256"

# With invalid auth header → returns 401
curl -s \
  "https://xgubaguglsnokjyudgvc.supabase.co/functions/v1/oauth-authorize?client_id=<ID>&redirect_uri=<URI>&response_type=code&scope=openid+profile+email&state=test&code_challenge=abc&code_challenge_method=S256" \
  -H "Authorization: Bearer some_expired_token"
```

If the first returns 302 and the second returns 401, the issue is the stale token.

### Fix

1. Open DevTools → **Application** tab → **Local Storage**.
2. Select the `https://intranet.sharpsir.group` origin.
3. Delete the `sb-xgubaguglsnokjyudgvc-auth-token` entry (or clear all).
4. If testing in Lovable preview, also check the app's preview origin
   (`id-preview--<uuid>.lovable.app`) and clear any `sb-` entries there.
5. Hard-reload (Ctrl+Shift+R).

The SSO login page will now do a fresh Azure AD login instead of reusing the
expired session.

---

## 3. `400 invalid_request` — Redirect URI Mismatch

### Symptoms

- Response body: `{"error":"invalid_request","error_description":"Invalid redirect_uri"}`
- Status code: 400 (not 401)

### Root Cause

The `redirect_uri` sent by the app does not match any entry in the
`redirect_uris` array stored in `sso_applications`.

Lovable apps have four standard redirect URIs that should be registered:

| Pattern | Example |
|---------|---------|
| `https://<custom-name>.lovable.app/auth/callback` | `https://matrix-people-access.lovable.app/auth/callback` |
| `https://preview--<custom-name>.lovable.app/auth/callback` | `https://preview--matrix-people-access.lovable.app/auth/callback` |
| `https://<uuid>.lovableproject.com/auth/callback` | `https://210fc609-...lovableproject.com/auth/callback` |
| `https://id-preview--<uuid>.lovable.app/auth/callback` | `https://id-preview--210fc609-...lovable.app/auth/callback` |

### How to Verify

Check the Network tab → Payload → `redirect_uri` value, then compare against
the registered URIs in the SSO Console.

### Fix

Add the missing redirect URI in SSO Console → Edit Application → redirect URIs,
then save.

---

## 4. `403 access_denied` — No User Permissions

### Symptoms

- Login completes, Azure AD auth succeeds, but final redirect fails.
- Response body: `{"error":"access_denied","error_description":"User does not have access to this application"}`
- Status code: 403

### Root Cause

The `oauth-authorize` function checks user permissions after token validation.
Access is granted if the user has `rw_global`, `rw_org`, or `rw_own` permissions,
OR if default permission settings are configured in `admin_settings`.

New users with no explicit permissions AND no default settings configured
will be denied.

### Fix

Either:
- Assign the user a role/permission in SSO Console → Users → Edit User.
- Or configure default user assignment in SSO Console → Settings →
  Default User Assignment (sets `default_permission_type` so new users
  get baseline access).

---

## 5. Lovable Preview-Specific Issues

### Preview not picking up code changes

- **Symptom**: Fixed `CLIENT_ID` in code but 401 persists.
- **Cause**: Old JS bundle cached, or Lovable hasn't rebuilt yet.
- **Fix**: Wait for Lovable rebuild indicator, then Ctrl+Shift+R.
- **Verify**: Check deployed bundle — the published app at
  `https://<custom-name>.lovable.app/` may already have the fix while
  the preview lags behind.

### SSO login page in iframe loses context

- **Symptom**: SSO login shows but Azure AD redirect fails or loops.
- **Cause**: Third-party cookie restrictions block the Supabase session
  in the SSO login iframe.
- **Fix**: Test on the published URL (`*.lovable.app`) in a new tab
  instead of the Lovable editor preview.

---

## 6. Signed in, but the app or a page is blocked

Login succeeded. The screen is one of three, and they are different problems.

| Screen | Meaning | Where it is decided |
|--------|---------|---------------------|
| "… isn't available to this role" | This role's `apps_allowed` does not include the app's client id, and the token's `allowed_apps` list is non-empty | `isAppAllowed` in `src/lib/appAccess.ts`, checked first in `ProtectedRoute` |
| "Page Not Available — not included in the permissions for {role}" | The grant read succeeded and this page key is absent | `useRoleConfig` → `canAccessPage`, after a successful load |
| "Couldn't verify your permissions" | The grant read failed or the token was missing. This is **not** a denial | `useRoleConfig` error path. See [ADR-045](../architecture/decisions/ADR-045.md) |

An empty `allowed_apps` claim opens the app (silence is not a denial). A populated list that omits this client id closes it.

### Read the live rows before changing anything

SSO project `xgubaguglsnokjyudgvc`. Replace the email, and use the role uuid from the first query in the second. `sso_role_configurations.role_id` is text; cast the uuid.

```sql
-- 1. Which roles this person can switch to, and which tenant each role belongs to
SELECT r.id AS role_id, r.role_name, r.scope, r.tenant_id, a.is_primary
FROM auth.users u
JOIN public.sso_user_role_assignments a ON a.user_id = u.id
JOIN public.sso_roles r ON r.id = a.role_id
WHERE lower(u.email) = 'person@example.com'
ORDER BY r.role_name;

-- 2. The grant for that role, this app, and the tenant they are currently in
SELECT c.pages, c.actions
FROM public.sso_role_configurations c
WHERE c.role_id = '<role-uuid>'
  AND c.app_id = '<client-id>'
  AND c.tenant_id = '<tenant-uuid>';

-- 3. Whether the role is allowed to open the app at all
SELECT 'Dk4cIY3~VvwYYgFIU.2gCdAfewWb34AZ' = ANY(apps_allowed) AS msa_allowed, apps_allowed
FROM public.sso_roles
WHERE id = '<role-uuid>';

-- 4. Teams. A broker with no membership stamps owner_team_id NULL, and managers never see those rows
SELECT g.group_name, g.tenant_id, m.is_home_team
FROM auth.users u
JOIN public.sso_user_group_memberships m ON m.user_id = u.id
JOIN public.sso_user_groups g ON g.id = m.group_id
WHERE lower(u.email) = 'person@example.com';
```

There is no `sso_users` table. Acme's individual-contributor role is named "Broker at Acme" (`ac000003`, `20261005170000`); Sharp SIR's is "Broker" (`1852b335`). The uuid in query 1 is the one the app checks.

### Which change to make

| What the queries show | Do this |
|-----------------------|---------|
| `apps_allowed` does not contain the client id | Add the client id to that role's `apps_allowed`. The tile and `isAppAllowed` both read it. A new value is in the JWT, so the person signs in again. |
| No grant row, and the role's `tenant_id` **is** the tenant they are in | Insert `sso_role_configurations` for `(role_id, app_id, tenant_id)` with the current page keys. A reload is enough: pages are read live, not from the JWT. |
| No grant row, and the role belongs to a **different** tenant than the one on screen | They switched organization (`switch-tenant`) and kept a home-tenant role. Assign **this tenant's** role. Do not copy the home grant across: Acme's `20260709160000` deletes non-Acme role ids from the Acme tenant. New roles appear only after sign-out and sign-in. |
| The screen is "Couldn't verify your permissions" | The read failed. Retry or sign in again. Do not add a grant to "fix" a load error. [ADR-045](../architecture/decisions/ADR-045.md). |

MSA page keys (since 2026-09-16) are per page: `my-day`, `calendar`, `email`, `pipeline`, `follow-ups`, `offers`, `contacts`, `listings`, `leads`, `profile`. A stored `home` does not open Pipeline or Listings. See [security-model.md](security-model.md) § `sso_role_configurations`.

---

## Quick Diagnostic Flowchart

```
App calls oauth-authorize → what HTTP status?
│
├─ 401 → Check response body:
│  ├─ "invalid_client" → Section 1 (client_id mismatch)
│  └─ "invalid_token"  → Section 2 (stale session)
│
├─ 400 → "invalid_request" → Section 3 (redirect_uri mismatch)
│
├─ 403 → "access_denied" → Section 4 (no permissions)
│
├─ 302 → Working correctly (redirects to SSO login)
│
├─ 500 → Server error; check Supabase Edge Function logs
│
└─ 200, signed in, but blocked inside the app → Section 6
   ├─ "isn't available to this role" → apps_allowed / allowed_apps
   ├─ "Page Not Available"           → sso_role_configurations for (role, app, tenant)
   └─ "Couldn't verify your permissions" → load failed (ADR-045), not a missing grant
```

---

## Relevant Source Files

| File | Purpose |
|------|---------|
| `supabase/functions/oauth-authorize/index.ts` | Authorization endpoint (client lookup, token validation, permission check) |
| `supabase/functions/oauth-token/index.ts` | Token exchange endpoint |
| `supabase/migrations/001_sso_schema.sql` | `sso_applications` table definition |
| `src/lib/matrix-sso.ts` (in each app) | Client-side OAuth configuration (`CLIENT_ID`, `BASE_PATH`) |
| `src/components/ProtectedRoute.tsx` | The three blocked-in-app screens |
| `src/lib/appAccess.ts` | `isAppAllowed` — client id vs `allowed_apps` |
| `src/hooks/useRoleConfig.ts` | Loads `sso_role_configurations` for the active tenant; `NO_ACCESS` when a non-admin role has no row |

> **Source repo**: `/home/bitnami/matrix-platform-foundation`
