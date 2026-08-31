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

## Digital Employees turn latency

Digital Employees measures conversational latency separately from CDL read
latency. The primary user-facing metric is **time to first text delta (TTFT)**,
not total completion time:

| Turn shape | Target |
|---|---|
| No-tool turn | TTFT ≤ 1.5 s |
| Tool-calling turn | Record TTFT and `first_hop_ms`; do not gate release on the no-tool target |
| Optional follow-up chips | Best-effort deadline of 4 s; an expired deadline returns an empty chip list |

Follow-up chips and Agent Assist drafts use the light **helper** model path.
An unset employee follow-up / assist model field keeps
`google/gemini-3.1-flash-lite` (via `resolveHelperModel`). An explicit `auto`
resolves the workspace `auto_helper` platform role (same default). They must
not inherit `auto_chat`, which is sized for conversational replies and routinely
misses the chip deadline.
| Agent Assist drafts | Awaited in the assisted response, with a 20 s safety deadline; drafts are not optional chips |

The chip deadline is a transport contract, not permission to change the
response shape. Teams `suggestedActions`, WhatsApp interactive buttons, the
`/converse` response, A2A artifact metadata, and Playground SSE suggestions
remain inline surfaces. If chip generation misses the deadline, it continues behind
the response via `EdgeRuntime.waitUntil` and persists to `runs.suggestions` for
thread reopen. Assisted drafts remain in the response payload and use the safety
deadline above rather than the chip deadline.

The critical path ends after the assistant message is persisted, the run is
settled, and the conversation lock is released. Memory consolidation,
suggestion completion, and trace export are post-turn work and must run after
that boundary. Background work must be best-effort and must never make a
successful assistant reply fail.

Every run records `queue_ms`, `first_token_ms` from request receipt to the first text delta where streaming is available,
`first_hop_ms` for tool turns, `post_ms`, and input/output token counts. Each
`run_steps` checkpoint records a real duration; each tool hop is recorded with
its hop number and result byte count. Compare p50/p95 over a rolling seven-day
window, and report no-tool and tool turns separately before changing model or
prompt defaults.

Prompt assembly keeps stable job, policy, channel, and tool-guidance blocks
before volatile runtime, caller, memory, and retrieval blocks. History is
trimmed before the latest user message is dropped; memory and cumulative tool
results have explicit ceilings and report truncation. This follows the same
instrument-before/after discipline and `EdgeRuntime.waitUntil` stale-while-
revalidate boundary used by the read paths below.

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

**Reading the Supabase performance advisor:** it is a generic linter and its
`unindexed_foreign_keys` findings are row-count blind. On the MSA App DB every
table it flagged held 0-360 live rows (`leads`: 7 rows with 18 indexes already),
where a sequential scan beats an index probe and each added index is pure write
amplification on the sync path. Check `pg_stat_user_tables.n_live_tup` before
acting. `duplicate_index` and `auth_rls_initplan` are worth taking regardless —
the former is free, the latter is a `(SELECT current_setting(...))` wrap that
preserves semantics exactly.

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

## Client transport & bundle (all Matrix SPAs)

The SPAs reach Edge Functions over `supabase.functions.invoke` (POST), so the HTTP
cache rules above do not apply. Two things still dominate what the user waits for.

