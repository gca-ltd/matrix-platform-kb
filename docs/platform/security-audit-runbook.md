# Security Audit Runbook — Weekly Infosec Review

> Operational playbook for the **weekly** Sharp Matrix infosec audit across
> production Supabase projects (plus a short non-Supabase spot-check).
>
> **Companion docs:** [security-model.md](security-model.md) (RLS patterns +
> hardening backlog), [compliance.md](compliance.md) (GDPR / breach),
> [operations.md](operations.md) (deploy / DR). This runbook is **not** the
> schema↔code drift playbook — that is [alignment-audit-playbook.md](alignment-audit-playbook.md).

## Cadence

| Layer | Frequency | What | Cost |
|-------|-----------|------|------|
| **Advisors snapshot** | Daily (optional automation) or at least weekly | Supabase Security Advisor per in-scope project | **$0** (included in Pro) |
| **Full weekly audit** | Weekly (owner: platform / CDTO ops) | Advisors + Matrix SQL + Auth/EF/infra spot-checks | **$0** scan; remediations are separate eng work |
| **Team plan ($599/mo)** | N/A for this audit | SOC2/ISO, Dashboard SSO, longer backups/logs — **not** required for Advisors | Do not buy Team *only* for linting |

There is **no** native Supabase “email me a daily security report” or billed
security-scan SKU. Daily = our thin wrapper (MCP `get_advisors`, Management API,
or `supabase db advisors --linked`) over the free Advisors.

**Do not** enable noisy daily cron until a baseline report exists and accepted
risks are documented (otherwise every WARN floods the inbox).

## Built-in Supabase capabilities

| Surface | How | Notes |
|---------|-----|-------|
| Dashboard | `Database → Security Advisor` / `Performance Advisor` | Runs automatically; manual rerun after fixes |
| MCP | `get_advisors` with `type: security` \| `performance` | Per-project Supabase MCP in Cursor |
| Management API | `GET /v1/projects/{ref}/advisors/security` (and `/performance`) | PAT needs `advisors_read`. Marked experimental/deprecated but still used by CLI |
| CLI | `supabase db advisors --type security --linked` | Same remote API; local DB runs embedded splinter SQL |

**Docs:** [Database Advisors](https://supabase.com/docs/guides/database/database-advisors), [Pricing](https://supabase.com/pricing).

### What Advisors catch (security-relevant)

`rls_disabled_in_public`, `rls_enabled_no_policy`, `policy_exists_rls_disabled`,
`auth_users_exposed`, `security_definer_view`, `function_search_path_mutable`,
`sensitive_columns_exposed`, `permissive_rls_policy`, `public_bucket_allows_listing`,
`anon` / `authenticated` SECURITY DEFINER executable, `pg_graphql_*` exposure,
`insecure_queue_exposed_in_api`, anonymous sign-ins, outdated extensions.

### What Advisors do **not** catch (Matrix custom checks)

Documented in [security-model.md](security-model.md) § Anon GRANT vs RLS / TRUNCATE:

1. **RLS enabled + anon GRANT + `USING(true)`** — publishable anon key bypasses the JWT path.
2. **`TRUNCATE` on `anon` / `authenticated`** — RLS does not apply to `TRUNCATE`.
3. Auth settings (e.g. leaked-password / HaveIBeenPwned — backlog **S4**).
4. JWT key posture (HS256 vs ES256), Edge Function `verify_jwt` vs in-code SSO verify,
   secrets in frontend, OAuth redirect URI drift, Apache / `github-watcher` secrets,
   Databricks warehouse stay-awake cost.

Weekly audit = **Advisors + Matrix SQL + Auth/EF/infra**.

## Inventory (priority order)

Priority: blast radius → data sensitivity (PII / money / HR) → public internet → usage.

### P0 — platform

| # | System | Project ref | MCP namespace (if any) |
|---|--------|-------------|------------------------|
| 1 | Matrix SSO | `xgubaguglsnokjyudgvc` | `user-supabase-sso` |
| 2 | Matrix CDL | `ofzcokolkeejgqfjaszq` | `user-supabase-cdl` |
| 3 | CY Web Site | `yugymdytplmalumtmyct` | `user-supabase-cy-website` |

### P1 — sensitive domain / CRM

| # | System | Project ref | MCP namespace (if any) |
|---|--------|-------------|------------------------|
| 4 | HRMS | `wltuhltnwhudgkkdsvsr` | `user-supabase-hrms` |
| 5 | Matrix FM | `retujkznogwplfrbniet` | — (Management API / CLI) |
| 6 | Datacore | `zcajghoohycimpubufsy` | `user-supabase-datacore` |
| 7 | Pipeline 2.0 | `kzvhqgpedapzqmwgikrw` | `user-supabase-pipeline-2-0` |
| 8 | MSA CY | `rpoeezssicpzexarmwqq` | `user-supabase-msa` |
| 9 | MSA Hungary | `ykgyzqnuqpwasxvesxva` | `user-supabase-msa-hungary` |
| 10 | Qobrix RLS | `ycbwgnihbrqammkgngum` | `user-supabase-msa-rls` |
| 11 | Matrix Comms | `ujowkipnqgtazmtdsnlm` | — |

### P2 — operational / widely used

| # | System | Project ref | MCP namespace (if any) |
|---|--------|-------------|------------------------|
| 12 | ITSM | `irjrcskfcyierdbefrpk` | `user-supabase-itsm` |
| 13 | Atlas MLS app DB | `wckwfbbqiupvallmhqbu` | `user-supabase-atlas-mls` |
| 14 | Digital Employees | `mihslqjjclbrqelnjjpb` | — |
| 15 | Analytics + Stardom | `wjsafhylqujwbpqgjjlj` | — (shared app DB) |
| 16 | Client Connect | `jnmssbsjhsoyyxuxxzop` | — |
| 17 | Meeting Hub | `hefqrtlmxwvvtximsvsy` | — |

### P3 — legacy / staging (in scope, last)

| System | Project ref | Notes |
|--------|-------------|-------|
| Pipeline v1 (legacy) | `mydojctcewxrbwjckuyz` | Legacy integrations only |
| CY SPA staging | `rlfxsieleseimylumhwc` | Staging |
| HRMS Sandbox 3.0 | `xyvkeefqxabfcptiyoxm` | Audit only if it holds prod-like PII |

### Out of scope (small / non-prod)

Templates (`matrix-apps-template-2-1` / `2-2`), CDL Studio (read-only inspector),
Lovable Source `ibqheiuakfjoznqzrpfe`, cleanup candidates
`tiuansahlsgautkjsajk`, `iooyncgcumgecznfpnsk`, `hxbzyfadhwzlvfjgqase`
(see [references/index.md](../references/index.md)).

### Non-Supabase (short weekly spot-check)

- Intranet Apache + `github-watcher` (named-but-missing webhook secret = unverified deploy).
- Nyx TLS / uptime (already automated).
- Databricks warehouse (do not leave awake on shallow probes).
- Azure AD / Graph sync surfaces.
- Twilio (Comms).

## Procedure — per project

1. **Security Advisors** via MCP `get_advisors` (`type: security`) or Management API / CLI.
2. **Matrix SQL** (read-only) — run via MCP `execute_sql` or SQL editor.
3. **Storage** — list buckets; flag public buckets that allow listing.
4. **Edge Functions** — list functions; confirm `verify_jwt=false` only where in-code SSO JWT verify exists.
5. Record ERROR / WARN counts; link remediation URLs from Advisor output.
6. Compare to known backlog in [security-model.md](security-model.md) (S1–S4, H1–H5, C7/C8).
7. **Do not remediate production in the same pass** unless explicitly approved — report first.

### Matrix SQL checklist

**TRUNCATE drift** (expect 0 rows for `anon` / `authenticated`):

```sql
SELECT grantee, count(*) AS n
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND privilege_type = 'TRUNCATE'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee;
```

**Anon DML grants on public tables** (investigate non-intentional grants):

```sql
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
ORDER BY table_name, privilege_type;
```

**Permissive policies** (`USING (true)` / `WITH CHECK (true)` for anon or public):

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual ILIKE '%true%'
    OR with_check ILIKE '%true%'
  )
