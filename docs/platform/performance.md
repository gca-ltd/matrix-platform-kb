# Performance Requirements & Capacity Planning

> **For Lovable**: This document defines the performance contract Sharp Matrix
> apps must meet. The CDL is the shared read foundation for **all** channels
> (Atlas admin, public website, mobile, partner integrations, AI agents).
> Apps must respect the budgets, indexes, and read patterns documented here.

---

## Latency Targets (p99, in-region)

| Surface | Budget | Notes |
|---|---|---|
| **CDL single-property read** (`public.properties_published` by `listing_id` or `slug`) | **≤ 20 ms** | Core multi-channel hit path. Index-only scan via covering b-tree. |
| **CDL filtered search** (50 listings, ≤ 5 filters) | **≤ 30 ms** | Covering partial b-tree on `(source_id, status, published_at desc)` with `INCLUDE (id, listing_id, slug, title_en, price, bedrooms, ...)`. |
| **CDL fuzzy text search** ("modern villa near sea") | **≤ 30 ms** | GIN trigram on `(city || address || postal_code || district)`. |
| **CDL geo radius search** ("within 5 km of (lat,lng)") | **≤ 30 ms** | PostGIS GIST on a stored generated `geo geometry(Point, 4326)` column. |
| **CDL semantic search** (NL → embedding → ANN) | **≤ 50 ms** | pgvector HNSW on `properties_published.embedding vector(1024)`. Phase 2. |
| Edge Function compute path | < 100 ms | Includes auth + DB call + serialization. Most reads are direct PostgREST and skip this. |
| Atlas admin "MLS Data" tab list | < 500 ms | Larger result set + `count=exact`; not on the hot path. |
| App page load (any) | < 2 s | End-to-end including network and rendering. |
| Listing-detail full page | < 1 s | Includes media, open houses, agent. |
| CDC lag (Databricks → CDL) | < 15 min | Legacy ETL; being phased out as direct CDL writes scale. |

**p99 cross-region with CDN hit**: ≤ 20 ms. **CDN miss**: ~120 ms (acceptable on cold cache).

## Latency budget breakdown (single property, in-region)

| Hop | Budget |
|---|---|
| Client → Supabase API edge | 5-10 ms |
| PostgREST request parse + auth + RLS check | 1-3 ms |
| Postgres query (single-row by `listing_id`, index-only scan) | < 3 ms |
| Postgres query (filtered list, 50 rows, 5 filters, index-only scan) | < 12 ms |
| JSON serialization | 1-2 ms |
| **Total p99** | **≤ 20 ms** ✓ |

## SSO login latency (auth critical path)

The OAuth login chain is a separate hot path from CDL reads and now has its own budget. A single login traverses `oauth-authorize → oauth-token → (optional) oauth-userinfo`.

| Surface | Budget (p99, warm) | Notes |
|---|---|---|
| `oauth-token` exchange (`authorization_code`, warm instance) | **≤ 300 ms** | Mints + ES256-signs the JWT. Independent DB reads (permissions, groups, roles, teams, attributes) run in `Promise.all`; `getUserById` + `loadDefaultSettings` are fetched once each. |
| `oauth-token` refresh | **≤ 300 ms** | Same resolution path as the initial grant. |
| `oauth-userinfo` | **≤ 250 ms** | **No longer on the login critical path** — the enriched JWT carries the full profile, so first-party apps hydrate from claims and call userinfo only in the background / for not-yet-migrated apps. |
| **Code → first authenticated paint** | **≤ 800 ms** | From the client receiving `?code=` to rendering the authenticated shell. Dropping the blocking post-login `oauth-userinfo` round-trip removes one EF hop from this path. |

**What changed (2026):** the JWT issued by `oauth-token` now embeds the full consumed profile (`email`, `email_verified`, `name`, `picture`, `sso_role`, `scope`, `crud`, `available_roles`, `organization`, `teams`, `allowed_apps`, `tenant_id`, `uoi`, `org_name`, `groups`, `permissions`, `member_type`, `act_as_roles`). The shared `matrix-apps-template-2-1` decodes these claims (`decodeUserFromToken`) on login instead of blocking on `oauth-userinfo`. Non-critical metadata backfills (`tenant_id`, `azure_object_id`, `app_metadata` active-role claims) are deferred off the mint path via `EdgeRuntime.waitUntil` and are excluded from the budget above. `oauth-userinfo`'s response shape is **unchanged** and remains the source of truth (background refresh + apps that have not synced the template). See [sso-edge-functions.md](sso-edge-functions.md) and [api-contracts.md](api-contracts.md).