| Rule | Why |
|---|---|
| **Set `Access-Control-Max-Age` on the preflight response.** | A cross-origin POST with an `Authorization` header is never a simple request, so the browser must preflight it. `corsHeaders` from `npm:@supabase/supabase-js@2/cors` does **not** include a max-age, and Chrome then caches the preflight for ~5s — measured on MSA: 1,282 `OPTIONS` in 8 hours at 138-721 ms each, every one a blocking round trip to the function region ahead of the real request. `7200` is Chrome's ceiling; larger values are clamped. Own this in a single `_shared/cors.ts` rather than importing the SDK object in every function. |
| **A slow `OPTIONS` is almost never cold start.** | Edge Function boot on this platform measures 20-34 ms. When a preflight costs hundreds of ms it is network to the function region, so caching the preflight is the only lever — there is no boot to optimise away. |
| **Code-split by route.** | Statically importing every page into `App.tsx` compiles the whole app into one chunk: MSA shipped 5.9 MB / 1.57 MB gzipped to every user on every first load, including `mapbox-gl` and `recharts` for users who never opened a map or a report. Lazy routes took the initial payload to 403 KB gzipped. Put the `Suspense` boundary *inside* `SidebarLayout` so the shell stays mounted while a chunk loads. |
| **Keep auth-path routes eager.** | Lazy-loading `Auth` / `AuthCallback` adds a chunk fetch to the OAuth redirect and eats into the ≤800 ms code → first-authenticated-paint budget above. |
| **Do NOT name a route-only library in `manualChunks`.** | Naming it makes Rollup hoist the chunk into the entry's static imports and Vite then emits a `modulepreload` for it, so the "split out" library is downloaded by everyone on first paint anyway. Verify by grepping the built `index.html` for the chunk name. Pin only genuinely global libraries (`react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`) — there the separate chunk is what survives in cache across a several-deploys-a-day cadence, since `index.html` is `no-store` while hashed assets are `immutable`. |

**Status (2026-08-31):** only `matrix-sales-automation` sets a preflight max-age.
`matrix-itsm`, `matrix-digital-employees`, `matrix-hrms`, `matrix-pipeline-2-0`,
`matrix-qobrix-sales-automation-rls`, `matrix-atlas-mls` and
`matrix-apps-template-2-1` all still import the SDK `corsHeaders` unchanged and
pay a preflight per call. Fixing the template first stops new apps inheriting it.

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

**Preview-first materialize (CRM).** Opening a Qobrix-only lead / opportunity /
contact / contract is a single authenticated Qobrix GET via
`qobrix-materialize` `preview` — no App DB write. Explicit `copy` is one GET +
one App DB insert (and optional claim row). On-demand `sync` is one GET +
fill-blanks UPDATE + mismatch upserts; it must not overwrite populated fields
or change assignee. Do not auto-copy on drawer open (that doubled write load
and raced ownership claims). Listings remain a queued remirror (media
delete-then-insert) and must not share the CRM sync code path.

