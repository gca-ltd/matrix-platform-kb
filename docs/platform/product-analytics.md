# Product analytics

How a Matrix app records what people do on its screens, so a later redesign can be based on behaviour rather than recollection.

MSA is the first app. The tables, the function, and the browser collector live in `gca-ltd/matrix-sales-automation`. The decision is [ADR-066](../architecture/decisions/ADR-066.md). Typed text is [ADR-067](../architecture/decisions/ADR-067.md).

## What is stored

One row per action in `ui_events`: the signed-in person, the time, the route template, the record id (including one the save just created), the control, its label, the field it bound, the address parameters, the click that caused a save, and a small JSON object of numbers and short codes.

A field edit stores how long the field had focus, how long the person was typing, keystrokes, characters inserted and deleted, pastes, and the length before and after. The characters themselves go to `ui_event_texts` and are dropped after 30 days. They are not stored for a password, a hidden field, a file input, a one-time code, or a control marked `data-track-off`.

Search stores the query text the same way, and its length. A select stores a screen code such as `direct_marketing` and the option's label. A copy stores how many characters were copied, not the characters. Errors store the error name, not the message.

## Who can read it

The signed-in person can insert their own rows and cannot read the journal. There is no select policy. The database owner reads it, and a later report can aggregate it. It is not a path through which one person sees another's clients. `ui_activity_log` runs as the invoker and is not granted to `authenticated`.

`ui_event_catalog` is the dictionary and is readable. `ui_action_catalog` names a control and a later edit applies to events already stored. `ui_events_daily` keeps counts after raw rows older than 90 days are dropped.

## How it is collected

The browser queues events and posts them in batches of at most 200 to `log_ui_events`, with the person's SSO JWT. A build plugin adds `data-track` to buttons, fields, links, dialogs, and anything with a click handler, and writes the caption and the bound field. Password fields are marked `data-track-off` and are ignored. The names are listed in the app's `docs/analytics/ui-element-map.json`.

The post is not on the render path. A failed post stays in the browser and is tried again.

## What this is not

It is not session replay, and it is not a second analytics product outside the app database. Figures that describe the business (pipeline, invoices, usage of saved records) stay on the existing `kpi_*` functions. This journal describes the screen.