**Instrumentation:** quantify before/after by logging wall-clock around the `oauth-token` resolution block and the client's `code → setUser` span. Track `oauth-token` p99 via `histogram_quantile(0.99, …)` on the EF logs, the same way `listings-search` is monitored.

## Index strategy on `public.properties_published`

The hot read table is `properties_published`. The index strategy that achieves the budget above is documented in
`matrix-platform-foundation/supabase/cdl/migrations/20260426140000_cdl_properties_published_perf_indexes.sql`:

| Query pattern | Index |
|---|---|
| "Get listing by ID" (mobile, deep link) | `idx_pp_listing_id_covering` (covering partial b-tree) |
| "Get listing by slug" (public website SEO URLs) | `idx_pp_slug` (partial b-tree) |
| "Active listings, sorted recent" (default landing) | `idx_pp_active_search` (covering partial b-tree) |
| "Active in price range $X-Y" | `idx_pp_price_active` (partial b-tree) |
| "Active in city Limassol, sorted by price" | `idx_pp_city_active` + bitmap-AND |
| "By property type" (Villa, Apartment, ...) | `idx_pp_type_active` (partial b-tree) |
| "Recent updates" (admin, cache invalidation) | `idx_pp_recent` |
| "Free-text search 'beach Paphos'" | `gin_pp_text_search` (GIN trigram, `pg_trgm`) |
| "Within 5 km of (lat,lng)" | `gist_pp_geo` (PostGIS GIST on generated `geo` column) |
| "Updated since timestamp" (large window) | `brin_pp_published_at` (BRIN, `pages_per_range=32`) |

**Index design principles:**
- **Covering** — list the columns the search EF returns in `INCLUDE (...)` so Postgres never visits the heap.
- **Partial** — `WHERE is_visible AND NOT is_deleted AND status IN ('Active', ...)` keeps indexes small (30-50% of full-table size).
- **Trigram + Geo + BRIN** — handle fuzzy text, radius search, and large time-range scans without falling back to seq scans.
- **Statistics targets bumped to 1000** on `city`, `postal_code`, `property_type`, `listing_agent_key` for accurate planner estimates.
- **Per-table autovacuum tuning** — hot tables vacuum at 5% dead tuples (vs default 20%); event tables at 10%.

## Read EF (`listings-search`) optimizations

| Optimization | Effect |
|---|---|
| `Cache-Control: public, max-age=30, s-maxage=300, stale-while-revalidate=60` for anonymous queries | CDN edge serves popular searches in ~5 ms |
| `ETag` + `304 Not Modified` handling | Saves payload + DB hit on repeat requests |
| Keyset (cursor) pagination on `(published_at desc, id desc)` | O(log n) at any depth (vs O(n) for `offset N`) |
| `Prefer: count=estimated` (PostgREST) | Facet counts cost ~1 ms via `pg_class.reltuples` (vs 50-200 ms for `count(*) over()`) |
| Module-scope `supabase-js` client | Eliminates per-request construction cold-start tax |
| Field projection via explicit `select=` | Never `select *` — only return what the channel asks for |

## Multi-channel capacity (RPS to Postgres)

| Channel | Peak RPS | To Postgres |
|---|---|---|
| Public website (anon, CDN-cached) | 50-200 | ~5-20 |
| Mobile app (auth) | 20-50 | 20-50 |
| Atlas admin (auth) | 5-10 | 5-10 |
| Partner integrations (auth) | 10-30 | 10-30 |
| **Total to Postgres** | **40-110 RPS sustained** | Within Supabase Pro PgBouncer transaction-mode pool (60 connections) |

**Exit ramps if load grows beyond the Pro tier:**
1. Supabase **read replicas** (Team / Enterprise) — 1-2 read-only replicas; `listings-search` routes anon queries there.
2. **Materialized views** for top-N searches with hourly `REFRESH ... CONCURRENTLY`.
3. **Redis tier** in front of the read EF for sub-1ms repeated-query hits.

## Anti-patterns (do not ship)

