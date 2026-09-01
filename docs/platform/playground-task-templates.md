# Playground task templates

Org-curated prompt / task library for the Digital Employees Playground
(Alice Prompt Hub analogue).

## Storage

Table `public.task_templates` (migration `20260901140000_playground_frontier_parity.sql`):

| Column | Notes |
|--------|--------|
| `tenant_id` | Workspace scope |
| `employee_id` | Nullable — `NULL` means tenant-wide |
| `title` / `prompt` | Chip label and full prompt text |
| `category` | Free-text grouping (default `general`) |
| `is_featured` | Featured tab in the composer library |
| `sort_order` | Ascending display order |

Access is via the `employees-api` edge function (`listTaskTemplates`,
`upsertTaskTemplate`, `deleteTaskTemplate`) with Matrix SSO + CRUD checks.
PostgREST anon has no policies; EFs use the service role.

## UI

- Composer **Task library** popover (`TaskLibrary`) — All / Featured tabs.
- Empty-state starter chips remain separate (`buildPlaygroundStarters`) and
  rotate daily; they advertise capabilities without requiring curated rows.

## Authoring

Operators upsert templates through `employees-api` (admin write). A future
settings panel can expose CRUD in the employee editor; until then, seed via
API or SQL for the tenant.
