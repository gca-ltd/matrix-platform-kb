# Sharp Matrix Platform Extensions (x_*)

> Fields and lookup values required by Sharp Matrix that do not exist in RESO DD 2.0.
> All extensions follow the `x_` prefix convention ([ADR-023](../architecture/decisions/ADR-023.md), which superseded the former `x_sm_` vendor prefix). The canonical RESO DD 2.0 model lives in [`reso-dd-kb/`](reso-dd-kb/README.md).
> for the governance process.

## Extension Fields — Property Resource

### Financial & Legal

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_vat_applicable | Boolean | Cyprus VAT on property — not a RESO concept | +VAT (yes/no) | property.vat_applicable | Broker, Finance |
| x_introducer_fee | Number | Fee paid to party who introduced the deal | Introducer fee | property.introducer_fee | Broker, Finance |
| x_title_deeds | Boolean | Whether title deeds are available (Cyprus legal requirement) | Title deeds availability | property.title_deeds | Broker |
| x_suitable_for_pr | Boolean | Whether the property qualifies buyer for Permanent Residency (Cyprus immigration) | Suitable for PR | property.suitable_for_pr | Broker, Client Portal |
| x_crypto_payment | Boolean | Whether cryptocurrency payment is accepted | Crypto payment possible | property.crypto_payment | Broker, Client Portal |

### Structure & Layout

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_uncovered_verandas | Number (sq.m.) | RESO has no separate uncovered veranda field — relevant for Mediterranean properties | Uncovered Verandas (sq.m.) | property.uncovered_verandas | Broker, Client Portal |
| x_roof_garden | Number (sq.m.) | Roof garden area — common in Cyprus high-rises, not in RESO | Roof garden (sq.m.) | property.roof_garden | Broker, Client Portal |
| x_elevator | Boolean | Building has elevator — not a standalone RESO field | Elevator | property.elevator | Broker, Client Portal |
| x_maids_room | Boolean | Maid's/service room — common in luxury Cyprus properties | Maid's room | property.maids_room | Broker, Client Portal |
| x_smart_home | Boolean | Smart home features installed | Smart home | property.smart_home | Broker, Client Portal, Marketing |
| x_year_renovated | Number | Year of last renovation — RESO only has YearBuilt | Year of renovation | property.year_renovated | Broker, Client Portal |
| x_extras | String | Free-text additional features not captured elsewhere | Additional Extras | property.extras | Broker |
| x_property_name | String | Free-text marketing/display title for a listing where it is **not** a building/development name. RESO has no marketing-title field; building/development names SHOULD use canonical `Property.BuildingName` (also `SubdivisionName`/`ParkName`). Materialized on `properties` + `properties_published`; drives `displayTitle.ts` and `listings-search` free-text. Tagged `source='vendor_extension'` in the RESO corpus (`Property.X_PropertyName`). Not exported to outbound RESO/Dash channels. | Property name | property.name | Atlas, Pipeline, Client Portal |
| x_heating_medium | String List | Specific heating medium (underfloor, fan coil, etc.) — RESO Heating only covers type | Heating Medium | property.heating_medium | Broker, Client Portal |

### Land & Zoning (Cyprus-specific)

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_building_density | Number (%) | Building density percentage — Cyprus town planning regulation | Building density % | property.building_density | Broker |
| x_coverage | Number (%) | Coverage percentage — Cyprus town planning regulation | Coverage % | property.coverage | Broker |
| x_floors_allowed | Number | Maximum floors allowed by zoning | Floors allowed | property.floors_allowed | Broker |
| x_height_allowed | Number (m) | Maximum building height allowed by zoning | Height allowed (m) | property.height_allowed | Broker |

### Contact Extensions

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_keyholder_name | String | Property keyholder/representative in Cyprus for absentee owners | Keyholder/Representative in CY | — (custom) | Broker |
| x_keyholder_contact | String | Keyholder phone/email | Telephone/email of keyholder | — | Broker |
| x_privacy_level | String | FR-CON privacy classification (Standard / Private / Ultra-confidential) — drives Pipeline PII visibility; not a RESO DD field, not exported to any outbound channel | Privacy | — (custom) | Pipeline (Broker) |

### Showing Extensions

_None._ The buyer↔showing relationship is **not** an extension — RESO models no
Showing→Contact link, so it is the project-flavour resource
`public.showing_participation` (`showing_key` + `contact_key` + `participant_role`),
governed by [ADR-033](../architecture/decisions/ADR-033.md). It superseded the
earlier `x_contact_key` extension (ADR-022), which was dropped from
`showings` / `showing` / `showing_request` by
`20260615170000_showing_participation_resource.sql`. See "Extensions vs.
project-flavour resources" under Governance Notes.

