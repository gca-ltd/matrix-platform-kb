---
name: v1.0.0
version: 1.0.0
date: 2026-08-17
---

# Release notes — matrix-platform-kb

**Repo:** [`sharpsir-group/matrix-platform-kb`](https://github.com/sharpsir-group/matrix-platform-kb)  
**Version trail:** GitHub Releases/tags `vX.Y.Z` + this file + [`VERSION`](VERSION).
**Agent rules:** [`AGENTS.md`](AGENTS.md) § Release notes & versioning.

## Unreleased — 2026-08-24

- **MSA staging portal access**: Agency Portal now shows **Matrix Sales Automation** → `/msa-staging-main/` for Sharp SIR Broker, Senior Broker, Area Manager, Team Leader, Sales Manager, Sales Director, Call Centre, and CORE Team (`20260824110000_msa_staging_main_portal_and_sales_access.sql`). Documented in `app-catalog.md` + `security-model.md`.
- **MSA team-membership prerequisite**: document that JWT `team_ids` / `owner_team_id` stamping require `sso_user_group_memberships` (one group per broker; multi-office OK for managers); correct live holder counts to `user_role_assignments` ∩ `auth.users`; note per-office backfill + `display_order` 33 (`20260824123000_msa_staging_team_membership_backfill.sql`).

## Unreleased — 2026-08-22

- **Vanilla chat baseline (DE)**: removed `system_directives` / System tab; Playground prompt is operator fields only. ADR-041 trimmed to single-path MCP routing; Qobrix stays `oauth_user`.

## Unreleased — 2026-08-21

- **ADR-039 / ADR-040**: MCP platform reference is now the Qobrix CRM stack (modes A–D, RS/AS split); Digital Employees client contract documented. ADR-032 and ADR-038 marked Obsolete as platform MCP references. Rewrote `docs/platform/matrix-mcp-server.md` and added `docs/platform/mcp-client.md`.

## Unreleased — 2026-08-20

- **One KB repo:** cite as `sharpsir-group/matrix-platform-kb` (ecosystem convention); physical home remains `gca-ltd` during the org migration. Documented anti-doubling guard in `AGENTS.md` — never create a repo at the old `sharpsir-group` or `gca-global` paths.

## Unreleased — 2026-08-19

- **RLS wave 2 KB:** `security-model.md` — resolved S3, partial H5, new anon-GRANT defect class + C7; `cdl-schema.md` — wave 2E Groups B/C/D; `cdl-crud-contract.md` — READ-A now authenticated-only on `properties`/`property_media`.

- GitHub org renamed `gca-global` → `gca-ltd`. Repo, raw-URL and push references updated across `AGENTS.md`, `README.md`, `app-catalog.md`, `app-template.md`, `ADR-038.md` and the Zoe tech reference. Old URLs still redirect.

## Unreleased — 2026-08-18

- Catalogued Digital Employees (`gca-global/matrix-digital-employees`) as a github-watcher SPA at `/digital-employees/`.

- Documented that the template's GitHub Actions `deploy.yml` (rsync) is unused and disabled platform-wide, with the re-disable step for new remixes, in `docs/platform/app-template.md`.

## Unreleased — 2026-08-17

- Documented stale-bundle detection (`useAppVersionPoller`: poll `index.html` via `import.meta.env.BASE_URL`, sonner Reload toast) in `docs/platform/app-template.md`, with adoption status as of 2026-08-18.

- Design system: expanded mobile chrome / FAB clearance contract in `docs/platform/app-template.md` (transparency stack, SidebarLayout class strings, `pb-safe-content` ↔ `.bottom-safe-fab` distance formula).

- Documented floored safe-area gutter variants (`.px-safe-4` / `.px-safe-6` / `.pb-safe-6`) in `docs/platform/app-template.md` — bare `.px-safe` overrides Tailwind `px-N` on non-notched viewports.

- Documented mobile `/menu` navigation + safe-area / theme-color / document-scroll contract in `docs/platform/app-template.md` (adoption status as of 2026-08-17).
- Documented Cyprus Area Manager team coverage via SSO group **CSIR Sales** (scope stays `team`; `oauth-token` honours `active_role_id` on login).
- Dropped remaining third-party AI vendor names from ADR-032 / ADR-038 status lines.
- Moved the GitHub repo to [`gca-global/matrix-platform-kb`](https://github.com/gca-global/matrix-platform-kb). The previous `sharpsir-group/matrix-platform-kb` URL permanently redirects.
- **ADR-038**: ITSM is ES256-only (SSO PostgREST bearer + MCP access-token issuer). Supersedes ADR-032 for the MCP HMAC signing algorithm only; chat-agent/OAuth design stands. Corrects `security-model.md` hybrid table (ITSM already on TPA; remaining HS256 apps are FM / Meeting Hub, etc.).
- Agent release-notes & versioning policy aligned with `matrix-itsm` (SemVer, day-batch PATCH, `scripts/release.sh`).
- Removed third-party AI vendor brand names from chat/AI surfaces; those docs now refer to a generic chat agent / website AI chat.
- Proprietary copyright notice (Sharp SIR + GCA Global) added at agent entry points (`LICENSE`, `AGENTS.md`, `README.md`, `docs/index.md`, `docs/platform/kb-methodology.md`).

## v1.0.0 — 2026-08-17 — Baseline Matrix Platform Knowledge Base

First tracked release. Retrospective baseline snapshot — later tags are deltas from this commit.
