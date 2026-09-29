# MCP admin screens

Rules for layout and copy. Apps keep their own components. Strings come from [mcp-strings.json](mcp-strings.json).

## Client: Tools page

Sections, in order:

| Section | Contents | Empty / error |
|---|---|---|
| Register tool server | Name, Endpoint URL, Authentication (None, API key, User OAuth 2.1, Service OAuth 2.1), secret fields for the selected type, Agent usage notes, Active (edit only) | `mcp.form.needNameUrl`, `needApiKey`, `needClientCredentials`, `saveFailed` |
| Tool servers | Name, auth label, URL, discovery line, Discover, Test connection, Edit, Delete | `mcp.tab.empty`, `mcp.tab.loadFailedTitle` |
| Access policy | Per tool: Allow / Ask / Deny, read-only or mutating badge, max per hour | `mcp.tab.noTools` |
| Connections | Who signed in, when, expiry, Revoke | `mcp.principals.empty` |

Employee Tools tab: server toggle, Allow / Ask / Deny override, pending approvals, recent calls. Copy: `mcp.tab.*`.

Approvals inbox: `mcp.approvals.*`. A row shows the tool name, the employee, and Approve / Reject.

## Server: MCP tab

Sections, in order: Status, Connect, Connections, Tools, Activity, Settings.

| Section | Contents |
|---|---|
| Status | Health JSON. Error: `mcpServer.admin.unreachable` |
| Connect | `mcpServer.admin.connectHelp` with the public URL. Auth type shown as User OAuth 2.1 |
| Connections | Email, client name, Revoke |
| Tools | On / Off per tool |
| Activity | Recent calls |
| Settings | Max result characters, cache TTL |

The Connect section does not mention any retired auth name.