### Transaction Extensions

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_transaction_key | String | `TransactionManagement.TransactionKey` attached to a `HistoryTransactional` event so transaction-phase events / documents / commission can be queried by transaction. RESO DD 2.0 defines **no** linkage for `TransactionManagement` (bare 4-field header, zero FKs) and `HistoryTransactional.ResourceName` cannot anchor on it — see [ADR-030](../architecture/decisions/ADR-030.md). Promotes the link out of `HistoryTransactional.raw` (ADR-026 as-built) into a governed, indexed extension. Loose witness (no FK); in the `cdl-read` filterable allow-list; not exported to any outbound RESO/Dash channel. **Scope:** transaction *identity* only — the transaction **buyer** stays canonical via `ContactListings` (`contact_key` + `listing_key`), NOT an `x_` column. | — (custom) | — (custom) | Pipeline (Broker) |

### Member Extensions

| Extension Field | Data Type | Reason | SIR Source Field | Qobrix Source | Apps |
|----------------|-----------|--------|-----------------|---------------|------|
| x_commission_pct | Number (%) | Agent commission **split** percentage. RESO models listing-side *compensation* (`Property.BuyerBrokerageCompensation` + `BuyerBrokerageCompensationType`), not an individual member's comp split — there is no RESO Member field for it. Lives in the HRMS / source-mappings layer; not exported to outbound RESO/Dash channels. | Commission % | member.commission_pct | HRMS, Finance |

> **Member employer/company name is NOT an extension** — RESO DD 2.0 models it canonically as `Member.OfficeName` ("the legal name of the brokerage"), materialized as `members.office_name`. The Azure AD `companyName` of an app-provisioned member maps directly onto `office_name` (seeded at provision, kept fresh by the owner-picker AD-sync; see [ADR-031](../architecture/decisions/ADR-031.md)). An earlier `x_company` extension (migration `20260615140000`) was retired the same day by `20260615160000_members_office_name_canonical.sql` in favour of the canonical column.

## Extension Lookup Values — ScheduleType (Prospecting)

RESO `Prospecting.ScheduleType` standard values are `ASAP` / `Daily` /
`Monthly`. The pipeline prospecting UI offers additional cadences registered as
platform lookup-value extensions (engine maps each to a cadence interval):

| Lookup Extension | Maps To (standard fallback) | RESO Closest Equivalent | Reason Needed |
|-----------------|------------------------------|------------------------|---------------|
| Weekly | `Daily` (digest) | — | Weekly digest cadence not in the RESO closed lookup |
| OnNewMatch | `ASAP` | `ASAP` | Deliver immediately on a new match (semantically `ASAP`) |
| Custom | `Monthly` | — | Tenant-defined interval |

## Extension Lookup Values — PropertySubType

RESO DD 2.0 `PropertySubType` doesn't cover all Cyprus/Mediterranean property types.
These are registered as platform-specific lookup values:

| Lookup Extension | Maps To | RESO Closest Equivalent | Reason Needed |
|-----------------|---------|------------------------|---------------|
| x_duplex | Duplex Apartment | — | Multi-level apartment unit, not a standalone duplex |
| x_ground_floor | Ground Floor Apartment | — | Ground-level apartment with garden access |
| x_penthouse | Penthouse | — | Top-floor luxury unit (RESO has no specific subtype) |
| x_whole_floor | Whole Floor Apartment | — | Entire building floor as single unit |
| x_semi_detached | Semi-detached Villa | — | Semi-detached house (common in Cyprus) |
| x_mansion | Mansion / Villa | — | Large luxury estate property |
| x_bungalow | Bungalow | — | Single-story house |
| x_maisonette | Maisonette | — | Multi-level within a building (European concept) |
| x_plot | Plot (Building Land) | — | Serviced building plot (distinct from UnimprovedLand) |
| x_plot_settlement | Plot within Settlement | — | Plot within settlement boundaries (Cyprus zoning) |

> **NOT materialized — superseded by P6 lookup-value normalization (2026-06-05).** These
> `x_*` PropertySubType extension lookups remain **spec-only**. As of the audit-P6
> normalization, `public.properties.property_sub_type` stores only canonical RESO
> `PropertySubType` `StandardValue`s: the Cyprus local vocabulary is mapped to the **nearest
> RESO value** (e.g. `penthouse`/`studio` → `Apartment`, `mansion_villa`/`bungalow` →
> `Single Family Residence`, `plot`/`field` → `Unimproved Land`) via
> `public.reso_lookup_value_map` + the `tg_properties_normalize_lookups` trigger (see
> `cdl-schema.md#lookup-value-normalization-audit-p6`). This mapping is **lossy by decision**
> — the local subtype granularity above is intentionally dropped at storage rather than carried
> as `x_*` extensions. Re-introducing it later (as a separate `x_property_subtype_local` column)
> would be a governed schema change, not a silent value.

## Summary Statistics

