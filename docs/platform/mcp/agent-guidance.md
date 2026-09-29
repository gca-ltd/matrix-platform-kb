# How tools are explained to agents

Servers publish guidance. Clients deliver it. An agent that follows a Matrix client sees the server's workflows, not a truncated catalogue.

## Server

`initialize` returns `instructions` with these headings, in order:

1. Purpose and data boundaries
2. Workflows
3. Data model and IDs
4. Query language
5. Pagination and payload defaults
6. Output caps and refine protocol
7. Identity
8. Known quirks

Per-tool detail lives in the tool description, not again in `instructions`. Target size is 10,000 characters. Hard limit is 16,000.

### Tool description

Sentence 1 is at most 160 characters, names the job, and says when to use the tool. Clients use it as the deferred summary. Then, in order:

- `Use when` / `Prefer <tool> when`
- `Returns`
- `Notes`
- `Examples` (one to three argument objects)
- `Related`

Full description length is 200–1,200 characters.

### Parameters

Every parameter has a description. Closed sets are enums. Numbers have `minimum` and `maximum`. Defaults are schema `default` and are repeated in the description. Non-obvious parameters include `examples`.

### Discovery tools

A server with more than 10 entities, or with its own query language, exposes `<prefix>_get_schema`, `<prefix>_get_field_options`, and `<prefix>_search_help`. See [tools.md](tools.md).

### Results

`{ data, pagination }` for lists. `_truncated.hint` on a soft cap. `result_too_large` carries `_refine_required.assistant_instruction` and `suggested_narrowing`. Failures set `isError: true` and a one-line `next_step`. Auth failures are HTTP 401 or 403, not a link in the tool text.

`tools/list` should stay under 60 KB. The probe reports the size.

Report tools should set `outputSchema` and `structuredContent`.

## Client

At discovery, persist `result.instructions` on `mcp_servers.server_instructions` and `instructions_hash`.

For each tool server enabled on the employee, the system prompt contains:

```text
## Tool server: <name>
<instructions, or sections 1–2 plus the heading list when longer than 10,000 characters>
<usage_notes when set>
```

The block is wrapped as untrusted server-provided guidance. `usage_notes` is the admin field "Agent usage notes" (`mcp.form.usageNotes`), for servers that send no instructions.

Deferred catalogue:

- The search summary is sentence 1, capped at 300 characters.
- `tool_describe` returns the full description and input schema, capped at 12,000 characters.
- A promoted tool keeps its full description.
- The catalogue line marks each tool read-only or mutating from its annotations.

## Evals

About 20 golden questions per reference server, scored on the first tool and its key arguments. Target: at least 90% correct first tool. Results live in [conformance.md](conformance.md).
