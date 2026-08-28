# Intelligence Layer (Phase 2) — Semantic Search, Recsys, MCP, Syndication

> **Status (Apr 2026)**: Roadmap. Phase-1 schema additions (pgvector + embedding columns + `marketing_metadata jsonb`) land with the
> [`cdl-mls-sync-full-reso`](https://github.com/sharpsir-group/matrix-platform-foundation) plan. Phase-2 features build on top
> with **zero destructive schema changes**.
>
> **Audience**: anyone designing AI / search / recsys / syndication features for Sharp Matrix.

---

## What "intelligence layer" means

The CDL serves **all Sharp Matrix channels** (Atlas admin, public website, mobile, partners, `matrix-pipeline` CRM, AI agents). On top of the canonical
data + sub-20ms read foundation, the intelligence layer adds five capabilities:

1. **Semantic search** — natural-language → embedding → ANN over listings (and agents).
2. **Algebraic search** — boolean DSL `(city = X OR Y) AND price BETWEEN ... AND NOT type = Land` for partner integrations.
3. **Recommendation system** — "similar to this listing", "recommended for you", "best agent for this listing".
4. **MCP server (`cdl-mls`)** — Model Context Protocol surface so AI agents (Cursor, Claude Desktop, internal copilots) can read CDL via 8 well-typed tools.
5. **Syndication** — outbound feeds to JSON-LD (SEO), IDX, Zillow-style portals, social cards, email/CRM webhooks.

All five rely on the same underlying CDL — no separate data store, no separate index, no parallel pipeline.

> **Sibling layer**: the [Distribution & Stewardship layer (Phase 2.5)](data-distribution-and-stewardship.md) covers the
> rules-engine side of "where data goes" — source-of-record & listing lifecycle, channel distribution rules, multi-source merge precedence, and field-level
> overrides. It's a sibling concern, not a sub-concern of intelligence: same data, different axis (channel × listing
> instead of user × listing).

## Phase-1 → Phase-2 contract

Phase 1 (`cdl-mls-sync-full-reso` plan) adds the following **additive, zero-impact** schema pieces that unlock Phase 2 without a re-migration:

```sql
create extension if not exists vector;

-- Description / content embedding (free-text "feel")
alter table public.properties_published
  add column if not exists embedding vector(1024),
  add column if not exists feature_vector vector(64),  -- structured features
  add column if not exists embedded_at timestamptz,
  add column if not exists marketing_metadata jsonb not null default '{}'::jsonb;

alter table public.members
  add column if not exists embedding vector(1024),
  add column if not exists embedded_at timestamptz;
```

**Why `vector(1024)`**:
- Cohere `embed-english-v3.0` (and multilingual variant) is 1024 native — good EN/RU/EL coverage for Sharp Matrix's three markets.
- OpenAI `text-embedding-3-small` Matryoshka-truncates from 1536 → 1024 cleanly.
- 1024 × float4 = 4 KB/row vs 6 KB at 1536 — meaningful at 100k+ rows.

**HNSW indexes are NOT built in Phase 1** (HNSW build is expensive on empty/sparse columns). They are built once an embedding cron populates the columns.

`internet_tracking_events` is already designed in Phase 1 with the RESO Actor / Event / Object groups — exactly the shape recsys collaborative filtering needs. No additional schema for recsys input.

---

## 1. Semantic search

### Pure semantic

```sql
-- 1. Edge Function: q_embedding = embedProvider.embed(natural_language_query)
-- 2. Postgres:
select id, listing_id, title_en, price, city,
       1 - (embedding <=> $1::vector) as similarity
from public.properties_published
where is_visible and not is_deleted and status = 'Active'
order by embedding <=> $1::vector
limit 50;
```

### Hybrid (semantic + lexical) with Reciprocal Rank Fusion

```sql
with lex as (
  select id, row_number() over (order by similarity(haystack, $2) desc) as r
  from public.properties_published
  where (...) and haystack % $2  -- trigram match on city || address || ...
  limit 200
), sem as (
  select id, row_number() over (order by embedding <=> $1::vector) as r
  from public.properties_published
  where (...)
  limit 200
)
select id, sum(1.0 / (60 + r)) as score
from (select id, r from lex union all select id, r from sem) u
group by id
order by score desc
limit 50;
```

This is the industry-standard pattern. It combines literal MLS-id matches ("VIL-2024-0123") with conceptual matches ("luxury beachfront 3-bed"). Backed by the GIN trigram index (lexical) and HNSW (semantic) — both already planned.

