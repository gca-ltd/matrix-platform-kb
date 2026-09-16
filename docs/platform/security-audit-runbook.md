# Security Audit Runbook — Weekly Infosec Review

> Operational playbook for the **weekly** Sharp Matrix infosec audit across
> the **agreed standing contour** of Supabase projects.
>
> **Companion docs:** [security-model.md](security-model.md) (RLS patterns +
> hardening backlog), [compliance.md](compliance.md) (GDPR / breach),
> [operations.md](operations.md) (deploy / DR). This runbook is **not** the
> schema↔code drift playbook — that is [alignment-audit-playbook.md](alignment-audit-playbook.md).
>
> Contour agreed with leadership **2026-09-16**: public sites + SSO + HR/finance/
> IT + CRM/sales + Comms/AI + catalog (incl. **CDL**). Task Manager HU project
> deleted. Skip full Matrix SQL when a project fingerprint is unchanged.

## Cadence

| Layer | Frequency | What | Cost |
|-------|-----------|------|------|
| **Advisors (all in-scope reachable)** | Weekly (mandatory) | Security Advisor ERROR/WARN fingerprints per project | **$0** |
| **Matrix SQL + Auth/EF** | Weekly **only if fingerprint changed**, or always for **HU Storefront** | Truncate / anon DML / permissive policies / anon SECDEF | **$0** scan |
| **Full baseline** | When contour changes, or after a major remediations wave | Advisors + Matrix SQL on every reachable project | One-off |
| **Remediation** | Separate eng work after report (except explicitly approved prod fixes) | Migrations / EF / Auth toggles | Eng time |

There is **no** native Supabase “email me a daily security report”. Advisors catch
`rls_disabled_in_public` (the email class that fired for HU `conversion_sync_log`
on 2026-09-13). Matrix SQL catches what Advisors miss (TRUNCATE, anon GRANT +
`USING(true)`, anon SECDEF mutators).

**Do not** enable noisy daily cron until accepted risks are documented.

## Efficient weekly loop (skip-unchanged)

```
1. Advisors on every reachable in-scope project
2. Build fingerprint: ERROR lint names + public table count + pg_default_acl
   summary (anon write bits) for projects that support Matrix SQL
3. Compare to last dated report under security-audits/
4. Full Matrix SQL + Auth/EF only if fingerprint ≠ last OR project is HU Storefront
5. Report: delta + open backlog. Say explicitly which projects were skipped as unchanged
```

**Why HU always full:** public internet; Advisors miss anon GRANT + `USING(true)`
on intentional form tables and on share/counter policies (S15 class).

**This pass exception:** when the standing contour itself changes, run a **full
baseline** once; skip-unchanged starts on the *next* weekly cycle.

## Built-in Supabase capabilities

| Surface | How | Notes |
|---------|-----|-------|
| Dashboard | `Database → Security Advisor` / `Performance Advisor` | Runs automatically; manual rerun after fixes |
| MCP | `get_advisors` with `type: security` \| `performance` | Per-project Supabase MCP in Cursor |
| Management API | `GET /v1/projects/{ref}/advisors/security` (and `/performance`) | PAT needs `advisors_read` |
| CLI | `supabase db advisors --type security --linked` | Same remote API |

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
4. JWT key posture, Edge Function `verify_jwt` vs in-code SSO verify, secrets in frontend.

Weekly full pass on a changed project = **Advisors + Matrix SQL + Auth/EF**.

## Standing contour (priority order)

Priority: blast radius → data sensitivity (PII / money / HR) → public internet → usage.

Agreed with leadership 2026-09-16. **CDL is in scope** (catalog feeding sites /
Atlas / CRM). **Task Manager HU** (`rwgfixcfgviaqonhhqev`) — **deleted**, do not audit.

### P0 — public internet + platform identity + catalog