| Category | Count |
|----------|-------|
| Extension fields (Property) | 17 |
| Extension fields (Contact) | 3 |
| Extension fields (Showing) | 0 |
| Extension fields (Transaction) | 1 |
| Extension fields (Member) | 1 |
| Extension lookup values (PropertySubType) | 10 |
| Extension lookup values (ScheduleType) | 3 |
| **Total extensions** | **35** |

> Materialized in CDL today (the rest are spec-only): `properties.x_property_name` (+ `properties_published.x_property_name`, added 2026-06-05 by `20260605170000_add_x_property_name_to_properties_published.sql`) and `contacts.x_privacy_level`. `x_privacy_level` was renamed from the legacy `x_sm_` prefix by migration `20260605160000_rename_x_sm_extensions_to_x.sql` ([ADR-023](../architecture/decisions/ADR-023.md)). (The member employer name is canonical `members.office_name`, and the buyer↔showing link is the `showing_participation` project-flavour resource — neither is an extension; see above.)

## Extension Fields — Seller opportunity (MLS App DB)

| Extension Field | Data Type | Reason | SIR Source | Apps |
|----------------|-----------|--------|------------|------|
| x_checklist | JSONB | Live SIR listing checklist attributes (key → `{v, by, at}`) for Draft and later stages | Check-list Listing Residential ENG 2026-2027 | Atlas MLS |
| x_checklist_submitted | JSONB | Frozen checklist snapshot written by `send_to_qualification` | same | Atlas MLS |
| x_checklist_submitted_at | Timestamptz | When the submitted snapshot was written | — | Atlas MLS |
| x_submitted_gaps | JSONB | Readiness items still open at Submit to Review (`[{key, label, gate}]`). Qualification gates are soft (MSA pattern): only the approvers are required; Review shows these as "Submitted incomplete" | — | Atlas MLS |

Catalog and RESO mapping: `matrix-mls` `src/lib/listingChecklist.ts`. Spec: [sir-listing-forms.md](../product-specs/sir-listing-forms.md).

## Governance Notes

- **Regional scope**: Most extensions are Cyprus-specific or Mediterranean-specific. When Sharp Matrix expands to Hungary and Kazakhstan, additional regional extensions may be needed (e.g., Hungarian land registry fields, Kazakh property registration).
- **Prefix**: The platform extension prefix is `x_` ([ADR-023](../architecture/decisions/ADR-023.md)). It superseded the former vendor-tagged `x_sm_` prefix on 2026-06-05; the four materialized columns were renamed by migration `20260605160000_rename_x_sm_extensions_to_x.sql`. RESO DD 2.0 itself defines no extension prefix — `x_` is the platform's local-field marker and these columns are never emitted to outbound RESO/Dash channels.
- **Extensions vs. project-flavour resources (`x_` is for fields, not whole resources)**: The `x_` prefix marks an extension **field on an existing RESO resource** (e.g. `x_privacy_level` on `Contacts`). A **wholly new resource/relationship that RESO does not model at all** is NOT an extension and takes **no `x_` prefix** — it is a *project-flavour CDL resource* with plain canonical snake_case columns, governed by its own ADR. Live examples: `public.referral` (FR-REF) and `public.document` (FR-DOC), added 2026-06-08 — RESO has no `Referral` resource and only Property-level document *flags*, no `Document` resource ([ADR-025](../architecture/decisions/ADR-025.md)); and `public.showing_participation`, added 2026-06-15 — RESO has no Showing→Contact link, so the buyer↔showing relationship is a resource, not an `x_` column ([ADR-033](../architecture/decisions/ADR-033.md), which superseded the earlier `x_contact_key` extension of [ADR-022](../architecture/decisions/ADR-022.md)). This mirrors how `saved_search`/`prospecting`/`caravan` were added as resources (not prefixed). Do not "extend" by inventing `x_`-prefixed columns when the right move is a new resource.
- **Zero speculative `x_` for deferred scope**: When a workstream is deferred (e.g. the 2026-06-08 offer-economics deferral — ADR-025), do **not** pre-add `x_` columns "to be ready". The datamodel stays clean; the extension is introduced only when the feature lands and only for the residual gap with no canonical RESO home.
- **Retirement**: If a future RESO DD version (e.g., DD 2.1) adds a field that matches an `x_*` extension, the extension should be migrated to the RESO name with a deprecation period.
- **Naming collisions**: Never reuse a retired extension name for a different purpose.

## Cross-Reference

| For | See |
|-----|-----|
| Extension governance rules | This file (`platform-extensions.md`) |
| Project-flavour resources (no `x_`): `referral` / `document` + offer-economics deferral | [ADR-025](../architecture/decisions/ADR-025.md), [cdl-schema.md](cdl-schema.md) ("Week-4: Referral + Document project-flavour resources") |
| Full field mapping with extensions flagged | [property-field-mapping.md](property-field-mapping.md) |
| RESO DD 2.0 field reference | [`reso-dd-kb/wiki/agent-docs/_index.md`](reso-dd-kb/wiki/agent-docs/_index.md) |
