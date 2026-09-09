# Data Distribution & Stewardship Layer

> **Status (Apr 2026)**: Phase-1 foundations **shipped Apr 2026** — see `cdl-mls-sync-full-reso` plan. Three CDL migrations applied (`20260426130000_cdl_full_reso_ingestion.sql`, `20260426140000_cdl_properties_published_perf_indexes.sql`, `20260426141000_cdl_phase2_intelligence_foundation.sql`, `20260426150000_cdl_dash_views.sql`). All 7 `v_dash_*` projection views deployed; `mls-sync` extended for full RESO 8-resource ingestion + locked-fields stewardship; `listings-search` switched to keyset pagination + ETag/Cache-Control + estimated counts. Phase-1 foundations land with the
> [`cdl-mls-sync-full-reso`](../../README.md) plan (`mls_sources.is_internal` + `matrix-internal`
> seed source, `lifecycle_state` columns, `property_lifecycle_events` audit table, `locked_fields jsonb`
> columns, `public.property_field_overrides` audit table, `cdl_lock_field` / `cdl_unlock_field` RPCs,
> `listing-merge` + `genericUpsert` honor locks). Phase-2.5 (the lifecycle EF + distribution engine
> + multi-source merge) is its own follow-up plan.
>
> **Audience**: anyone designing **outbound** data flow from the CDL — channel routing, syndication,
> field overrides, multi-source merge precedence.

---

## What this layer answers

The CDL is the canonical store. Four rules-engine questions sit on top of it:

| Question | Capability | Phase-1 lands | Phase-2.5 builds |
|---|---|---|---|
| "Did we ingest this listing from a feed (legacy CRM, brand network, partner) or did we create it ourselves? Who owns the lifecycle?" | **Source of record & lifecycle** | `mls_sources.kind` (internal / legacy-internal / brand-network / external) + `is_sunsetting` + `sunset_at` + seed sources (`matrix-internal`, `qobrix`, `dash`) + `lifecycle_state` columns + `property_lifecycle_events` audit table | `cdl-listing-lifecycle` EF (state machine + per-market Qobrix→Atlas cutover), Atlas UI for transitions, auto-expire / auto-archive cron |
| "When an agent edits this listing, how do we make sure the next feed sync doesn't overwrite their edit?" | **Field-level overrides (data stewardship)** | `locked_fields jsonb` + `property_field_overrides` audit + `cdl_lock_field` / `cdl_unlock_field` RPCs + merge logic that honors locks | Atlas UI for per-field lock/unlock |
| "Which listings go to which channels (Zillow vs internal site vs HubSpot vs partner portals)?" | **Channel distribution rules** | — (Phase-2.5 only) | `channels` + `channel_distribution_rules` + `channel_listings` + `channel-router` EF + `syndication-fanout` EF |
| "When two feeds have data for the same logical listing, which feed wins per field?" | **Multi-source merge precedence** | — (Phase-2.5 only) | `source_field_priority` + extension to `listing-merge` EF |

The last three are **conceptually a recommendation system on the channel axis** — same idea as user-facing recsys, but about routing data to channels rather than users. The first one (source-of-record) is what makes the others possible: it tells the system whether to merge inbound feed data on top of an existing row or treat the row as authoritative.

---

## 1. Source of record & lifecycle

### Source-of-record taxonomy — four kinds

Every row in `public.properties` is classified by `mls_sources.kind` for the row's `source_id`.

