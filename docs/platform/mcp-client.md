# Matrix MCP client (Digital Employees)

The client contract is the [Matrix MCP Profile](mcp/README.md), client section, plus [agent-guidance.md](mcp/agent-guidance.md). [ADR-059](../architecture/decisions/ADR-059.md) is the decision. ADR-040's principal model still applies; its auth-mode table does not.

`matrix-digital-employees` registers remote tool servers. Admins set Allow / Ask / Deny per tool. Agents call tools as a principal. Auth is only `none`, `api_key`, `oauth_user`, or `oauth_service`.

User OAuth 2.1 callback: `{SUPABASE_URL}/functions/v1/mcp-oauth/callback`.

Tokens are encrypted and keyed by `(server_id, principal_kind, principal_id)`. `identityProbe` is `{ tool: "<prefix>_whoami", emailPath: "email" }`.
