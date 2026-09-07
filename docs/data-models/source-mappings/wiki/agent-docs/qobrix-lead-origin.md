# Qobrix lead / opportunity origin (MSA copy)

> Hand-maintained companion to the generated [`qobrix.md`](by_source/qobrix.md).
> Do not regenerate this file from OpenAPI — it documents **application** mapping
> used by Matrix Sales Automation when copying a Qobrix Opportunity into
> `public.leads`.

## Four-field composite

Qobrix does **not** store a single "Facebook" (or similar) value on
`Opportunity.source`. Origin is spread across:

| Field | Example values | Role |
|---|---|---|
| `source` | `direct`, `agent`, `external_site`, `qoetix*` | Coarse channel |
| `direct_source` | `campaign`, `social_media`, `website`, `walk_in`, `cold_call`, … | How the enquiry arrived |
| Campaign name (`CampaignIdCampaigns`) | `CSIR \| FACEBOOK \| EN \| Pafos \| …` | Marketing campaign label |
| `source_description` | Free text / portal payload | Where "FACEBOOK" often appears literally |

Reading `source` alone maps every Facebook campaign to MSA `other`. MSA derives
the `lead_source` enum via `deriveLeadSource` in
`matrix-sales-automation` → `supabase/functions/_shared/qobrix-crm-copy.ts`
(Facebook signal first, then `direct_source`, then channel, then string
heuristics) and also persists `leads.direct_source` + `leads.source_description`.

See also: `matrix-sales-automation` → `docs/supabase/app-owned-data.md`
§ "Lead source provenance".
