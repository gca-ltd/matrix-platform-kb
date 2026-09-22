# Microsoft Teams channel — Digital Employees

Digital Employees reach Microsoft Teams through a **Bot Framework** adapter (`teams-webhook` edge function) on app DB project `mihslqjjclbrqelnjjpb`. Each Teams channel row in `public.channels` gets its own webhook URL:

```text
POST https://mihslqjjclbrqelnjjpb.supabase.co/functions/v1/teams-webhook/<channelId>
```

Register that URL as the bot **messaging endpoint** in the Teams Developer Portal. Inbound activities are verified with Bot Framework JWKS (`login.botframework.com`); outbound replies use the Bot Connector API (`{serviceUrl}/v3/conversations/.../activities`).

**Related:** [ADR-032 — Chat agent over Teams/WhatsApp/Telegram](../architecture/decisions/ADR-032.md), [App catalog — Digital Employees](app-catalog.md), repo `gca-ltd/matrix-digital-employees`.

---

## Inbound activity routing

| `activity.type` | Handled | Behaviour |
|---|---|---|
| `message` | Yes | Strip `<at>…</at>` mentions, run agent turn, reply |
| `installationUpdate` (`action: add`) | Yes | Upsert `channel_installations`, send welcome (if enabled) |
| `installationUpdate` (`action: remove`) | Yes | Stamp `removed_at` on installation row |
| `installationUpdate` (`add-upgrade` / `remove-upgrade`) | Yes | Record only — **no** welcome |
| `conversationUpdate` (bot in `membersAdded`) | Yes | Same welcome path as install-add |
| `conversationUpdate` (human member added) | No | Ack only |
| `invoke`, `typing`, others | No | Ack only |

JWT verification follows ADR-032: `verify_jwt: false` on the EF; custom `jwtVerify` against Bot Framework JWKS with audience = `channels.config.bot_app_id`.

---

## Follow-up prompt surfaces (`suggestion_style`)

AI follow-up suggestions (`runs.suggestions`, generated in `_shared/suggestions.ts`) can render five ways per channel (`channels.config.suggestion_style`):

| Style | Reply body | Prompt UI | Addresses without @mention | Notes |
|---|---|---|---|---|
| `card` (default) | Adaptive Card attachment | Card-root `Action.Submit` + `msteams.messageBack` | No | Buttons inside the bubble; identical in 1:1, group and channel. Cold group/channel still needs a manual `@` (or use `submit`). |
| `chips` | Plain markdown `message` | `suggestedActions` + `imBack` below bubble | No | `inputHint: expectingInput`; smart replies in `personal`, persisted in `team` / `groupChat`. Tap posts a user-visible message. |
| `compose` | Plain markdown `message` | `suggestedActions` + `Action.Compose` | No | Prefills compose box (experimental). |
| `submit` | Plain markdown `message` | `suggestedActions` + `Action.Submit` | **Yes** | Tap sends a `suggestedAction/submit` **invoke** straight to the bot — no user-visible message. The reply restates "You asked: …" so other participants can follow. |
| `off` | Plain markdown `message` | None | — | No follow-up prompts |

**Platform constraint (Microsoft Teams):** `suggestedActions` are **not supported on messages with attachments**. An Adaptive Card is an attachment, so card-style replies and below-bubble chips are **mutually exclusive**. The Channels UI sets `reply_format` and `suggestion_style` together.