| Kind | Example sources | Who owns the lifecycle | Inbound | Outbound | Sunset? |
|---|---|---|---|---|---|
| **`internal`** | `matrix-internal` (`matrix-pipeline` CRM, Atlas, future broker apps). **Target state** for all Sharp SIR markets. | Sharp Matrix. We create, edit, publish, retire. | `cdl-write` EF — direct writes. **No** feed ingestion. | Primary outbound content; authoritative on `description`, `media`, `marketing_metadata`. Full Draft → PendingReview → Active → Sold lifecycle. Also flows out to Dash via `dash-export`. | No — steady state |
| **`legacy-internal`** | `qobrix` (Cyprus, currently exposed as `mls.sharpsir.group` RESO Web API). Sharp SIR's own data held in a legacy CRM being decommissioned per market as Atlas takes over. HU + KZ have no Phase-1 legacy seed — those offices currently author directly in Anywhere Dash (so they're covered by the `dash` brand-network source). | Sharp Matrix (mediated through legacy CRMs). | `mls-sync` ingests via RESO Web API projection. `lifecycle_state` mirrors RESO `StandardStatus`. | Per channel-distribution rules. Existing rows can stay tagged or be reassigned to `matrix-internal` at cutover. | **Yes** — `is_sunsetting`, `sunset_at` per market |
| **`brand-network`** | **Anywhere Dash (SIR network)** — Sharp Matrix powers an SIR affiliate. **Bidirectional** primary contract. | Shared with sister SIR offices via Anywhere. | Phase-2.5 `dash-import` EF pulls sister-SIR-office listings; normalizes into RESO-keyed CDL tables. | Phase-2.5 `dash-export` EF pushes our internally-sourced `Active` listings back to Anywhere via the `v_dash_*` projection. | No |
| **`external`** | Third-party feeds we ingest from organizations outside Sharp SIR: **real estate developers** (new-build / off-plan inventory), **partner brokerages** (referrals, co-broke), future industry MLS exchanges. | The partner / developer. We're a downstream consumer. | `mls-sync` (or a per-partner ingestion EF) honors `lifecycle_state` from the source. Locked fields prevent overwrites. | Restricted by the partner's terms-of-use (attribution / branding required, may forbid further syndication). The Phase-2.5 channel-distribution engine reads `kind` and per-partner rules to enforce this. | Per partner relationship |

### Hungary MSA — Storefront 2.0 read path

**Status (Sep 2026):** shipped in `gca-ltd/matrix-sales-automation-hungary`.

Hungary broker offices author listings on the public website stack (**Matrix Digital Storefront 2.0 Hungary**, Supabase project `bpaxqtxaysolzaeguwvg`, tables `properties` / `developments`). The **Hungary MSA** broker app does **not** read those rows through CDL or a future `dash-import` leg today. Instead it uses a **deliberate app-layer read contract**:

| Surface | Mechanism | Auth | Direction |
|---|---|---|---|
| Published listings / projects | Browser anon PostgREST to `bpaxqtxaysolzaeguwvg` (`src/integrations/storefront/client.ts`) | Storefront publishable key only — **never** the broker SSO JWT | Read-only |
| Website inquiries → leads | App-DB EF `storefront-leads-ingest` (service role on Storefront, upsert App-DB `leads`) | SSO on invoke | Read Storefront → write App DB |
| Off-market / broker-authored inventory | App-DB `properties` / `projects` with `source` ≠ storefront | SSO + RLS | Read/write App DB |

This is **not** a contradiction of the `brand-network` / `dash` row above for CDL taxonomy: HU offices may eventually land in CDL via `dash-import`, but until that path exists the **broker CRM's catalog source of truth for published inventory is the Storefront project directly**. Matching and Listings merge App-DB off-market cards with a full Storefront catalog snapshot (`storefrontAdapter.ts`).

**Lead path:** Storefront `property_inquiries` → `storefront-leads-ingest` → App-DB `leads.external_storefront_id` (idempotent). Facebook/Zapier uses `zapier-facebook-lead` separately.

**Related:** [ADR-049](decisions/ADR-049.md) (Digital Employees MCP over the same Storefront project); [app-catalog.md § Matrix Sales Automation — Hungary](../platform/app-catalog.md).

For internally-sourced listings, RESO's `StandardStatus` covers public-facing states only (`Active`, `Pending`, `Closed`, `Withdrawn`). The internal workflow needs additional pre-publish stages, so we keep both:

- **`status`** = RESO StandardStatus (what channels see)
- **`lifecycle_state`** = internal workflow state (what Atlas / `matrix-pipeline` users see)

For externally-sourced listings, `lifecycle_state` mirrors `status` 1-to-1 (no Draft/Approved stages — the source already published).