### Embedding generation

- **Cron Edge Function** `embed-properties` runs nightly + on-publish-event:
  - `select id from properties_published where embedding is null or embedded_at < $threshold limit 100;`
  - Builds embedding text from `title_en + description_en + city + property_type` (and a structured features sentence for `feature_vector`).
  - Calls Cohere/OpenAI/Voyage AI embedding API.
  - Updates row with `embedding`, `feature_vector`, `embedded_at = now()`.
  - Idempotent; safe to retry.
- The same EF handles `members` agent-bio embeddings.

---

## 2. Algebraic search

For complex boolean filters (partner integrations, power-user agents):

```
(city = "Limassol" OR city = "Paphos")
  AND price BETWEEN 500000 AND 2000000
  AND (bedrooms >= 3 OR area_sqm >= 200)
  AND status IN ("Active", "Pending")
  AND NOT property_type = "Land"
```

Two implementations, both backed by the same indexes:

| Implementation | When to use |
|---|---|
| **PostgREST `or=(...)`/`and=(...)`/`not.*` syntax** | Channels that build URLs (websites, simple integrations). No new EF needed. |
| **`algebraic-search` EF** with JSON-AST input | Partner integrations that don't want to learn PostgREST; centralizes validation + auth. |

The covering b-trees on `(status, city, price, property_type, bedrooms)` from the read-perf migration handle most algebraic combinations efficiently.

---

## 3. Recommendation system

Three recsys flavors, all on top of the existing schema:

| Flavor | Method | Backed by |
|---|---|---|
| **Similar to this listing** | Content-based vector cosine | `properties_published.embedding` |
| **Recommended for you** | Collaborative filtering on user × listing matrix | `internet_tracking_events` (`actor_*` × `object_*` × `event_*` groups) |
| **Best agent for this listing** | Cross-resource cosine | `members.embedding` × listing `embedding` |

### Collaborative filtering input

`internet_tracking_events` is the user × listing matrix:

| RESO column | Recsys role |
|---|---|
| `actor_key` (or `actor_mls_id` for anonymous-but-stable cookie) | User axis |
| `object_key` | Listing axis |
| `event_type` | Implicit feedback weight: View=1, Share=3, Favorite=5, Inquiry=10 |
| `event_timestamp` | Recency decay |

### Pipeline

Nightly cron `recommendations-cron`:
1. Read last 90 days of `internet_tracking_events`.
2. Compute weighted user × item matrix.
3. Run ALS / implicit-MF; output top-K recs per user.
4. Write to `public.recommendations(actor_key, listing_keys text[], computed_at)`.
5. Read EF reads from this table, joins back to `properties_published`.

**Cold start** (no event history):
- Fall back to **trending** (high event volume in last 7 days, recency-weighted).
- If demographics known (city / price-band of past sessions), fall back to demographic ranking.

---

## 3a. Agent memory retrieval (Digital Employees)

App-local to `matrix-digital-employees` (`agent_memories` on Lovable Cloud
`mihslqjjclbrqelnjjpb`). Complements CDL RAG (`knowledge_chunks`): memory answers
"what do I know about this person / thread?", RAG answers "what does the company
know?".

### Composite recall (`match_agent_memories`)

Hybrid retrieval mirrors `match_knowledge_chunks`:

1. **Vector lane** — cosine ANN over `embedding` (HNSW).
2. **Keyword lane** — `websearch_to_tsquery` over `to_tsvector('english', content)`.
3. **RRF fusion** (k=60), then min-max normalise to `rel`.
4. **Recency** — `exp(-ln(2) * age_hours / half_life_hours)` where age uses
   `greatest(created_at, last_recalled_at)`. Default half-life **14 days**
   (`memory_config.halfLifeDays`).
5. **Score** — `0.55 * rel + 0.25 * importance + 0.20 * recency`.
6. **Gate** — keep rows with `similarity >= minSimilarity` (default 0.15) **or**
   an FTS match, so unrelated vectors drop while keyword hits survive.
7. Optional `p_since` temporal filter on `created_at`.

Scope filters (`thread` / `person` / `shared` / `channel` / `group`) and
`expires_at` remain enforced inside the `SECURITY DEFINER` RPC.

### Write path

- Post-turn `consolidateMemory` asks the summariser for per-fact **importance**
  (0.9 identity/preference/commitment, 0.5 useful context, 0.2 ephemeral) and
  drops anything below **0.25**.
