# MCP UI copy

Machine-readable strings: [mcp-strings.json](mcp-strings.json). Apps load them through their existing i18n (bundled JSON or the CDL `app-i18n` seed). Brand names are values (`{{server}}`), never part of a key.

Placeholders: `{{server}}`, `{{client}}`, `{{host}}`, `{{count}}`, `{{when}}`, `{{enabled}}`.

## Client keys (`mcp.*`)

| Group | Keys |
|---|---|
| Page | `mcp.page.title`, `mcp.page.description` |
| Form | `mcp.form.*` including `usageNotes`, `usageNotesHint` |
| Auth labels | `mcp.auth.none`, `api_key`, `oauth_user`, `oauth_service` and `mcp.authHint.*` |
| Discovery | `mcp.discover.*`, `mcp.test.*` |
| Connections | `mcp.principals.*` |
| Policy | `mcp.policy.*` |
| Employee tab | `mcp.tab.*` |
| Approvals | `mcp.approvals.*` |
| Callback | `mcp.callback.*` |
| Chat | `mcp.chat.signInPrivate`, `signInGroup`, `wrongAccount`, `expired`, `circuitOpen` |

There is no `mcp.auth.server_managed` key.

## Server keys (`mcpServer.*`)

| Group | Keys |
|---|---|
| Consent | `mcpServer.consent.title` ("Sign in to {{server}}"), `client`, `redirectHost`, `loopbackWarning`, `allow`, `deny` |
| Result | `mcpServer.result.connected`, `cancelled`, `expired`, `wrongAccount`, `error` |
| Sign-in link | `mcpServer.signIn.label` ("Sign in to {{server}}") |
| Admin tab | `mcpServer.admin.*` |

## Register description

`mcp.form.registerDesc` is exactly:

"Any standard MCP server over Streamable HTTP. Authentication: None, API key, User OAuth 2.1 or Service OAuth 2.1."