- `select *` from `properties_published` — always project the columns the channel actually needs.
- `offset N` for deep pagination — always use keyset cursors.
- `count(*) over()` per page — always use estimated counts unless explicitly requested.
- `%text%` ILIKE without trigram — always go through the GIN trigram index.
- Constructing `supabase-js` per-request — module-scope only.
- Joining roster tables to listings at query time — denormalize hot fields onto `properties_published`.
- Holding raw `pg` connections in Edge Functions — Supabase PgBouncer handles pooling.
- Returning the full `raw jsonb` payload to public channels — `raw` is admin/audit-only.

## Performance regression test

`matrix-testing-suite/tests/apps_atlas/test_atlas_listings_search_perf.sh`:
1. Issues 100 sequential single-property GETs; computes p50/p95/p99.
2. Issues 100 sequential filtered-list GETs (active + city + price range); computes p50/p95/p99.
3. Asserts: p99 ≤ 50 ms (test env, with extra-region network) / p50 ≤ 15 ms.
4. Output tracked over time to detect regressions.

The 50ms test budget is laxer than the 20ms production budget because the test runs from outside the Supabase region. Production p99 is monitored via `histogram_quantile(0.99, …)` on the live `listings-search` EF.

## Concurrent users (current)

| User Type | Total | Peak Concurrent |
|---|---|---|
| Agents (brokers, managers, contact center) | ~200 across 3 markets | 80 |
| Portal clients | ~500 | 50 |
| Anonymous website visitors | (varies, CDN-mediated) | n/a (CDN-served) |

## Data volume (current → 2028 target)

| Metric | Current | Scale Target (2028) |
|---|---|---|
| Active listings | ~2,000 | 10,000 across 5 markets |
| Total `properties` rows (all sources, incl. soft-deleted) | ~16,000 | 50,000+ |
| Contacts | ~10,000 | — |
| Transactions / year | ~500 | — |
| `internet_tracking_events` (when populated) | — | ~10⁵-10⁶ / year |
| `history_transactional` | — | ~10⁵ / year |

## Load testing approach

- **Tools**: k6 or Artillery against staging instance.
- **Key scenarios**: Single-property hot path, filtered search hot path, fuzzy text, geo radius, deep cursor pagination, semantic search (Phase 2).
- **CI gating**: `test_atlas_listings_search_perf.sh` runs on PR; production p99 monitored via Supabase logs / Grafana.

## MSA / Qobrix read path (legacy CRM bridge)

Matrix Sales Automation reads open CRM history from the **Qobrix REST API** via Supabase Edge Functions (`qobrix-pipeline`, `qobrix-contacts`, …). This path is **not** the CDL `listings-search` contract above.

| Rule | Rationale |
|---|---|
| **Upstream fan-out is the dominant cost** — sequential paginated `GET` loops and per-row enrichment (N+1) dominate latency, not App DB round trips. | Parallelise paginated upstream reads (bounded concurrency, preserve page order). |
| **Push viewer scope into the upstream search** | The MSA pipeline board resolves SSO scope *before* fetching Qobrix pages (`owner==` + local-reassignment `id==` union for restricted viewers). Do not download the tenant-wide open set and filter in JS — that forces a silent row cap and makes every broker pay the admin’s cost. |
| **Named safety ceilings must report truncation honestly** | Prefer `BOARD_MAX_ROWS`-style budgets over hard-coded silent slices. Return upstream `total` + `truncated` / `has_next_page` so the UI can show “showing X of N”. |
| **Best-effort upstream enrichment must not gate the response** | Optional Qobrix OR-batch enrichment (contracts, campaigns, …) sits behind a soft deadline. On expiry return what is resolved and continue; never `catch {}` a fan-out that can burn tens of seconds of 12s `qFetch` aborts. Prefer App DB mirrors when the enrichment already lives there. |
| **Prefer an App-DB opportunity mirror for the pipeline board** | `qobrix_opportunity_mirror` (cron-synced, tenant-global on `external_qobrix_id`) serves board reads from denormalized columns when fresh; live Qobrix is the fallback. Do not round-trip `raw_qobrix` on the read path. Keep MSA `opportunities` as copy-on-write SoT — do not dump mirrored rows into it. |
| **Never issue a second full-collection fetch to resolve one record** | Detail pages and pickers must not call the full board just to find one id. Use a single-row action (`opportunity_board_row`) or a capped search-driven query. |
| **Tenant-global lookups may be cached in Postgres** | Qobrix user display names, reference vocab, developer mirror — identical for every viewer. Precedent: `developer_cache`, `qobrix_reference_cache`, `qobrix_user_cache`, `qobrix_opportunity_mirror`. |
| **Per-agent-scoped payloads must NOT be shared across viewers** | Qobrix scopes record visibility per logged-in agent; board rows are further filtered by SSO scope. Never cache opportunity/contact lists tenant-wide without session isolation. |
| **POST-invoked EFs cannot use HTTP `Cache-Control`** | The SPA calls EFs via `supabase.functions.invoke` (POST). CDN/ETag caching does not apply; optimise upstream parallelism and Postgres mirrors instead. |
| **Instrument before/after** | Emit one structured JSON timing line per request (`ef`, `tab`, `ms_total`, `phases`) — same pattern as `listings-search` monitoring. |