- `upsert_agent_memory` merges near-duplicates (≥ **0.92** cosine within the same
  tenant/employee/scope/subject) instead of inserting another row. Accepts
  `p_metadata` (merged into `metadata`) and excludes ids listed in
  `metadata.derived_from` from the merge candidates so reflection cannot
  overwrite its own sources.
- Recalled ids are reinforced via `touch_agent_memories` (`last_recalled_at`,
  `recall_count++`) off the critical path.
- Eval / training turns pass `suppressMemoryWrite` so test data never enters
  the store.

### Reflection (sleep-time consolidation)

`memory-reflect` (pg_cron every 15 min, `x-scheduler-secret`) synthesises
higher-level semantic facts when `unreflected_count` crosses
`memory_config.reflectionThreshold` (default 8) or after 24h off-peak with ≥2
facts. Gated promotion requires ≥2 source ids and importance ≥ 0.25; writes
`metadata.origin = 'reflection'` and `derived_from`. Contradictions stamp
`superseded_by` + `expires_at` for the daily prune.

### Virtual context tools

Built-in (non-MCP) tools `memory_search`, `memory_write`, `history_search`
(`search_conversation_messages` FTS RPC) let the model page memory and older
turns into context on demand. Scoped through `resolveMemoryPlan`; checkpointed
as `memory_tool` run steps.

### Retention prune

Daily cron `agent-memory-prune` (03:17 UTC) runs `prune_agent_memories()`:
deletes rows past `expires_at`, plus `short_term` rows older than 30 days.

### Data-subject export / forget

`governance-api` actions (SSO + CRUD gated):

| Action | Effect |
|---|---|
| `listPrincipals` | Email-prefix search within the tenant |
| `exportPrincipal` | JSON bundle: principal, channel identities, person-scoped memories, authored messages, MCP tool calls. Audit `principal.export`. |
| `forgetPrincipal` | `memories` — delete person-scoped memories; `all` — also clear identity links and MCP tokens. Audit `principal.forget`. Messages stay for audit. |

UI: Administration → Privacy (`DataSubjectPanel`).

---

## 4. MCP server (`cdl-mls`)

A Model Context Protocol server exposing the CDL as tools for AI agents (Cursor, Claude Desktop, internal copilots, `matrix-pipeline` CRM Copilot).

### Tool surface

| Tool | Purpose | Backed by |
|---|---|---|
| `search_listings(query, filters?, k?)` | NL search; returns ranked listings | hybrid semantic + algebraic |
| `get_listing(listing_id \| slug)` | Detail view + media + open houses + showings | `properties_published` + `property_media` + `open_houses` |
| `find_similar(listing_id, k=10)` | "More like this" | content-based vector |
| `find_agent(specialty?, city?, k=10)` | Match an agent | `members.embedding` |
| `recommend_for_actor(actor_key \| actor_mls_id, k=10)` | Personalized recs | `recommendations` table |
| `market_stats(city?, district?, period_days=30)` | Aggregated price/inventory/DOM stats | rolled-up materialized views |
| `get_open_houses(weekend?, agent_key?)` | Schedule view | `open_houses` |
| `get_listing_history(listing_id)` | Price/status timeline | `history_transactional` |

### Deployment options

| Option | When to use |
|---|---|
| **Supabase Edge Function speaking MCP HTTP** | Multi-tenant; gets HTTP edge caching for free; Supabase JWT auth. |
| **Standalone Node.js MCP server** | stdio MCP clients (Cursor, Claude Desktop); per-channel API keys. |

Both are **read-only**; no MCP tool mutates the CDL. Auth via Supabase JWT for HTTP variant; per-channel API keys for stdio variant.

---

## 5. Marketing & syndication channels

The CDL is the source of truth for **outbound** feeds to:

| Channel | Format | Backed by |
|---|---|---|
| Public website (matrix-cy-website) | JSON via `listings-search` EF | `properties_published` |
| Mobile app | Same JSON, slimmer projection | `listings-search` EF |
| Partner IDX feeds | RESO Web API (OData) or RETS XML | passthrough EF or `v_idx` view |
| Zillow / portal syndication | Portal-specific JSON/XML | per-portal SQL view |
| Google JSON-LD (SEO) | `RealEstateListing` schema.org | `v_jsonld` view |
| Social share cards | OG image + meta | EF rendering from `properties_published` |
| Email campaigns (HubSpot, Mailchimp, etc.) | CSV / webhook | event-driven via `syndication-fanout` EF |
| `matrix-pipeline` CRM (leads, opportunities, contacts) | Direct CDL read | RLS-scoped queries |