| # | System | Project ref | MCP / notes |
|---|--------|-------------|-------------|
| 1 | HU Storefront — **prod** `sothebys-realty.hu` | `bpaxqtxaysolzaeguwvg` | `user-supabase-hu-website` — **standing weekly deep-dive** (always full Matrix SQL) |
| 2 | CY Web Site | `yugymdytplmalumtmyct` | `user-supabase-cy-website` |
| 3 | Matrix SSO (incl. SSO Console UI) | `xgubaguglsnokjyudgvc` | `user-supabase-sso` |
| 4 | Matrix CDL | `ofzcokolkeejgqfjaszq` | `user-supabase-cdl` |

### P1 — HR / finance / IT + CRM / sales + messaging

| # | System | Project ref | MCP / notes |
|---|--------|-------------|-------------|
| 5 | HRMS | `wltuhltnwhudgkkdsvsr` | `user-supabase-hrms` — standing deep-dive (HR PII + **S19**) |
| 6 | Vacations Management | `kposeyhvgusosuzjjrdv` | — |
| 7 | Career Connect | `zsjwbspjlpaxfadjeymd` | — |
| 8 | Matrix FM | `retujkznogwplfrbniet` | — |
| 9 | ITSM | `irjrcskfcyierdbefrpk` | `user-supabase-itsm` |
| 10 | Pipeline 2.0 | `kzvhqgpedapzqmwgikrw` | `user-supabase-pipeline-2-0` |
| 11 | MSA CY | `rpoeezssicpzexarmwqq` | `user-supabase-msa` |
| 12 | MSA Hungary | `ykgyzqnuqpwasxvesxva` | `user-supabase-msa-hungary` |
| 13 | Qobrix RLS | `ycbwgnihbrqammkgngum` | `user-supabase-msa-rls` |
| 14 | matrix-lead-generator | `ddairradcxczsvwntwmw` | — |
| 15 | Matrix Comms | `ujowkipnqgtazmtdsnlm` | — |
| 16 | Analytics + Stardom (shared DB) | `wjsafhylqujwbpqgjjlj` | — |

### P2 — catalog ops + analytics plane

| # | System | Project ref | MCP / notes |
|---|--------|-------------|-------------|
| 17 | Atlas MLS app DB | `wckwfbbqiupvallmhqbu` | `user-supabase-atlas-mls` |
| 18 | Datacore | `zcajghoohycimpubufsy` | `user-supabase-datacore` |

### In contour — coverage gap (second Supabase org)

Still **in standing scope**; report as “could not audit” until PAT/MCP access exists.
Do **not** drop them from the contour just because Advisors return 403.

| System | Ref | Notes |
|--------|-----|-------|
| Client Connect | `jnmssbsjhsoyyxuxxzop` | Registration of contacts |
| Meeting Hub | `hefqrtlmxwvvtximsvsy` | Meeting registration |
| Digital Employees | `mihslqjjclbrqelnjjpb` | AI Agents; try Lovable MCP `user-lovable-mde` when Management API 403 |

Management API PAT (`~/.supabase/access-token`) currently reaches org
`iipqkbmihgjxngwqjvzd` only.

## Out of standing weekly contour

| Item | Why out |
|------|---------|
| Task Manager HU (`rwg…`) | **Deleted** (confirmed 2026-09-16) |
| Performance Dashboard | Not in leadership list |
| Pipeline v1 | Legacy; not in leadership list |
| HRMS Sandbox / MSA Hungary sandbox | Not standing; one-off if prod-like PII suspected |
| CY SPA staging | Second org + not in leadership list |
| Templates, CDL Studio, Lovable Source | Non-prod / read-only |
| Dangling / personal Supabase projects | **One-off cleanup inventory**, not weekly |
| github-watcher / Nyx / Databricks / Twilio / Azure AD | Not mandatory weekly; optional spot-check |

### One-off dangling inventory (not weekly)

Refs historically noted for cleanup — check alive/traffic when contour changes or
on request: `tiuansahlsgautkjsajk`, `iooyncgcumgecznfpnsk`, `hxbzyfadhwzlvfjgqase`,
Lovable Source `ibqheiuakfjoznqzrpfe` (see [references/index.md](../references/index.md)).

