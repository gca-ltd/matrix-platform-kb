# Sharp Matrix Platform — Agent Knowledge Map

> Table of contents for the Sharp Matrix Platform knowledge base.
> Deliberately short: each pointer leads to a deeper source of truth.
> Read this first, then navigate to the relevant chapter.

## Copyright — proprietary corporate knowledge base

**© 2024–2026 Sharp Sotheby's International Realty and GCA Global. All rights reserved.**

This repository is a **proprietary corporate knowledge base**. It is made technically available so that authorized AI agents (Cursor, Lovable, and similar) acting for Sharp or GCA Global can read it while building and operating Sharp Matrix. It is **not** intended to be read or used by anyone unaffiliated with Sharp or GCA Global.

If you are not working for Sharp or GCA Global, you are **not authorized** to read, copy, reproduce, or use this repository in any form — even if you have technical access (clone, URL, fork, or index). All contents are proprietary and protected by applicable intellectual property laws. See [`LICENSE`](LICENSE).

Authorized agents: you **may** read and use this knowledge base solely to assist Sharp / GCA Global personnel on Sharp Matrix work.

## Platform Identity

**Sharp Matrix** is the **technology platform** powering **Sharp SIR** (Sharp Sotheby's International Realty), a luxury real estate brokerage and SIR-network affiliate currently operating in **Cyprus**, **Hungary**, and **Kazakhstan** (more markets planned). Four module families share the CDL: **CRM** (`matrix-pipeline`, `matrix-comms`, `matrix-client-connect`), **FM** (financial-entries, commissions, deal closings), **HR** (`matrix-hrms`), **MLS** (`matrix-atlas-mls`, `matrix-mls-2-0`, `matrix-cy-website`).

**Built with**: Lovable + Supabase (CDL / system of record) + Databricks (DWH / ETL).
**Practical data model**: RESO DD 2.0 in storage (snake_case canonical names); Dash names projected via `v_dash_*` views.

## One Knowledge Base repo (do not double)

There is **exactly one** Matrix Platform KB repository. Cite it as
[`sharpsir-group/matrix-platform-kb`](https://github.com/sharpsir-group/matrix-platform-kb)
everywhere (docs, raw.githubusercontent.com URLs, code comments). During the org
migration the repo's **physical** GitHub home is `gca-ltd/matrix-platform-kb`;
`sharpsir-group/…` and `gca-global/…` are rename redirects onto that same repo.

- **Never** create a second repo at `sharpsir-group/matrix-platform-kb` or
  `gca-global/matrix-platform-kb` — that would shadow the redirect and break every
  citation across the ecosystem.
- **Never** clone a second KB tree beside `/home/bitnami/matrix-platform-kb`.
- **Git push / clone remotes** may use `gca-ltd/matrix-platform-kb` (the real path)
  so pushes do not depend on a redirect. Citation form stays `sharpsir-group`.

## For LLMs — Start Here

Before building or modifying any Matrix App:

1. Read `docs/platform/app-template.md` — dual-Supabase, SSO auth, permissions, RLS, UI patterns, token architecture, MLS ingestion, cross-project user display.
2. Determine app type:
   - **CDL-Connected** (listings, contacts, agents, showings) → also read `docs/data-models/cdl-schema.md`, `docs/data-models/dash-data-model.md`, `docs/platform/security-model.md`.
   - **Domain-Specific** (own domain — HR, finance, IT ops) → also read the relevant example repo (see Source Repos below).
3. Read relevant business processes from `docs/business-processes/`.

For the canonical RESO DD 2.0 model (any field, lookup, or FK question), start at `docs/data-models/reso-dd-kb/USAGE.md`. When editing inside that subtree, read its local rules at `docs/data-models/reso-dd-kb/AGENTS.md`.

For new-app auth issues (401/400/403), see `docs/platform/new-app-auth-troubleshooting.md`.

## Subsystem AGENTS.md (local rules)

| Subtree | Local rules |
|---------|-------------|
| `docs/data-models/reso-dd-kb/` | `docs/data-models/reso-dd-kb/AGENTS.md` — phase boundaries, file ownership, mirror politeness, determinism, verification gates |
| `docs/data-models/source-mappings/` | `docs/data-models/source-mappings/AGENTS.md` — phase boundaries, file ownership, hard-fail join gates, determinism |
| `docs/business-processes/canonical-processes/` | `docs/business-processes/canonical-processes/AGENTS.md` — phase boundaries, citation contract, mermaid contract, 5 hard-fail gates |
| `docs/integration/` | `docs/integration/AGENTS.md` — generated per-resource cross-cutting views joining Layers 1–4; emit-only, no hand-edits under `wiki/agent-docs/` |
| `docs/product-specs/matrix-pipeline/` | `docs/product-specs/matrix-pipeline/AGENTS.md` — `matrix-pipeline` CRM LLM Wiki (Karpathy 3-layer pattern): immutable `raw/context-v2.md` BRD + 8 wiki pages + schema layer + `phases.md` 8-week build plan + `roadmap.md` outcome-based coordination surface; `scripts/wiki-lint.sh` enforces frontmatter / orphan-anchors / FR-coverage / split-rule / log-format contracts. **When working on `matrix-pipeline` KB content, follow the coordination protocol in `docs/product-specs/matrix-pipeline/AGENTS.md` (§"Coordination through roadmap.md") — update `roadmap.md` + append a `roadmap` log entry on any structural change (FR / ADR / migration / EF / wiki page).** |

## Knowledge Base Structure

```
AGENTS.md                              ← This file (TOC)
README.md
LICENSE                                ← Proprietary copyright; restricted to Sharp & GCA Global
docs/                                   ← KB knowledge layer (system of record)
├── index.md                           ← Master KB index (start here)
├── platform/                          ← App template, security, ops, compliance, app-catalog, ecosystem, golden-principles
├── architecture/                      ← overview.md, intelligence layer, data distribution, ADRs
├── data-models/
│   ├── index.md                       ← Data models chapter index (Dash-first hierarchy)
│   ├── dash-data-model.md             ← Dash/Anywhere.com practical field reference
│   ├── reso-dd-kb/                    ← CANONICAL RESO DD 2.0 — start at USAGE.md
│   ├── source-mappings/               ← Dash/Qobrix/SIR -> RESO mapping pipeline
│   ├── cdl-schema.md                  ← Common Data Layer (cross-app data, MLS Sync, lifecycle)
│   ├── etl-pipeline.md                ← Bronze/Silver/Gold ETL
│   ├── property-field-mapping.md      ← Dash ↔ RESO ↔ Qobrix ↔ SIR
│   ├── platform-extensions.md         ← x_* fields not in Dash or RESO DD
│   └── …
├── business-processes/                ← Canonical RESO-aligned process catalogue (vendor-neutral)
│   └── canonical-processes/           ← 10 RESO state machines (system of record)
├── integration/                       ← Layer 5: overview.md + per-resource cross-cutting views (generated)
├── product-specs/
│   ├── matrix-pipeline/               ← SINGLE SOURCE OF TRUTH for CRM (LLM Wiki + BRD + phases)
│   ├── client-portal.md, marketing-platform.md, sir-listing-forms.md, personalization.md
│   └── index.md
├── exec-plans/                        ← index.md, quality-score.md, tech-debt-tracker, active/completed plans
├── references/                        ← API catalogs, integration endpoints
├── vision/                            ← Digital strategy 2026-2028, AI sales model
└── zoe-ai-assistant-kb/               ← Zoe AI Assistant RAG knowledge base + ai-chat-webhook-spec.md
raw/                                    ← Hand-supplied source artifacts
├── dash/                              ← 6 SIR DOCX listing forms
├── qobrix/qobrix_openapi.yaml         ← Qobrix OpenAPI 3.0 spec
├── vision/                            ← Strategy PDFs + ecosystem MMD
└── current-business-practice/         ← Listing checklists (XLSX)
scripts/
└── validate-kb.sh                     ← Mechanical KB validation
```

## Quick Navigation by Task

| If you need to… | Read this |
|---|---|
| Build a new Matrix App (start here) | `docs/platform/app-template.md` |
| Platform / ecosystem / app catalog | `docs/platform/index.md`, `docs/platform/ecosystem-architecture.md`, `docs/platform/app-catalog.md` |
| Strategy, design philosophy, architecture | `docs/vision/digital-strategy-2026-2028.md`, `docs/vision/core-beliefs.md`, `docs/architecture/overview.md` |
| Look up any RESO DD 2.0 resource / field / lookup | `docs/data-models/reso-dd-kb/USAGE.md` |
| When editing inside reso-dd-kb (local rules) | `docs/data-models/reso-dd-kb/AGENTS.md` |
| Canonical RESO DBML / per-resource reference | `docs/data-models/reso-dd-kb/wiki/dbml/canonical.dbml`, `docs/data-models/reso-dd-kb/wiki/agent-docs/resources/<snake>.md` |
| Map a Dash / Qobrix / SIR field to RESO | `docs/data-models/source-mappings/USAGE.md` |
| When editing source-mappings (local rules) | `docs/data-models/source-mappings/AGENTS.md` |
| Look up canonical RESO-aligned MLS process | `docs/business-processes/canonical-processes/USAGE.md` |
| When editing canonical-processes (local rules) | `docs/business-processes/canonical-processes/AGENTS.md` |
| Understand how the three layers compose (data → mapping → canonical process) | `docs/integration/overview.md` |
| Get a one-stop view of "everything about resource X" | `docs/integration/wiki/agent-docs/by_resource/<resource>.md` (start at `docs/integration/wiki/agent-docs/_index.md`) |
| When editing integration/ (local rules) | `docs/integration/AGENTS.md` |
| Dash fields, field mapping, x_* extensions | `docs/data-models/dash-data-model.md`, `docs/data-models/property-field-mapping.md`, `docs/data-models/platform-extensions.md` |
| CDL schema / ETL pipeline / RESO Web API | `docs/data-models/cdl-schema.md`, `docs/data-models/etl-pipeline.md`, `docs/data-models/reso-web-api.md` |
| Auth, roles, permissions, RLS | `docs/platform/security-model.md` |
| Serve a mirror / cache / materialised view on a **user** read path (who may see it?) | `docs/platform/security-model.md` § "Anti-pattern: a service-harvested cache on a user read path" — **read before repointing any list off its authoritative source** |
| Weekly infosec audit (Advisors + Matrix SQL) | `docs/platform/security-audit-runbook.md` |
| ES256 JWT (ADR-011), SSO/CDL Third-Party Auth (ADR-012) | `docs/architecture/decisions/` |
| SSO Edge Function API contracts | `docs/platform/sso-edge-functions.md`, `docs/platform/api-contracts.md` |
| Deploy / operate / perf / mobile / test | `docs/platform/operations.md`, `docs/platform/performance.md`, `docs/platform/mobile-strategy.md`, `docs/platform/testing-strategy.md` |
| Phase-2 AI / Phase-2.5 stewardship roadmaps | `docs/architecture/intelligence-layer.md`, `docs/architecture/data-distribution-and-stewardship.md` |
| Alignment audit / drift / KB methodology | `docs/platform/alignment-audit-playbook.md`, `docs/platform/kb-methodology.md` |
| GDPR, data retention, DSARs | `docs/platform/compliance.md` |
| Engineering invariants, quality grades, exec plans, tech debt | `docs/platform/golden-principles.md`, `docs/exec-plans/quality-score.md`, `docs/exec-plans/index.md`, `docs/exec-plans/tech-debt-tracker.md` |
| Validate KB structure and links | `scripts/validate-kb.sh` |
| Listing / sales / lead-qual / showing / transaction workflow | `docs/business-processes/canonical-processes/USAGE.md` (canonical, RESO-aligned) |
| Build the `matrix-pipeline` CRM (BRD, entities, FRs, AI, Commission Engine, 8-week plan, CDL CRUD contract) | `docs/product-specs/matrix-pipeline/INDEX.md` (start here), then `docs/product-specs/matrix-pipeline/wiki/<page>.md` + `phases.md` + `cdl-crud-contract.md` |
| Listing form fields, Portal, Marketing, Personalization specs | `docs/product-specs/sir-listing-forms.md`, `docs/product-specs/client-portal.md`, `docs/product-specs/marketing-platform.md`, `docs/product-specs/personalization.md` |
| Qobrix API reference | `docs/references/qobrix-api-summary.md` |
| New app can't auth (401/400/403) | `docs/platform/new-app-auth-troubleshooting.md` |

## For Zoe AI Assistant (1st & 2nd Line Support)

Start at `docs/zoe-ai-assistant-kb/index.md`. For end-user questions, navigate to the relevant app article (`portal.md`, `client-connect.md`, `pipeline.md`, `hrms.md`, `itsm.md`, `financial-management.md`, `comms.md`, `meeting-hub.md`, `platform-sso-auth.md`). For 2nd-line technical questions, see `docs/zoe-ai-assistant-kb/second-line-tech-reference.md`. To author a new article, follow `docs/zoe-ai-assistant-kb/kb-generation-guide.md`. The website AI chat lead-webhook contract lives at `docs/zoe-ai-assistant-kb/ai-chat-webhook-spec.md`.

## Source Repos & Files

| Repo / File | Format | Contents |
|---|---|---|
| `/home/bitnami/matrix-apps-template-2-1` | React/TS | **Canonical** app template — dual-Supabase, SSO, permissions, RLS, UI. (The prior `matrix-apps-template` is obsolete — do not use.) |
| `/home/bitnami/matrix-hrms` | React/TS | HRMS app (Domain-Specific) |
| `/home/bitnami/matrix-pipeline` | React/TS | Pipeline CRM (CDL-Connected) |
| `/home/bitnami/matrix-itsm` | React/TS | ITSM (Domain-Specific) — [`gca-ltd/matrix-itsm`](https://github.com/gca-ltd/matrix-itsm) |
| `/home/bitnami/matrix-fm` | React/TS | Financial Management (Domain-Specific) |
| `/home/bitnami/matrix-mls` | React/TS | MLS Listing Management (CDL-Connected) — Cursor-managed, see ADR-013 |
| `/home/bitnami/matrix-atlas-mls` | React/TS | Atlas — MLS Sync admin & Listings Search (CDL-Connected) |
| `/home/bitnami/mls_2_0` | Python/FastAPI | MLS 2.0 pipeline: Databricks ETL + RESO Web API |
| `raw/vision/Sharp-Sothebys-International-Realty.pdf` | PDF | 28-slide digital strategy 2026-2028 |
| `raw/vision/Sarp SIR Platform-2026-02-18-125014.mmd` | Mermaid | Platform ecosystem architecture diagram |
| `raw/vision/AI-driven-model-upravleniya-prodazhami.pdf` | PDF | 16-slide AI-driven sales model |
| `raw/qobrix/qobrix_openapi.yaml` | YAML | Full Qobrix OpenAPI 3.0 spec |
| `docs/data-models/reso-dd-kb/` | Markdown + CSV + DBML | Canonical RESO DD 2.0 (41 resources, 1,745 fields, 222 lookups). Start at `USAGE.md`. |
| `raw/dash/BlankForm_*.docx` | DOCX | SIR/Anywhere.com listing forms (6 types) |
| `raw/current-business-practice/*.xlsx` | XLSX | Listing checklists 2024–2026 |

## Release notes & versioning (Cursor + any agent)

Ship changes to `main` freely during the day.
**Do not** cut a new `vX.Y.Z` tag / GitHub Release for every mid-day fix.
Version and publish **once per cadence** as below — SemVer with a day-batch default.
Same convention as `matrix-itsm` / `matrix-sales-automation`.

Docs-only repo; version tracked in VERSION + RELEASE_NOTES.md.

| Surface | Rule |
|---------|------|
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | Keep an `## Unreleased — YYYY-MM-DD` section at the top while work is in flight. Append bullets as you ship (**why** + user/ops-visible effect). At cut time, rename that section to `## vX.Y.Z — YYYY-MM-DD — <title>` (newest first). |
| [`VERSION`](VERSION) file (no package.json in this repo) | Bump **only** when cutting a release (same commit as the notes roll-up). |
| GitHub Releases + tags | One annotated tag `vX.Y.Z` + GitHub Release per cut (`.github/workflows/release.yml` on tag push when present). Never retag; never force-move a published tag. |

### Cadence (when to bump)

| Bump | When | Typical trigger |
|------|------|-----------------|
| **PATCH** (`x.y.Z`) | **Default end-of-day cut** | Bug fixes, small docs/UX, scripts accumulated that day. One PATCH per calendar day unless nothing user/ops-visible shipped. |
| **MINOR** (`x.Y.0`) | **Large package built** | Cohesive feature set / noteworthy module. Cut when done; reset PATCH to `0`. |
| **MAJOR** (`X.0.0`) | **Breaking change** | Breaking contracts, public paths, or incompatible ops workflows. Reset MINOR and PATCH to `0`. |

**Baseline:** GitHub `v1.0.0` is the retrospective product baseline. Later tags are deltas from it; never retag `v1.0.0`.

### During the day (agents)

1. Commit + push as usual.
2. Append bullets under `## Unreleased — YYYY-MM-DD` in `RELEASE_NOTES.md` (create the section if missing). Prefer grouping related bullets; do **not** bump version or create a tag yet.
3. Docs-only / pure refactor with no user/ops-visible effect: skip Unreleased unless the change **redefines agent rules** (then note it).

### Cutting a release (EOD PATCH, or immediate MINOR/MAJOR)

1. Ensure `main` is clean and includes everything for the cut (`git fetch` + ff-only if needed).
2. Fold `Unreleased` → `## vX.Y.Z — YYYY-MM-DD — <short title>` with a crisp summary.
3. Bump [`VERSION`](VERSION) to `X.Y.Z` (or run `scripts/release.sh patch|minor|major`).
4. Commit message like `release: vX.Y.Z — <short title>`; push to `main`.
5. Tag + publish:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z — <short title>"
   git push "https://x-access-token:$(gh auth token)@github.com/gca-ltd/matrix-platform-kb.git" vX.Y.Z
   # Prefer .github/workflows/release.yml; fallback:
   # gh release create vX.Y.Z --title "vX.Y.Z — <short title>" --notes-file -
   ```
   Body should mirror the `RELEASE_NOTES.md` section for that version.

Helper: [`scripts/release.sh`](scripts/release.sh) bumps version and folds notes
(still review title, commit, tag, and push yourself).

### Anti-patterns (avoid)

- Mid-day PATCH spam for three small fixes — batch into one EOD PATCH.
- Shipping a large package under a PATCH bump — use MINOR.
- Empty releases (no user/ops-visible / agent-rule change).
- Editing or moving an already-published tag.