### Channel-specific views

```sql
create view public.v_jsonld with (security_invoker = true) as
select id, listing_id, slug,
  jsonb_build_object(
    '@context', 'https://schema.org',
    '@type', 'RealEstateListing',
    'name', title_en,
    'description', description_en,
    'price', jsonb_build_object('@type','MonetaryAmount','value',price,'currency',currency),
    'address', jsonb_build_object('@type','PostalAddress',
      'addressLocality', city, 'postalCode', postal_code, 'addressCountry', country),
    'geo', jsonb_build_object('@type','GeoCoordinates','latitude',latitude,'longitude',longitude),
    'numberOfRooms', bedrooms,
    'floorSize', jsonb_build_object('@type','QuantitativeValue','value',area_sqm,'unitCode','MTK'),
    'image', virtual_tour_url
  ) as jsonld
from public.properties_published
where is_visible and not is_deleted;
```

`security_invoker = true` ensures views respect the **caller's** RLS, not the view-creator's.

### Webhook fanout

`syndication-fanout` Edge Function listens for `propertiesPublished:event` (cron-pulled or `pg_notify`-driven) and pushes to:
- HubSpot / Mailchimp via webhook APIs
- Internal Slack / `matrix-pipeline` CRM
- Partner outbound queues

The `marketing_metadata jsonb` column on `properties_published` lets each channel attach campaign data (UTM defaults, channel feature flags, social-share text overrides) without further `ALTER TABLE`.

---

## Phase-2 todos (separate plans, not blocking Phase 1)

| Todo | Scope |
|---|---|
| `embed-properties-cron` | Backfill `properties_published.embedding` and `members.embedding` |
| `hnsw-indexes` | Once embeddings populate, build HNSW + structured-feature indexes |
| `semantic-search-ef` | NL → embedding → ANN → re-rank EF |
| `algebraic-search-ef` | JSON-AST → parameterized SQL EF |
| `recommendations-cron` | Nightly ALS / implicit-MF; populates `public.recommendations` |
| `mcp-cdl-server` | New MCP server with the 8 tools above |
| `syndication-views` | `v_jsonld`, `v_idx`, `v_zillow`, … per channel |
| `syndication-fanout-ef` | Webhook fanout to HubSpot/Mailchimp/Slack on listing events |

Each gets its own plan when prioritized.

---

## Why Phase 2 is deferred

- **Embedding-model choice + cost** requires a 2-3 candidate test on real Sharp Matrix descriptions (EN/RU/EL multilingual quality matters).
- **Recsys quality** requires ≥ 3 months of `internet_tracking_events` data. Phase 1 starts capturing it; recsys becomes valuable in Q3.
- **MCP tool surface** should be informed by which agentic flows actually emerge in production.
- **Syndication channels** are each their own integration — best done on demand to keep WIP low.

## Out of scope (both phases)

- Embedding-model serving in-house — we call OpenAI/Cohere/Voyage AI; no own inference cluster.
- Real-time recsys — nightly batch is enough for v1; streaming requires Kafka or a message queue we don't have.
- A/B testing of ranking algorithms — handled at the channel layer, not the CDL.
- Demographic / third-party data joins on `actor_key`.

## Cross-Reference

| For | See |
|---|---|
| CDL schema + read-perf indexes | [data-models/cdl-schema.md](../data-models/cdl-schema.md) |
| Read-path performance contract | [platform/performance.md](../platform/performance.md) |
| **Distribution / channel routing / field-overrides (sibling Phase 2.5)** | [data-distribution-and-stewardship.md](data-distribution-and-stewardship.md) |
| Personalization spec (visitor-side) | [product-specs/personalization.md](../product-specs/personalization.md) |
| Phase-1 plan source | `matrix-platform-foundation/supabase/cdl/migrations/20260426*` + `matrix-platform-foundation/supabase/cdl/functions/mls-sync` |
| RESO `InternetTracking` field reference | [`reso-dd-kb/wiki/agent-docs/resources/internet_tracking.md`](../data-models/reso-dd-kb/wiki/agent-docs/resources/internet_tracking.md) |
| Ecosystem channels | [platform/ecosystem-architecture.md](../platform/ecosystem-architecture.md) |