### State machine (internally-sourced listings)

```
                     Draft
                       │ submitForReview
                       ▼
                 PendingReview ──── reject ──► Rejected ──┐
                       │ approve                          │ edit
                       ▼                                  ▼
                  Approved                              Draft
                       │ publish
                       ▼
                    Active ◄─── reactivate ─── Withdrawn
                       │                          ▲
                       │ acceptOffer              │ withdraw / expire
                       ▼                          │
              ActiveUnderContract ────────────────┤
                       │ closeDeal                │ cancelDeal
                       ▼                          │
                     Sold ──────────► Archived ◄──┘
                                       (terminal)
```

| `lifecycle_state` | RESO `status` projected to channels | Channel-published? |
|---|---|---|
| `Draft`, `PendingReview`, `Rejected` | (none) | No |
| `Approved` | `ComingSoon` | Web only, "coming soon" badge |
| `Active` | `Active` | All channels per distribution rules |
| `ActiveUnderContract` | `Pending` | Yes, "Under Contract" badge |
| `Sold` | `Closed` | History only |
| `Withdrawn`, `Expired` | `Withdrawn` / `Expired` | Channel-removed |
| `Archived` | `Closed` (frozen) | No |

### Schema (Phase-1, lands with `cdl_full_reso_ingestion.sql`)

```sql
-- Internal source flag + seed row
alter table public.mls_sources add column if not exists is_internal boolean not null default false;

insert into public.mls_sources (id, slug, display_name, type, is_internal, is_enabled)
  values ('00000000-0000-0000-0000-000000000001'::uuid,
          'matrix-internal', 'Sharp Matrix Internal', 'internal', true, true)
  on conflict (id) do update
    set is_internal = excluded.is_internal, type = excluded.type;

-- Lifecycle columns
alter table public.properties           add column if not exists lifecycle_state text;
alter table public.properties           add column if not exists lifecycle_state_changed_at timestamptz;
alter table public.properties_published add column if not exists lifecycle_state text;

create index if not exists idx_properties_lifecycle
  on public.properties(source_id, lifecycle_state)
  where lifecycle_state is not null;

-- Append-only audit trail of state transitions
create table if not exists public.property_lifecycle_events (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties(id) on delete cascade,
  from_state            text,                              -- null on initial Draft
  to_state              text not null,
  changed_by_member_key text,                              -- null = system / cron
  changed_at            timestamptz not null default now(),
  reason                text,
  source_id             uuid,
  metadata              jsonb not null default '{}'::jsonb -- offer_id, agent_id, channel_id, ...
);
create index if not exists idx_ple_property_recent
  on public.property_lifecycle_events(property_id, changed_at desc);

-- Backfill: existing externally-sourced rows get lifecycle_state := status
update public.properties
   set lifecycle_state = status
 where lifecycle_state is null and status is not null;
```

### Lifecycle EF (`cdl-listing-lifecycle`)

> **Status (2026-06-08, ADR-026): the transaction-phase subset is SHIPPED.**
> The `cdl-listing-lifecycle` EF is deployed on the CDL project with the three
> transaction-phase actions `acceptOffer` (-> RESO `Pending`), `closeDeal`
> (-> `Closed`), and `cancelDeal` (-> `Active` / Back On Market) — this is how
> `matrix-pipeline` exercises its **transaction-phase ownership** of the shared
> `Property`. The remaining actions (`submitForReview`/`approve`/`publish`/
> `withdraw`/`expire`/`reactivate`/`archive`) and the cron jobs are still
> Phase-2.5 (Atlas listing-phase). **Live-schema note:** the shipped EF works
> against the current `public.properties` shape, which differs from the
> illustrative DDL below — RESO `ListingKey` is stored as `originating_system_key`
> (the EF takes a `listing_key` arg = that value), currency is `currency_code`,
> there is **no `lifecycle_state`/`locked_fields` column** (lifecycle state is
> derived from `standard_status` + `property_lifecycle_events`; locks live in
> `property_field_overrides` via `cdl_lock_field`/`cdl_unlock_field`), and the
> close economics are the canonical `close_price`/`close_date`/
> `purchase_contract_date`/`contract_status_change_date` columns added by
> migration `20260608150000`. The buyer is a `Contact` linked via
> `ContactListings`; the transition timeline is the `HistoryTransactional` event
> spine (read via `cdl-read` resource `history_transactional`). The
> source-of-record guard (record-only for `qobrix`/`dash`) is wired but inert
> until `properties` carry a resolvable `mls_sources` slug (today
> `originating_system_name` is a tenant id). See [ADR-026](decisions/ADR-026.md).