### Cache discipline for tenant-global Postgres mirrors

A Postgres mirror that is never re-synced is a **frozen cache**: it serves confidently
wrong data forever. `_shared/qobrix-users.ts` is the reference implementation — any new
mirror (`developer_cache`, `qobrix_reference_cache`, …) must satisfy all seven rules.

| Rule | Why |
|---|---|
| **Write `synced_at` and read it.** Rows older than a TTL (6h for user names) trigger a refresh. | Without this a renamed or newly hired user renders a raw UUID indefinitely. A `synced_at` column that is only ever written is a latent bug. |
| **Stale-while-revalidate — never block a user on a refresh.** Serve the cached row, then refresh behind the response with `EdgeRuntime.waitUntil`. | Refreshing inline turns one unlucky request into the slowest of the hour. Use the **oldest** `synced_at` of the rows read as the staleness signal, not the newest. |
| **Re-enter the Qobrix session explicitly for background work** via `runInSession(currentQobrixSession(), …)`, captured synchronously during the request. | A task that outlives its request loses the AsyncLocalStorage session and every `qFetch` inside it fails 401. |
| **Negatively cache ids the upstream has no record of.** | Deactivated users still own open records. Without a negative cache a single unresolvable id re-sweeps the entire upstream directory on *every* request — the cache silently stops working while still looking correct. |
| **Cooldown + single-flight on the expensive refresh.** One sweep per isolate per window (failures start the cooldown too), and concurrent callers share the in-flight promise. | Bounds worst-case upstream load and stops a stampede on cold start or upstream outage. |
| **Every call site must pass the tenant scope.** Omitting `tenantId` skips the Postgres tier and buckets the memory map under a shared `__global__` key. | The Calendar agenda tab shipped this way — it paid for a full `/users` directory sweep on every cold isolate while the board sat on a warm Postgres mirror. Latent cross-tenant name mixing too. |
| **A stale hot tier refreshes from the next tier down, never straight from upstream.** Memory TTL (5 min) ≪ Postgres TTL (6 h). Stale memory → background `readPgCache` + re-stamp; escalate to a directory sweep only when Postgres itself is past TTL. | Otherwise a busy isolate sweeps upstream every cooldown window forever and the middle tier is decorative. |

Emit per-tier hit counters (`owner_cache:{mem,pg,upstream,negative,unresolved,swept}`) in the
timing line. A cache whose hit rate cannot be read from logs cannot be trusted to work.

### Read-only overlays must never gate primary render

Optional overlays (Outlook calendar via Microsoft Graph, ICS subscription status, …)
may stream in after the primary Qobrix / App-DB data. **Do not** fold overlay
`isLoading` into the page-level skeleton gate — Graph status latency then blocks
every user, including those who never connected the overlay. Pattern: render as
soon as primary queries resolve; merge overlay events reactively; use
`placeholderData: keepPreviousData` so range navigation does not blank the grid.

## Cross-Reference

| For | See |
|---|---|
| CDL schema (`properties_published` and 8 RESO resource tables) | [data-models/cdl-schema.md](../data-models/cdl-schema.md) |
| Read-path indexes + perf migration source | `matrix-platform-foundation/supabase/cdl/migrations/20260426140000_cdl_properties_published_perf_indexes.sql` |
| Phase-2 intelligence layer (semantic search, recsys, MCP, syndication) | [architecture/intelligence-layer.md](../architecture/intelligence-layer.md) |
| Personalization + recommendation engine spec | [product-specs/personalization.md](../product-specs/personalization.md) |
| Deployment, monitoring, DR | [operations.md](operations.md) |
| MLS 2.0 pipeline | [mls-datamart.md](mls-datamart.md) |