ORDER BY tablename, policyname;
```

Interpret `qual = 'true'` carefully: intentional `TO authenticated` catalog reads differ from `{public}` / `{anon}` + GRANT. See security-model § Anon GRANT vs RLS.

### Auth / EF spot-checks (sample each week; deep-dive P0)

| Check | Where | Known backlog |
|-------|-------|---------------|
| Leaked password protection | Dashboard → Auth → Security | **S4** |
| JWT signing keys (ES256 current) | SSO project JWT settings | **H1** |
| Third-Party Auth registered on app DBs | SSO Console / Management API | ADR-027 |
| EF `verify_jwt` vs in-code verify | `config.toml` + function source | Platform convention: SSO-compatible EFs use `--no-verify-jwt` + in-code verify |

## Report template

Save dated reports under [`security-audits/`](security-audits/) as `YYYY-MM-DD.md`.

```markdown
# Security audit — YYYY-MM-DD

## Summary
| Priority | Project | Ref | ERROR | WARN | INFO | Notes |
|----------|---------|-----|-------|------|------|-------|
| P0 | SSO | xgub… | n | n | n | |

## New HIGH (propose for security-model backlog)
| ID | Project | Finding | Remediation |

## Accepted / known (no change)
| ID | Finding | Why accepted |

## Matrix SQL
| Project | Truncate anon/auth | Anon DML | Notes |

## Non-Supabase
- …
```

Promote new **HIGH** items into [security-model.md](security-model.md) § Security Hardening Backlog. Do not silently “fix” without a migration + ownership.

## Automation (optional, after baseline)

1. GitHub Action or VM cron: loop project refs → `GET …/advisors/security` with PAT from vault (`sso_supabase_management_pat` — never commit the value).
2. Fail / alert only on **new** ERROR vs last snapshot (diff cache keys / lint names).
3. Keep weekly human review for Matrix SQL + Auth/EF.

## Dated reports

| Date | Report |
|------|--------|
| 2026-08-25 | [security-audits/2026-08-25.md](security-audits/2026-08-25.md) — first baseline |

## Related

| Doc | Role |
|-----|------|
| [security-model.md](security-model.md) | Model + backlog |
| [compliance.md](compliance.md) | GDPR / breach |
| [app-catalog.md](app-catalog.md) | App inventory |
| [references/index.md](../references/index.md) | Project refs / cleanup |
| [alignment-audit-playbook.md](alignment-audit-playbook.md) | Schema↔code drift (different concern) |