One EF action per legal transition. Each action:

1. Validates from→to transition (against the state-machine table above).
2. Validates the actor's permission scope (`self` for own listings, `team` for team-managed, `org_admin` / `system_admin` for review/approve/close).
3. Writes `property_lifecycle_events` (append-only audit).
4. Updates `properties.lifecycle_state`, `lifecycle_state_changed_at`, and projects to RESO `status`.
5. Optionally **auto-locks** state-protected fields via `cdl_lock_field` (e.g. on `acceptOffer`, automatically lock `price`, `bedrooms`, `bathrooms` to prevent accidental edits during escrow).

```
POST /functions/v1/cdl-listing-lifecycle
Authorization: Bearer <SSO JWT>
{
  "action": "submitForReview" | "approve" | "reject" | "publish"
          | "acceptOffer" | "cancelDeal" | "closeDeal"
          | "withdraw" | "expire" | "reactivate" | "archive",
  "property_id": "<uuid>",
  "reason": "...",
  "metadata": { "offer_id": "...", ... }
}
```

Cron jobs:
- **auto-expire** — listings past `expires_at` while `Active` → `Expired`
- **auto-archive** — listings >90 days in any terminal state (`Sold`, `Withdrawn`, `Expired`, `Rejected`) → `Archived`

### Lifecycle-state-gated edits (integrates with stewardship)

The field-lock layer (§ 2 below) integrates with lifecycle:

| State | What's editable | Auto-locks on entry |
|---|---|---|
| `Draft` | Everything | — |
| `PendingReview` | Nothing (read-only for review) | All marketing fields |
| `Approved` | Description, media, marketing_metadata | — |
| `Active` | Description, media, price (with audit), marketing_metadata | — |
| `ActiveUnderContract` | Description, media | `price`, `bedrooms`, `bathrooms`, `area_sqm` |
| `Sold` / `Archived` | Read-only | All fields |

Auto-lock is implemented by `cdl-listing-lifecycle` calling `cdl_lock_field()` on transition.

### Atlas UI (Phase-2.5)

- **Lifecycle badge** on listing detail (color-coded by state).
- **Transition buttons** gated by current state + actor permission scope.
- **Activity-log timeline** view of `property_lifecycle_events` (who changed what, when, why).
- **"Internal" filter** on listings list (separate externally-sourced from internally-sourced).

### Why source-of-record is Phase-1-foundation but engine is Phase-2.5

Phase-1 lands the **schema columns + seed source + audit table** so existing listings keep working unchanged (lifecycle_state mirrors status), and so the lifecycle EF can be added later as a pure write-path addition without a destructive migration. The state-machine enforcement, transition UI, and cron jobs are deferred to the `cdl-listing-lifecycle` follow-up plan.

---

## 2. Field-level overrides (stewardship)

### Problem

A broker reviews an MLS-imported listing and edits the description from the auto-generated
"3 BR / 2 BA / 145 sqm in Limassol" to a hand-crafted marketing copy. The next time the MLS feed
runs, that hand-crafted description must NOT be overwritten by the source's auto-generated text.

Same applies to edited prices (after seller agrees to a discount), curated photo captions, and
custom amenity tags.

### Solution: `locked_fields` cache + audit table + merge logic