## Procedure — per project

1. **Security Advisors** via MCP `get_advisors` (`type: security`) or Management API / CLI.
2. If skip-unchanged says skip → record “unchanged vs YYYY-MM-DD” and stop.
3. **Matrix SQL** (read-only) — MCP `execute_sql` or SQL editor.
4. **Storage** — list buckets; flag public buckets that allow listing.
5. **Edge Functions** — list; confirm `verify_jwt=false` only where in-code SSO verify exists.
6. Record ERROR / WARN; compare to [security-model.md](security-model.md) backlog.
7. **Do not remediate production in the same pass** unless explicitly approved
   (exception documented in dated report — e.g. HU **S18+S16** on 2026-09-16).

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

**Anon EXECUTE on SECURITY DEFINER functions** (S8 / S19 class):

```sql
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY p.proname;
```

Flag admin/mutation RPCs for `REVOKE` from `PUBLIC, anon`.

**Default ACL fingerprint** (catches next Lovable table before Advisors email):

```sql
SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
FROM pg_default_acl
WHERE defaclnamespace = 'public'::regnamespace OR defaclnamespace = 0;
```

### Auth / EF spot-checks (sample each week; deep-dive HU + HRMS)

| Check | Where | Known backlog |
|-------|-------|---------------|
| HU Storefront forms + journal + default ACL | Always full Matrix SQL | **S15/S17** open; **S16/S18** closed 2026-09-16 |
| HRMS anon SECDEF mutators | Matrix SQL + function body | **S19** |
| Leaked password protection | Auth → Security | **S4** |
| JWT signing keys (ES256 current) | SSO JWT settings | **H1** |
| EF `verify_jwt` vs in-code verify | `config.toml` + source | SSO-compatible EFs: `--no-verify-jwt` + in-code verify |

## Report template

Save dated reports under [`security-audits/`](security-audits/) as `YYYY-MM-DD.md`
(+ optional `YYYY-MM-DD-ru.md` for leadership).

```markdown
# Security audit — YYYY-MM-DD

## Contour
Standing list from runbook; note skip-unchanged vs prior report.

## Summary
| Priority | Project | Ref | ERROR | WARN | Full SQL? | Notes |
|----------|---------|-----|-------|------|-----------|-------|

## New HIGH (propose for security-model backlog)
| ID | Project | Finding | Remediation |

## Accepted / known (no change)
| ID | Finding | Why accepted |

## Remediations this pass (if any — must be pre-approved)
| ID | What landed | Verify |

## Coverage gap
…
```

Promote new **HIGH** items into [security-model.md](security-model.md) § Security Hardening Backlog.

## Automation (optional, after baseline)

1. Cron / Action: loop standing refs → Advisors; alert only on **new** ERROR vs last snapshot.
2. Keep weekly human review for Matrix SQL on changed + HU + HRMS.

## Dated reports

| Date | Report |
|------|--------|
| 2026-08-25 | [security-audits/2026-08-25.md](security-audits/2026-08-25.md) — first baseline |
| 2026-09-01 | [security-audits/2026-09-01.md](security-audits/2026-09-01.md) — 22 projects + remediations; [RU](security-audits/2026-09-01-ru.md) |
| 2026-09-15 | [security-audits/2026-09-15.md](security-audits/2026-09-15.md) — 23 projects scan-only; HU S18; [RU](security-audits/2026-09-15-ru.md) |
| 2026-09-16 | [security-audits/2026-09-16.md](security-audits/2026-09-16.md) — new standing contour baseline + HU S18/S16; [RU](security-audits/2026-09-16-ru.md) |

## Related

| Doc | Role |
|-----|------|
| [security-model.md](security-model.md) | Model + backlog |
| [compliance.md](compliance.md) | GDPR / breach |
| [app-catalog.md](app-catalog.md) | App inventory |
| [references/index.md](../references/index.md) | Project refs / cleanup |
| [alignment-audit-playbook.md](alignment-audit-playbook.md) | Schema↔code drift (different concern) |
