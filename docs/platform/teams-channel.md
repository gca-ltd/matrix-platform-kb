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
| `card` (default) | Adaptive Card attachment | `Action.Submit` + `msteams.messageBack` on card root | Buttons inside the bubble; identical in 1:1, group and channel |
| `chips` | Plain markdown `message` | `suggestedActions` + `imBack` below bubble | `inputHint: expectingInput`; **personal chats only** |
| `compose` | Plain markdown `message` | `suggestedActions` + `Action.Compose` | Prefills compose box (experimental) |
| `off` | Plain markdown `message` | None | No follow-up prompts |

**Platform constraint (Microsoft Teams):** `suggestedActions` are **not supported on messages with attachments**. An Adaptive Card is an attachment, so card-style replies and below-bubble chips are **mutually exclusive**. The Channels UI sets `reply_format` and `suggestion_style` together.

**Scope difference:** Teams renders `suggestedActions` in **personal (1:1) chats only** — group chats and channels drop them, so `chips` / `compose` turns arrive as plain text there. `card` is the only surface whose prompts survive in every conversation type.

**Card polish (both applied by default):**

- Each suggestion `Action.Submit` carries action-level `msTeams: { feedback: { hide: true } }`, which suppresses Teams' *"Your response was sent to the app"* system line under the card on every tap. The lowercase `data.msteams.messageBack` payload is what echoes the prompt as a user message and stays untouched.
- `channels.config.card_header` (default `true`) controls the in-card avatar + name `ColumnSet`. Set `false` to drop it — Teams already renders the bot avatar and name above the bubble, so the header is a duplicate. Card style only; ignored by `chips` / `compose`.

Back-compat: when `suggestion_style` is absent, `reply_format === 'text'` maps to `chips`; otherwise `card`. When `card_header` is absent it defaults on, preserving pre-toggle rendering.

Implementation: `supabase/functions/_shared/teams-activity.ts` → `buildTeamsReply()` (style + `resolveCardHeader()`), `_shared/adaptive-card.ts` → `buildReplyActivity()` (`showHeader`).

---

## Install welcome

On `installationUpdate` add or bot-self `conversationUpdate`, the webhook:

1. Upserts `public.channel_installations` (conversation reference for future proactive delivery).
2. Checks `welcome_enabled` (default true), `welcomed_at` (idempotent), and roster size ≤ `welcome_max_members` (default 100).
3. Builds welcome text from `welcome_message` or auto-drafts from employee persona + manifest `mf_commands`.
4. Sends via `buildTeamsReply()` so starter prompts use the channel's `suggestion_style`.
5. Stamps `welcomed_at`.

**Do not** welcome on: team rename, human member add, roster over threshold, or `add-upgrade` / `remove-upgrade`.

Config keys (all in `channels.config` jsonb): `welcome_enabled`, `welcome_message`, `welcome_max_members`, `suggestion_style`, `reply_format`, `card_header`.

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
- Microsoft Learn: [suggested-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/suggested-actions), [subscribe-to-conversation-events](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/subscribe-to-conversation-events), [cards-actions](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) (`msTeams.feedback.hide`)