```
┌────────────────────────┐     ┌─────────────────────────────────┐
│ Atlas listing detail   │     │ properties.locked_fields jsonb  │
│ ──────────────────     │     │ ─────────────────────────────── │
│ [description_en]   🔒  │ ──► │ {                               │
│ "Hand-crafted copy"    │     │   "description_en": {           │
│                        │     │     "by": "agent-001",          │
│ Click to lock/unlock   │     │     "at": "2026-04-26T...",     │
│   → cdl_lock_field()   │     │     "source_value": "auto..."   │
│   → cdl_unlock_field() │     │   }                             │
└────────────────────────┘     │ }                               │
                               └─────────────┬───────────────────┘
                                             │
┌────────────────────────┐                   │ pre-fetched per upsert batch
│ mls-sync EF            │                   │
│ genericUpsert(rows)    │ ◄─────────────────┘
│                        │
│ for r in rows:         │
│   for k in locked:     │  on UPDATE: skip locked columns
│     delete r[k]        │  on INSERT: irrelevant (no prior row)
│ upsert(rows)           │
└────────────────────────┘
```

### Schema

```sql
-- 1. Per-table denormalized cache (fast lookup during merge)
alter table public.properties           add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.properties_published add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.members              add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.offices              add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.contacts             add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.teams                add column if not exists locked_fields jsonb not null default '{}'::jsonb;
alter table public.open_houses          add column if not exists locked_fields jsonb not null default '{}'::jsonb;

-- (Append-only event tables — showings, history_transactional, internet_tracking_events —
-- have no locked_fields. They are not user-edited.)

-- 2. Append-only audit table (one row per lock/unlock event)
create table if not exists public.property_field_overrides (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties(id) on delete cascade,
  field_name            text not null,
  value_jsonb           jsonb,                    -- the override value
  replaced_value_jsonb  jsonb,                    -- what the source had at lock time
  set_by_member_key     text,                     -- agent who locked it
  set_at                timestamptz not null default now(),
  unset_at              timestamptz,              -- null = currently locked
  unset_by_member_key   text,
  locked_until          timestamptz,              -- optional TTL
  reason                text,
  source_id             uuid                      -- null = applies to all sources
);
```

### RPCs

```sql
-- Called from Atlas UI when an agent locks a field with a custom value
select public.cdl_lock_field(
  p_property_id  := '...',
  p_field        := 'description_en',
  p_value        := '"Hand-crafted marketing copy"'::jsonb,
  p_member_key   := 'agent-001',
  p_locked_until := null,        -- lock indefinitely
  p_reason       := 'Marketing-approved version'
);

-- Called when the agent (or a manager) clears the lock
select public.cdl_unlock_field(
  p_property_id := '...',
  p_field       := 'description_en',
  p_member_key  := 'agent-001'
);
```

Both functions are `security definer` and granted to `authenticated` only — never `anon`.

### Merge logic (Phase-1)

Both write paths must respect the cache:

| Write path | Where | What |
|---|---|---|
| `mls-sync` `genericUpsert` (new resources: members, offices, contacts, teams, open_houses, properties when run via the generic loop) | `supabase/cdl/functions/mls-sync/index.ts` | Pre-fetch `locked_fields` for each conflict key; strip locked columns from the row before `upsert`. INSERT path is unaffected (no prior row). |
| `listing-merge` (existing 5-stage pipeline) | `supabase/cdl/functions/listing-merge/index.ts` | Same skip-locked-columns logic on UPDATE. |

Performance cost: one extra `select id, locked_fields where in (...)` per batch. Negligible vs the upsert itself.

### What gets locked (in practice)

| Resource | Common lock candidates | Almost never locked |
|---|---|---|
| `properties` | `description_en`, `description_ru`, `title_en`, `price`, `marketing_metadata`, `media` captions | `listing_id`, `mls_status`, `area_sqm`, geo coordinates |
| `members` | `bio_en`, `bio_ru`, `profile_photo_url` | `member_key`, `email`, license fields |
| `offices` | `marketing_blurb`, `office_phone` (if curated) | `office_key`, address |
| `contacts` | (PII; rarely locked) | most fields |
| `teams` | `team_description`, `team_photo_url` | `team_key`, member roster |
| `open_houses` | (rarely; events are short-lived) | most fields |

---

## 3. Channel distribution rules (Phase-2.5)

### Problem

