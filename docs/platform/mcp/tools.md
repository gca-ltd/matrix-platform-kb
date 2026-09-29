# MCP tool conventions

## Names

`<prefix>_<verb>_<entity>` in snake_case. `<prefix>` is the product key (`msa`, `qobrix`, `datacore`).

| Tool | Required | Returns |
|---|---|---|
| `<prefix>_whoami` | Yes | `{ "email", "user_id", "display_name", "scope" }` |
| `<prefix>_get_schema` | When the server has more than 10 entities or a query language | Field names for one entity |
| `<prefix>_get_field_options` | Same | Closed values for one field |
| `<prefix>_search_help` | Same | The query language, plus a field list when an entity is passed |

`identityProbe` is always `{ "tool": "<prefix>_whoami", "emailPath": "email" }`.

`<prefix>_sign_in` and `<prefix>_sign_out` are retired. Sign-in is User OAuth 2.1, not a tool.

## Annotations

Every tool sets:

```json
{
  "title": "Short human name",
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

`openWorldHint` is `true` when the tool calls a system outside Matrix. Clients treat missing `readOnlyHint` or `destructiveHint: true` as Ask. See [agent-guidance.md](agent-guidance.md).

## Results

Success for a list is `{ "data": [], "pagination": { "count", "has_next_page" } }`.

| Condition | Body |
|---|---|
| Soft cap | `_truncated: { omitted_rows, hint }` |
| Hard cap | `status: "result_too_large"`, `_refine_required: { assistant_instruction, suggested_narrowing }`, `isError: true` |
| Tool failure | `isError: true` and `next_step` (one line telling the model what to call or ask) |

Auth failure is HTTP 401 or 403 on the MCP request. It is not a Markdown link inside a tool result.

## Output schema

Report and aggregate tools SHOULD set `outputSchema` and return `structuredContent` that matches it. The text content stays a short summary.
