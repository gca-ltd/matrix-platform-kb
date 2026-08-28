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

AI follow-up suggestions (`runs.suggestions`, generated in `_shared/suggestions.ts`) can render four ways per channel (`channels.config.suggestion_style`):

| Style | Reply body | Prompt UI | Notes |
|---|---|---|---|
| `card` (default) | Adaptive Card attachment | `Action.Submit` + `msteams.messageBack` on card root | Buttons inside the bubble; identical in 1:1, group and channel. **Cannot** carry a bot @mention — cold group/channel taps still need a manual `@`. |
| `chips` | Plain markdown `message` | `suggestedActions` + `imBack` below bubble | `inputHint: expectingInput`; smart replies in `personal`, persisted in `team` / `groupChat`. **Cannot** carry a bot @mention. |
| `compose` | Plain markdown `message` | `suggestedActions` + `Action.Compose` | Prefills compose box (experimental). With `suggestions_mention_bot: true`, the Graph `chatMessage` includes a real bot mention so a tapped suggestion addresses the bot even on a cold thread. |
| `off` | Plain markdown `message` | None | No follow-up prompts |

**Platform constraint (Microsoft Teams):** `suggestedActions` are **not supported on messages with attachments**. An Adaptive Card is an attachment, so card-style replies and below-bubble chips are **mutually exclusive**. The Channels UI sets `reply_format` and `suggestion_style` together.