Sharp Matrix publishes to many channels: the public Cyprus website, Hungary website, Kazakhstan website,
mobile app, Zillow, RESO Web API for partners, JSON-LD for SEO, social cards, HubSpot/Mailchimp for
marketing, `matrix-pipeline` CRM, future MCP-using AI agents. Not every listing should go everywhere — Cyprus
listings shouldn't appear on the Hungary website; high-end listings might be web + Zillow only;
private off-market listings might be CRM-only (visible to `matrix-pipeline` agents only).

### Solution: rule-engine over `properties_published`

```
┌─────────────────────────────┐
│ Atlas Channels admin        │  per-channel rule editor
│ ─────────────────────────── │
│ Channel: Zillow             │
│   priority   effect    rule │
│      10      include   country = 'Cyprus' AND status = 'Active' AND price > 100000
│      20      exclude   is_private = true
│      30      exclude   listing_type = 'Rental'
└─────────┬───────────────────┘
          │ persisted to
          ▼
┌──────────────────────────────────┐
│ public.channel_distribution_rules │
└──────────┬───────────────────────┘
           │ evaluated by
           ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│ channel-router EF                │ ──►│ public.channel_listings          │
│ (cron + on-publish trigger)      │    │ (channel × listing × status)     │
└──────────────────────────────────┘    └──────────┬───────────────────────┘
                                                   │ read by
                                                   ▼
                                        ┌──────────────────────────────────┐
                                        │ syndication-fanout EF            │
                                        │ pushes to each channel by type   │
                                        └──────────────────────────────────┘
```

### Schema

```sql
-- Channels we publish to
create table public.channels (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,        -- 'zillow', 'matrix-cy-website', 'hubspot', ...
  display_name    text not null,
  type            text not null check (type in ('idx','reso-web-api','webhook','view','mcp','social','email-crm','file-export')),
  config          jsonb not null default '{}'::jsonb,
  is_enabled      boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Per-channel inclusion rules (evaluated in priority order, last-effect wins)
create table public.channel_distribution_rules (
  id                    uuid primary key default gen_random_uuid(),
  channel_id            uuid not null references public.channels(id) on delete cascade,
  priority              int not null default 100,           -- lower = evaluated first
  predicate_jsonb       jsonb not null,                     -- AST → SQL where-clause
  effect                text not null check (effect in ('include','exclude')),
  reason                text,
  is_enabled            boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Materialized output: which listing goes to which channel + last delivery state
create table public.channel_listings (
  channel_id            uuid not null references public.channels(id) on delete cascade,
  listing_id            uuid not null references public.properties_published(id) on delete cascade,
  status                text not null default 'pending',    -- pending|sent|failed|removed
  last_evaluated_at     timestamptz not null default now(),
  last_sent_at          timestamptz,
  last_error            text,
  channel_payload       jsonb,                              -- last-rendered per-channel projection
  primary key (channel_id, listing_id)
);
create index idx_cl_channel_status_recent on public.channel_listings(channel_id, status, last_evaluated_at desc);
```

### Rule predicate AST

A small, well-tested DSL. JSON shape:

```json
{
  "op": "and",
  "ops": [
    { "op": "=", "field": "country", "value": "Cyprus" },
    { "op": "=", "field": "status", "value": "Active" },
    { "op": ">", "field": "price",  "value": 100000 },
    {
      "op": "or",
      "ops": [
        { "op": "in",      "field": "city", "values": ["Limassol", "Paphos"] },
        { "op": "between", "field": "area_sqm", "min": 200, "max": 500 }
      ]
    }
  ]
}
```