| Rule | Rationale |
|---|---|
| **Upstream fan-out is the dominant cost** — sequential paginated `GET` loops and per-row enrichment (N+1) dominate latency, not App DB round trips. | Parallelise paginated upstream reads (bounded concurrency, preserve page order). |
| **Push viewer scope into the upstream search** | The MSA pipeline board resolves SSO scope *before* fetching Qobrix pages (`owner==` + local-reassignment `id==` union for restricted viewers). Do not download the tenant-wide open set and filter in JS — that forces a silent row cap and makes every broker pay the admin’s cost. |
| **Named safety ceilings must report truncation honestly** | Prefer `BOARD_MAX_ROWS`-style budgets over hard-coded silent slices. Return upstream `total` + `truncated` / `has_next_page` so the UI can show “showing X of N”. |
| **Best-effort upstream enrichment must not gate the response** | Optional Qobrix OR-batch enrichment (contracts, campaigns, …) sits behind a soft deadline. On expiry return what is resolved and continue; never `catch {}` a fan-out that can burn tens of seconds of 12s `qFetch` aborts. Prefer App DB mirrors when the enrichment already lives there. |
| **Prefer an App-DB opportunity mirror for unrestricted viewers only** | `qobrix_opportunity_mirror` is harvested under the shared `QOBRIX_SHARE_*` account and has no RLS. Serve it only to `global` / `org_admin` / `system_admin`. Restricted viewers (`self` / `team`) must `qFetch` live as the caller so Qobrix's ACL is the authority (ADR-044 D3c/D3d). Require `viewerScope: { unrestricted: true }` on mirror query helpers; guardrail `check_mirror_viewer_scope.mjs`. |
| **Prefer an App-DB contract mirror for Contracting/Payment** | `qobrix_contract_mirror` (cron-synced, tenant-global) feeds buyer-contract column hints. Never revive the live `/contracts` OR-batch on the board path. MSA `public.contracts` wins when present; copy-on-open from the mirror populates it. |
| **Never issue a second full-collection fetch to resolve one record** | Detail pages and pickers must not call the full board just to find one id. Use a single-row action (`opportunity_board_row`) or a capped search-driven query. |
| **Tenant-global lookups may be cached in Postgres** | Qobrix user display names, reference vocab, developer mirror — identical for every viewer. Precedent: `developer_cache`, `qobrix_reference_cache`, `qobrix_user_cache`, `qobrix_opportunity_mirror`, `qobrix_contract_mirror`. |
| **Per-agent-scoped payloads must NOT be shared across viewers** | Qobrix scopes record visibility per logged-in agent; board rows are further filtered by SSO scope. Never cache opportunity/contact lists tenant-wide without session isolation. |
| **POST-invoked EFs cannot use HTTP `Cache-Control`** | The SPA calls EFs via `supabase.functions.invoke` (POST). CDN/ETag caching does not apply; optimise upstream parallelism and Postgres mirrors instead. |
| **Instrument before/after** | Emit one structured JSON timing line per request (`ef`, `tab`, `ms_total`, `phases`) — same pattern as `listings-search` monitoring. |
| **A phase that wraps concurrent work only reports the slowest member** | `Promise.all` under one `timing.run('enrich', …)` hides which resolver is slow. Wrap each member in its own `timing.run` — they still run concurrently and each records its own span. MSA's agenda showed `enrich 12,574ms`; split apart it was `enrich_contacts 12,572` vs `enrich_campaigns 222` / `enrich_owners 178` / `enrich_reasons 83`. |
| **Bound every per-id fallback on width, timeout AND total budget** | An OR-batch followed by `Promise.all(missed.map(…))` with default timeouts is a latency bomb: 200 unresolved MSA agenda contacts fired 200 concurrent `GET /contacts/{id}` that all hit the 12,000ms `qFetch` abort, so the phase measured 12,572ms. A phase whose duration ≈ the `qFetch` timeout is mass-timeout, not slow I/O. Cap concurrency, shorten the per-request timeout, add a wall-clock budget, and return what resolved. |

### Measured: MSA read paths, 2026-08-31

Before/after on the same tenant and traffic shape. The "before" column is p50 over
115 `qobrix-pipeline` and 130 `qobrix-crm-mirror` requests in an 8-hour window.

| Surface | Before (p50) | After | What it was |
|---|---|---|---|
| `qobrix-pipeline` `opportunities_board` | 8,000 ms | **2,004 ms** | `campaign_names` 5,133-7,293 ms → 186 ms once the campaign map moved to the Postgres tier |
| `qobrix-crm-mirror` `leads` | 4,189 ms | **1,062 ms** | same campaign sweep, plus serial owner/campaign hydration |
| `qobrix-pipeline` `board_stages` | 8,689 ms | instrumented | `getCampaignsMap` sat outside any `timing.run`, so ~8s of an 8.7s request was invisible |
| `qobrix-pipeline` `opportunity_board_row` | 6,569 ms | instrumented | same untimed campaign lookup on the single-deal path |
| `qobrix-pipeline` `agenda` | 13,174 ms | fallback bounded | `enrich_contacts` was 200 concurrent per-id GETs timing out at 12s |

Two lessons worth generalising: an `ms_total` far larger than the sum of its
`phases` means the expensive call is not wrapped in a span, and a phase duration
that matches the upstream client's abort timeout means concurrent timeouts rather
than a slow dependency.


### Safety properties carried by transport

If a permission guarantee depends on **who** the upstream call authenticates as
(per-user bearer token), switching the read to a shared cache harvested under a
service account removes that guarantee without a visible “permission” diff.
The MSA Leads list did this on 2026-08-28 (mirror cutover) after `98dc263b`
correctly deferred to Qobrix — brokers then saw ~46k leads / 66 owners with
contact phone and email. Mitigations that stick: (1) refuse the privileged
cache for restricted scopes at the API boundary, (2) fail closed on PII for
unowned rows, (3) a CI guardrail on call sites.

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