**Payload parity:** every `suggestedActions` payload includes `to: [activity.from.id]` (matching Microsoft SDK samples) and suggestion titles are capped at 25 characters — longer titles make Teams drop chips silently ([OfficeDev/Microsoft-Teams-Samples#1465](https://github.com/OfficeDev/Microsoft-Teams-Samples/issues/1465)).

**Addressing (`suggestions_mention_bot`):** **retired — not exposed in the UI, ignored by the runtime.** A Graph bot mention in an `Action.Compose` `chatMessage` made Teams discard the entire `suggestedActions` set (observed 2026-08-28, group chat, `text_format: markdown`). The Channels UI no longer shows a mention switch; autosave still writes `false` to scrub stale config. Revival point: flip `MENTION_SUGGESTIONS_SUPPORTED` to `true` in `_shared/teams-activity.ts` and retest. Until then, use `suggestion_style: "submit"` so taps reach the employee without a mention. Sources: [suggested actions](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/suggested-actions) (`Action.Submit` / `suggestedAction/submit`), [channel and group conversations](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-and-group-conversations).

**Scope behaviour:** `suggestedActions` are supported in **all scopes**, but not identically — in `personal` they render as smart replies, so only the actions on the **latest** message remain visible, while in `team` and `groupChat` they are saved with the message and stay on it. `card` prompts persist everywhere. Teams shows at most **three** actions regardless of style, which is why `buildTeamsReply()` slices to three.

> Earlier revisions of this doc claimed `suggestedActions` were personal-scope only. That was true of the 2022 guidance and is no longer correct — see the Microsoft Learn `suggested-actions` page (doc date 2026-08-19), which documents all three scopes with screenshots.

**Card polish (both applied by default):**

- Each card suggestion `Action.Submit` carries action-level `msTeams: { feedback: { hide: true } }`, which suppresses Teams' *"Your response was sent to the app"* system line under the card on every tap. The lowercase `data.msteams.messageBack` payload is what echoes the prompt as a user message and stays untouched. (Suggested-action `Action.Submit` for the `submit` style is a different contract — it fires `suggestedAction/submit` with no user bubble.)
- `channels.config.card_header` (default `true`) controls the in-card avatar + name `ColumnSet`. Set `false` to drop it — Teams already renders the bot avatar and name above the bubble, so the header is a duplicate. Card style only; ignored by `chips` / `compose` / `submit`.

**Why card `Action.Submit` and not `Action.Execute`:** Microsoft's card-actions doc marks `Action.Submit` legacy and recommends `Action.Execute` for new work. Do **not** migrate the **card** surface:

- `Action.Execute` sends an `adaptiveCard/action` invoke with **no user-visible message**, so a tapped prompt would never appear as the person's turn in the transcript. The whole point of `msteams.messageBack` is that echo.
- `msTeams.feedback.hide` is supported on card `Action.Submit` **only** — with `Action.Execute` the "Your response was sent to the app" line comes back and cannot be suppressed.

The separate `suggestion_style: "submit"` surface deliberately uses the no-visible-message invoke path for cold group addressing.

Back-compat: when `suggestion_style` is absent, `reply_format === 'text'` maps to `chips`; otherwise `card`. When `card_header` is absent it defaults on, preserving pre-toggle rendering.

Implementation: `supabase/functions/_shared/teams-activity.ts` → `buildTeamsReply()` (style + `resolveCardHeader()`), `_shared/adaptive-card.ts` → `buildReplyActivity()` (`showHeader`), `teams-webhook` handles `suggestedAction/submit` invokes.
---

## Output format contract (system prompt)

Channel turns inject a **`channel_format`** system-env block so the model only emits formatting the outbound surface can render. Playground turns inject the same block with the explicit `playground` surface (via `agent-chat`), so chart and other image URLs are embedded as `![alt](url)` rather than bare links.

**Implementation:** `_shared/channel-format.ts` → `resolveChannelFormat(kind, config)` returns `{ surface, rules }` for channel rows; Playground passes `"playground"` directly → `renderChannelFormatBlock()` in `_shared/agent-run.ts` (channels) and `agent-chat` (playground).

**Where to edit:**

| Piece | Where | Key |
|---|---|---|
| Prompt wrapper (`## Output format for this channel` + `{{channel}}` / `{{rules}}`) | Employee **System** tab | `employees.system_env.channel_format` |
| Per-channel rules text | Employee **Channels** tab → each channel card | `channels.config.format_rules` (empty = platform default for the resolved surface) |
| Teams wire format | Channels tab → Extended markdown switch | `channels.config.text_format` = `markdown` (default) or `extendedmarkdown` |

| Surface | When | What the model is told (defaults from vendor docs) |
|---|---|---|
| `teams-text` | Plain message + `text_format` unset/`markdown` | Safe cross-client: bold, italic, inline/preformatted code, blockquote, links. Lists desktop-only. No headings / HR. When a tool returns a chart or image URL, emit `![short description](url)` on its own line — the outbound path lifts it into an Adaptive Card `Image`. Tables not in the documented standard subset — if unavoidable, blank line + GFM separator, ~4 cols. |
| `teams-text-extended` | Plain message + `text_format: extendedmarkdown` | CommonMark + tables, task lists, fenced code, math, images. Headings from `###`. Only `<at>Name</at>` HTML. Microsoft **public developer preview**. |
| `teams-card` | `suggestion_style: "card"` (default) | Adaptive Card `TextBlock`: bold, italic, lists, links only. No tables, headings, preformatted, blockquotes. Prefer bold labels. Chart/image URLs as `![alt](url)` are lifted into Adaptive Card `Image` elements on the same card. |
| `whatsapp` | WhatsApp channel | WhatsApp syntax, not Markdown: `*bold*` (one asterisk), `_italic_`, `~strike~`, backticks, `- `/`1. ` lists, `> ` quotes. No headings / MD links / tables. |
| `api` | Conversations API | Full GFM; integrator renders. Embed images as `![short description](url)` rather than bare URLs. |
| `a2a` | A2A peer | **Plain text** — our agent card advertises `text/plain` and parts have no `mediaType`. No Markdown. |
| `playground` | Sharp Matrix playground (web chat) | Full GFM including math and images. When a tool returns an image URL, embed it as `![short description](url)` on its own line; do not also paste the bare URL. Passed explicitly by `agent-chat`, not via a channel row. |

**Typing indicator / redelivery:** `teams-webhook` acknowledges the message activity immediately (`EdgeRuntime.waitUntil`) and starts typing only from `onTurnAccepted` after `claimThreadRun` wins the conversation lock. Duplicates, queued turns, and unaddressed group messages produce no typing. At most one "Neo is typing" per conversation. A background turn that throws is logged as `failed` and is **not** retried (the early 200 prevents Bot Framework redelivery); check the function logs rather than waiting for a second attempt. `thread_busy` turns are still parked as `queued` for `inbound-drain`.

**Why the blank-line + extendedmarkdown matter:** a reply that stored `**Топ:**\n| Брокер | …` rendered as a run-on line in Teams under `textFormat: markdown`. Tables are formally documented under `extendedmarkdown`; enable that channel setting for reliable table rendering.

**Microsoft / WhatsApp / A2A references:**

- [Format your bot messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/format-your-bot-messages) — `textFormat` values, standard vs extended markdown, per-platform matrix
- [Format cards in Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format) — Adaptive Card `TextBlock` subset
- [WhatsApp Help Center — How to format your messages](https://faq.whatsapp.com/539178204879377)
- [A2A specification](https://a2a-protocol.org/latest/specification/) — `Part` / agent-card input/output modes

Config keys (format-related, all in `channels.config` jsonb): `suggestion_style`, `reply_format`, `card_header`, `text_format`, `format_rules`; deprecated/ignored: `suggestions_mention_bot`.

---

## Images and charts

Teams standard markdown and Adaptive Card `TextBlock` both **ignore** `![alt](url)`. The only documented way to show an image is an Adaptive Card `Image` element ([cards-format](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format)).

Outbound path (`_shared/teams-images.ts` → `buildTeamsReply()`):

1. Extract up to three `https` image URLs from `![alt](url)` embeds and bare image-URL lines (`.png` / `.jpg` / `.jpeg` / `.gif`).
2. Strip those embeds from the text so Teams never shows literal `![chart](…)`.
3. **Card style:** append `Image` elements (with `msTeams.allowExpand` for Stage View) to the existing Adaptive Card body; skip duplicate `Action.OpenUrl` buttons for the same URLs.
4. **Text styles (chips / compose / submit / off):** send an image-only Adaptive Card activity **first**, then the plain-text bubble with `suggestedActions`. Attachments and `suggestedActions` cannot share a message, and in personal scope only the latest message keeps its chips — so the image must precede the text.

Chart PNG hosting (`https://intranet.sharpsir.group/charts/o/…`) is anonymous static Apache (`Require all granted`) so Teams' cloud fetchers can retrieve the image. Retention is `CHARTS_RETENTION_HOURS=2160` (90 days) on `sharpsir-charts-mcp-server` — Teams re-fetches card images when history is scrolled, so a short retention would blank charts in old threads.

---

## Adaptive Card rendering contract

Insights are **not** sent as PNGs to Teams. They render as native Adaptive Card
chart elements, so the numbers stay selectable, themeable and accessible. The
whole contract is machine-checked by `supabase/functions/_shared/teams-card-schema.ts`
and asserted in `teams-insights_test.ts`.

**Teams validates cards on the client, silently.** An element it does not know
is dropped; an enum value outside the documented range is ignored. Nothing fails
server-side and nothing reaches a log — a wrong value ships as an empty gap in
somebody's chat. Assume no runtime signal and rely on the test.

### Schema version — pinned at 1.5

Every card root declares `"version": "1.5"`. `version` is the **minimum** the
host must support: a client below it renders `fallbackText` instead of the body,
and declaring a version lower than the features used (the old `1.2` on the reply
card) is simply a version the card does not honour.

Microsoft's own documentation contradicts itself, so the pin is deliberate:

| Source | Says |
|---|---|
| [cards-reference](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-reference) (published) | Teams supports "v1.6 or earlier"; mobile 1.6 |
| [cards-reference.md](https://github.com/MicrosoftDocs/msteams-docs/blob/main/msteams-platform/task-modules-and-cards/cards/cards-reference.md) (its own source) | "v1.5 or earlier"; mobile 1.2 |
| Copilot Studio card reference | "Teams is also limited to version 1.5" |
| [charts-in-adaptive-cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/charts-in-adaptive-cards) | All 8 chart samples declare `1.5` |
| [AdaptiveCards#9378](https://github.com/microsoft/AdaptiveCards/issues/9378) | Open regression: 1.6 cards fail to render in Teams |

There is **no API to query a client's version**; the only documented method is
behavioural — declare a version and see whether the body or `fallbackText`
renders. Measured on the Sharp tenant 2026-09-22 (desktop build
`26225.1806.5074.1452` and mobile): both render a `1.6` body, so 1.5 is pinned
with headroom rather than at the edge.

A nested `Action.ShowCard.card` inherits the host card's schema and declares
**neither** `$schema` nor `version` — matching Microsoft's nested-ShowCard sample.

### Insight block → Teams element

The `InsightSnapshot` envelope (`{ schemaVersion, artifactId, sequence, state,
title, widgets[] }`) is defined in `_shared/insight-widgets.ts`; the 34 block
kinds and their data shapes in `_shared/insight-catalogue.ts`. Teams renders
them as:

| Teams element | Insight kinds |
|---|---|
| `Chart.Line` | `chart` (line/area), `small_multiples` |
| `Chart.VerticalBar` | `chart` (bar, single series, short labels) |
| `Chart.VerticalBar.Grouped` | `chart` (multi-series / stacked), `dumbbell`, `slope` |
| `Chart.HorizontalBar` | `funnel` (`AbsoluteNoAxis`), `waterfall`, `polar`, `dot`, `lollipop`, long-label bars |
| `Chart.HorizontalBar.Stacked` | `share_bar` |
| `Chart.Donut` / `Chart.Pie` | `donut`, `breakdown` / `pie` |
| `Chart.Gauge` | `gauge`, `goal`, `bullet` |
| `Table` | `table` |
| `ProgressBar` | `progress_set`, `progress` |
| `Badge` | `status_badges` |
| `Rating` | `rating` |
| `ColumnSet` | `kpi_tiles` |
| `TextBlock` | `callout`, `summary` |
| `FactSet` | `stat`, `metrics`, `ranked_list`, `next_actions`, `comparison`, `timeline`, `assumptions`, `sources`, `scatter`, `quadrants` |

Rules that hold for every kind:

- Each block is a `Container` with a bold title, optional description and an
  optional `As of` line, separated from the previous block.
- Every element above the 1.2 core carries a **`fallback`** restating the same
  numbers as a `Container` of `TextBlock` / `FactSet`. A client that does not
  know the type renders the fallback; one that knows it but cannot draw it shows
  a gap, which is why chart blocks also emit a text line.
- **`Chart.Gauge` must carry `min` and `max`.** Without them the needle sits on
  an implicit 0-based dial, so a gauge running 60–95 reads at the wrong angle
  beside a correct number. The scale is **derived, never passed through**: it is
  ordered and widened to contain both the value and the bands, because an
  inverted pair or a value outside the range draws a broken dial — worse than
  the default Teams picks when neither is given. `bullet` spans
  `min(0, ranges, actual, target)` to `max(ranges, actual, target)`, so an
  over-target actual still lands on the face and an all-negative variance
  bullet keeps a real scale instead of being clipped at zero.
- A set arrives **collapsed** behind Teams' own `Action.ShowCard`, so the chat
  stays a conversation.
- Positive / destructive action styling is unsupported in Teams.

### Design tokens — nearest match, never exact

Adaptive Cards accept only named `ChartColor` tokens, **never hex**, so the app
palette maps to the closest token rather than reproducing it:

| App token (`src/index.css`) | HSL | Teams `ChartColor` |
|---|---|---|
| `--chart-1` | 199 89% 48% (sky) | `categoricalLightBlue` |
| `--chart-2` | 213 47% 30% (navy) | `categoricalBlue` |
| `--chart-3` | 174 62% 37% (teal) | `categoricalTeal` |
| `--chart-4` | 38 92% 50% (amber) | `categoricalMarigold` |
| `--chart-5` | 266 55% 58% (violet) | `categoricalPurple` |
| `--chart-6` | 215 16% 47% (slate) | `neutral` |

Series 7+ continue through the remaining categorical tokens. `--chart-1` is
`--primary`, which a tenant rebrands at runtime — the Teams card therefore
tracks the **default Sharp sky blue** and cannot follow a tenant brand colour.
Order is what matters: series 2 of a block is the same slot in both surfaces.

### Size budget and degradation

Teams caps a bot message at **100 KB** (28 KB for an Incoming Webhook). Two
tighter budgets sit under it, and they must be read together:

| Budget | Value | Enforced in |
|---|---|---|
| Widget payload accepted from the model | 48 KB | `validateInsightWidgets()` |
| Insight card body | 20 KB | `fitTeamsCard()` in `teams-insights.ts` |
| Whole outbound activity | 25 KB | `withinTeamsBudget()` in `teams-activity.ts` |

Every chart duplicates its data as a `fallback`, so a rendered set runs two to
three times the payload behind it. Degradation is graded: `fitTeamsCard()` drops
blocks **from the end** until the body fits, appending a line that **names** the
dropped blocks so the reader knows what to ask for, and falls back to a single
explanatory `TextBlock` only if even one block will not fit. Fallbacks are never
stripped to save bytes, and the collapsed chip is labelled from the blocks that
survived rather than the snapshot length — a chip promising eight views over a
card holding one is its own defect. The activity gate is the last resort and is
all-or-nothing: it replaces every drawn block with the markdown summary, which
is what the body budget exists to avoid.

In practice the budget is far from binding — a full eight-block body measures
~5.4 KB and a card reply with an 8,000-character answer ~15.3 KB — so trimming
is a safety net, not a routine path.

### Known limitations

- **Charts do not render in Developer Portal.** Its card editor rejects
  `Chart.*`, `Badge` and `ProgressBar` as unknown elements and strips them —
  together with their `fallback` — before sending, so it cannot be used to probe
  those. Verify through the bot itself.
- **Charts on Teams mobile are unreliable** ([Teams-AdaptiveCards-Mobile#314](https://github.com/microsoft/Teams-AdaptiveCards-Mobile/issues/314)).
- **`ProgressBar` does not render in Copilot chat** ([msteams-docs#13220](https://github.com/MicrosoftDocs/msteams-docs/issues/13220)).

### Changing any of this

`npm run test:ef` (wired into `.github/workflows/build.yml`) walks every
catalogued kind **and the whole reply card** — `adaptive-card.ts` contributes
the avatar `ColumnSet`, the approval `TextBlock` and the action set — asserting
the element allow-list, enum values, fallback presence, gauge scale, declared
version and size budget. Adding a block type that emits an element Teams cannot
draw fails there rather than in a chat.

Two traps when extending it:

- **A walk over a card must skip `data`, `suggestedActions`, `msTeams`,
  `channelData` and `entities`** (`NON_CARD_KEYS`). Those hold Bot Framework
  payloads with their own `type` vocabulary — an activity is `message`,
  `Action.Submit`'s `data.msteams.type` is `messageBack`, a suggested action is
  `imBack` — none of which is an Adaptive Card element.
- **Assert over hostile input, not only the catalogue examples.** Every example
  is well-formed, so an assertion like "the gauge scale is valid" passes while
  malformed model output still renders a broken dial. Both gauge defects found
  in review were invisible to a test that only walked the examples.

---

## Install welcome

On `installationUpdate` add or bot-self `conversationUpdate`, the webhook:

1. Upserts `public.channel_installations` (conversation reference for future proactive delivery).
2. Checks `welcome_enabled` (default true), `welcomed_at` (idempotent), and roster size ≤ `welcome_max_members` (default 100).
3. Builds welcome text from `welcome_message` or auto-drafts from employee persona + manifest `mf_commands`.
4. Sends via `buildTeamsReply()` so starter prompts use the channel's `suggestion_style`.
5. Stamps `welcomed_at`.

**Do not** welcome on: team rename, human member add, roster over threshold, or `add-upgrade` / `remove-upgrade`.

Config keys (all in `channels.config` jsonb): `welcome_enabled`, `welcome_message`, `welcome_max_members`, `suggestion_style`, `reply_format`, `card_header`, `text_format`, `format_rules`; deprecated/ignored: `suggestions_mention_bot`.

---

## `channel_installations` table

| Column | Purpose |
|---|---|
| `channel_id` + `external_thread_id` | Unique per Teams conversation |
| `service_url` | Bot Connector base URL from install activity |
| `conversation_reference` | Full activity snapshot (recipient, tenant, team, channelData) |
| `installed_by_*` | Installer identity from install activity |
| `welcomed_at` | One-time welcome gate |
| `removed_at` | Set on `installationUpdate` remove |

RLS: tenant-scoped SELECT for authenticated; writes via service-role EF only.

This table is the prerequisite for **proactive Teams delivery** (scheduled runs today no-op for Teams in `schedule-run.ts`).

---

## Manifest vs runtime prompts

Two separate systems:

- **Manifest `commandLists`** (`mf_commands` in channel config) → Teams app card "Try these prompts" at install time (static).
- **Runtime `suggestions`** → AI-generated per turn (or welcome), rendered per `suggestion_style`.

---

## Deploy

- **Frontend:** push `main` → github-watcher → `/digital-employees/`.
- **Migration + EF:** Lovable MCP to `mihslqjjclbrqelnjjpb` (migration first, then `teams-webhook`). Source of truth: `matrix-digital-employees/supabase/`.

---

## KB sources consulted

- [ADR-032](../architecture/decisions/ADR-032.md)
- [api-contracts.md](api-contracts.md) — Teams JWT on MCP chat paths
- [app-catalog.md](app-catalog.md) — Digital Employees entry
- Microsoft Learn: [suggested-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/suggested-actions), [subscribe-to-conversation-events](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/subscribe-to-conversation-events), [cards-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) (`msTeams.feedback.hide`), [format-your-bot-messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/format-your-bot-messages) (markdown / extendedmarkdown / tables), [cards-format](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format) (Adaptive Card TextBlock subset)