Compiled to parameterized SQL by the `channel-router` EF — never raw string concat (SQL injection surface). Compatible operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not in`, `between`, `is null`, `is not null`, `and`, `or`, `not`.

Field allowlist: only typed columns of `properties_published` plus `marketing_metadata->>'<key>'`. No `raw->>'<key>'` access (would let rules silently drift on schema changes).

### Channel types

| Type | Direction | Pusher / Puller | Example channels |
|---|---|---|---|
| **`brand-network`** | **bidirectional** | **`dash-export` EF (out) + `dash-import` EF (in), both Phase-2.5; reads through Phase-1 `v_dash_*` views** | **Anywhere Dash (SIR affiliate primary contract)** |
| `reso-web-api` | outbound | Direct RESO Web API endpoint | listings APIs, partner data exchanges |
| `idx` | outbound | Generates IDX-compliant XML/RETS feed | partner brokerages |
| `webhook` | outbound | POST listing JSON to a configured URL | HubSpot, Mailchimp, partner systems |
| `view` | outbound | SQL view (`v_jsonld`, `v_zillow`, ...) — pull-based | SEO crawlers, search engines |
| `mcp` | outbound | Tool surface for AI agents | internal copilots, partner LLMs |
| `social` | outbound | Renders OG image + meta + posts | Instagram, Facebook, Twitter (later) |
| `email-crm` | outbound | Pushes CSV / API call to email CRM | mass-mail campaigns |
| `file-export` | outbound | Generates timed CSV/JSON file dropped on SFTP | legacy partner integrations |

The first row is special: **Anywhere Dash is bidirectional and contractual** because Sharp Matrix is an SIR affiliate. All other channel types are best-effort outbound syndication that we control unilaterally. This is why the `v_dash_*` view layer is a Phase-1 deliverable (not a follow-up) — the views are the contract surface between the CDL and Anywhere.

### Atlas UI (Phase-2.5)

- **Channels admin** — list channels, enable/disable, edit per-channel rules with a visual rule builder.
- **Per-listing Syndication tab** — shows which channels currently include the listing + last-sent timestamp + the rendered payload for each channel.
- **Field-lock UI** on listing detail — agent clicks any field, sees the source value vs override value, can lock/unlock with reason.

---

## 4. Multi-source merge precedence (Phase-2.5)

### Problem

We currently key listings by `(source_id, source_listing_key)` so each source has its own row.
Once we have multiple feeds for the same logical listing (RESO + `matrix-pipeline` CRM + future Hungary feed),
we need a per-field precedence rule: "Cyprus MLS wins on `price` and `mls_status`; `matrix-pipeline` wins on
`description_en` and `media`; either wins on `area_sqm` (last-write-wins)."

### Solution: `source_field_priority` + extension to `listing-merge`

```sql
create table public.source_field_priority (
  source_id     uuid not null references public.mls_sources(id) on delete cascade,
  field_name    text not null,                   -- '*' = default for fields not otherwise specified
  priority      int not null default 100,        -- lower = wins
  primary key (source_id, field_name)
);
```

Phase-2.5 extends `listing-merge` to:
1. Identify when the same logical listing exists from 2+ sources (joined via a future `public.listing_aliases` table).
2. For each field, choose the value from the source with the lowest priority for that field.
3. Honor `locked_fields` on top — locked fields ALWAYS win regardless of source priority.

### Why this is Phase-2.5 not Phase-1

- Multi-source dedup only matters when `matrix-pipeline` (CRM) starts writing listings — today RESO is the only writer.
- The deduplication key (how do we know two rows are the "same" listing across sources?) needs careful design — likely a fuzzy match on (address, source_listing_key, slug) plus manual confirmation.

---

## Cross-Reference

| For | See |
|---|---|
| Phase-1 plan source (where the foundations land) | `matrix-platform-foundation/supabase/cdl/migrations/20260426130000_cdl_full_reso_ingestion.sql` |
| Read-path performance contract | [platform/performance.md](../platform/performance.md) |
| Phase-2 intelligence layer (semantic + recsys + MCP) | [intelligence-layer.md](intelligence-layer.md) |
| Personalization spec (visitor-side recsys, user axis) | [product-specs/personalization.md](../product-specs/personalization.md) |
| Ecosystem channels (which channels exist) | [platform/ecosystem-architecture.md](../platform/ecosystem-architecture.md) |
| RESO canonical schema for the data being distributed | [`reso-dd-kb/wiki/dbml/canonical.dbml`](../data-models/reso-dd-kb/wiki/dbml/canonical.dbml) |