**Addressing the bot from a suggestion (`suggestions_mention_bot`):** only `Action.Compose` is documented to carry @mentions (its `value` is a Graph [`chatMessage`](https://learn.microsoft.com/en-us/graph/api/resources/chatmessage) with a `mentions` collection). When the switch is on and `bot_app_id` is set, each compose action prefills `@Name <prompt>` with `mentions[].mentioned.application` (`applicationIdentityType: "bot"`). The display name matches the Teams manifest `name.short` (`mf_name` or the employee name, ≤30 chars). Card `messageBack` and `imBack` have no mention channel — leave them alone, or switch the reply surface to compose. Sources: [suggested actions](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/suggested-actions), [channel and group conversations](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-and-group-conversations), [Graph messaging overview — mentions](https://learn.microsoft.com/en-us/graph/teams-messaging-overview).

**Scope behaviour:** `suggestedActions` are supported in **all scopes**, but not identically — in `personal` they render as smart replies, so only the actions on the **latest** message remain visible, while in `team` and `groupChat` they are saved with the message and stay on it. `card` prompts persist everywhere. Teams shows at most **three** actions regardless of style, which is why `buildTeamsReply()` slices to three.

> Earlier revisions of this doc claimed `suggestedActions` were personal-scope only. That was true of the 2022 guidance and is no longer correct — see the Microsoft Learn `suggested-actions` page (doc date 2026-08-19), which documents all three scopes with screenshots.

**Card polish (both applied by default):**

- Each suggestion `Action.Submit` carries action-level `msTeams: { feedback: { hide: true } }`, which suppresses Teams' *"Your response was sent to the app"* system line under the card on every tap. The lowercase `data.msteams.messageBack` payload is what echoes the prompt as a user message and stays untouched.
- `channels.config.card_header` (default `true`) controls the in-card avatar + name `ColumnSet`. Set `false` to drop it — Teams already renders the bot avatar and name above the bubble, so the header is a duplicate. Card style only; ignored by `chips` / `compose`.

**Why `Action.Submit` and not `Action.Execute`:** Microsoft's card-actions doc marks `Action.Submit` legacy and recommends `Action.Execute` for new work. Do **not** migrate this card:

- `Action.Execute` sends an `adaptiveCard/action` invoke with **no user-visible message**, so a tapped prompt would never appear as the person's turn in the transcript. The whole point of `msteams.messageBack` is that echo.
- `msTeams.feedback.hide` is supported on `Action.Submit` **only** — with `Action.Execute` the "Your response was sent to the app" line comes back and cannot be suppressed.

Back-compat: when `suggestion_style` is absent, `reply_format === 'text'` maps to `chips`; otherwise `card`. When `card_header` is absent it defaults on, preserving pre-toggle rendering.

Implementation: `supabase/functions/_shared/teams-activity.ts` → `buildTeamsReply()` (style + `resolveCardHeader()`), `_shared/adaptive-card.ts` → `buildReplyActivity()` (`showHeader`).

---

## Output format contract (system prompt)

Channel turns inject a **`channel_format`** system-env block so the model only emits formatting the outbound surface can render. Playground turns skip it.

**Implementation:** `_shared/channel-format.ts` → `resolveChannelFormat(kind, config)` returns `{ surface, rules }` → `renderChannelFormatBlock()` in `_shared/agent-run.ts`.

**Where to edit:**

| Piece | Where | Key |
|---|---|---|
| Prompt wrapper (`## Output format for this channel` + `{{channel}}` / `{{rules}}`) | Employee **System** tab | `employees.system_env.channel_format` |
| Per-channel rules text | Employee **Channels** tab → each channel card | `channels.config.format_rules` (empty = platform default for the resolved surface) |
| Teams wire format | Channels tab → Extended markdown switch | `channels.config.text_format` = `markdown` (default) or `extendedmarkdown` |

| Surface | When | What the model is told (defaults from vendor docs) |
|---|---|---|
| `teams-text` | Plain message + `text_format` unset/`markdown` | Safe cross-client: bold, italic, inline/preformatted code, blockquote, links. Lists desktop-only. No headings / HR / images. Tables not in the documented standard subset — if unavoidable, blank line + GFM separator, ~4 cols. |
| `teams-text-extended` | Plain message + `text_format: extendedmarkdown` | CommonMark + tables, task lists, fenced code, math, images. Headings from `###`. Only `<at>Name</at>` HTML. Microsoft **public developer preview**. |
| `teams-card` | `suggestion_style: "card"` (default) | Adaptive Card `TextBlock`: bold, italic, lists, links only. No tables, headings, images, preformatted, blockquotes. Prefer bold labels. |
| `whatsapp` | WhatsApp channel | WhatsApp syntax, not Markdown: `*bold*` (one asterisk), `_italic_`, `~strike~`, backticks, `- `/`1. ` lists, `> ` quotes. No headings / MD links / tables. |
| `api` | Conversations API | Full GFM; integrator renders. |
| `a2a` | A2A peer | **Plain text** — our agent card advertises `text/plain` and parts have no `mediaType`. No Markdown. |

**Typing indicator / redelivery:** `teams-webhook` acknowledges the message activity immediately (`EdgeRuntime.waitUntil`) and starts typing only from `onTurnAccepted` after `claimThreadRun` wins the conversation lock. Duplicates, queued turns, and unaddressed group messages produce no typing. At most one "Neo is typing" per conversation. A background turn that throws is logged as `failed` and is **not** retried (the early 200 prevents Bot Framework redelivery); check the function logs rather than waiting for a second attempt. `thread_busy` turns are still parked as `queued` for `inbound-drain`.

**Why the blank-line + extendedmarkdown matter:** a reply that stored `**Топ:**\n| Брокер | …` rendered as a run-on line in Teams under `textFormat: markdown`. Tables are formally documented under `extendedmarkdown`; enable that channel setting for reliable table rendering.

**Microsoft / WhatsApp / A2A references:**

- [Format your bot messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/format-your-bot-messages) — `textFormat` values, standard vs extended markdown, per-platform matrix
- [Format cards in Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format) — Adaptive Card `TextBlock` subset
- [WhatsApp Help Center — How to format your messages](https://faq.whatsapp.com/539178204879377)
- [A2A specification](https://a2a-protocol.org/latest/specification/) — `Part` / agent-card input/output modes

Config keys (format-related, all in `channels.config` jsonb): `suggestion_style`, `reply_format`, `card_header`, `text_format`, `format_rules`, `suggestions_mention_bot`.

---

## Install welcome

On `installationUpdate` add or bot-self `conversationUpdate`, the webhook:

1. Upserts `public.channel_installations` (conversation reference for future proactive delivery).
2. Checks `welcome_enabled` (default true), `welcomed_at` (idempotent), and roster size ≤ `welcome_max_members` (default 100).
3. Builds welcome text from `welcome_message` or auto-drafts from employee persona + manifest `mf_commands`.
4. Sends via `buildTeamsReply()` so starter prompts use the channel's `suggestion_style`.
5. Stamps `welcomed_at`.

**Do not** welcome on: team rename, human member add, roster over threshold, or `add-upgrade` / `remove-upgrade`.

Config keys (all in `channels.config` jsonb): `welcome_enabled`, `welcome_message`, `welcome_max_members`, `suggestion_style`, `reply_format`, `card_header`, `text_format`, `format_rules`, `suggestions_mention_bot`.

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
- Microsoft Learn: [suggested-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/suggested-actions) (`Action.Compose` + @mentions), [channel-and-group-conversations](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-and-group-conversations) (bots only receive @mentions unless RSC), [subscribe-to-conversation-events](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/subscribe-to-conversation-events), [cards-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) (`msTeams.feedback.hide`), [format-your-bot-messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/format-your-bot-messages) (markdown / extendedmarkdown / tables), [cards-format](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-format) (Adaptive Card TextBlock subset), [Graph teams-messaging-overview](https://learn.microsoft.com/en-us/graph/teams-messaging-overview) (bot mention on `chatMessage`)