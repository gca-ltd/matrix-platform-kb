# Qobrix CRM Data Model — Reference & Migration Source

> Source: `raw/qobrix/qobrix_openapi.yaml` (OpenAPI 3.0, API version 2.0)
> Documentation: https://qobrix.com/real-estate-crm/advanced-tools/rest-api/
>
> **Role in Sharp Matrix**: Qobrix is the **legacy CRM** Sharp SIR currently uses for **Cyprus** listings. Today it is exposed to the CDL via the `mls.sharpsir.group` RESO Web API projection and ingested by `mls-sync` (CDL `mls_sources.kind = 'legacy-internal'`, `is_sunsetting = true`).
>
> **Decommission status**: Qobrix is being **decommissioned as the MLS source** once Atlas (`matrix-atlas-mls`) and `matrix-pipeline` CRM cover Cyprus listing creation. New listings authored in Atlas / `matrix-pipeline` use `source_id = matrix-internal` (`kind = 'internal'`); the `qobrix` source row will get `sunset_at` set at cutover. RESO DD 2.0 remains the canonical data layer — Qobrix is a migration source, not a permanent contract.

> **Field-by-field mapping to RESO DD lives in [`source-mappings/wiki/agent-docs/by_source/qobrix.md`](source-mappings/wiki/agent-docs/by_source/qobrix.md).**
> That page is auto-generated from `raw/qobrix/qobrix_openapi.yaml` + the curated
> `mapping_curated.csv` and is gate-validated against canonical RESO every regen.
> This page (the one you are reading) is narrative orientation: what Qobrix is,
> why we use it, decommission strategy. For schema-by-schema field correspondences
> see the by_source page above; for the cross-source view of one RESO resource see
> [`source-mappings/wiki/agent-docs/by_resource/`](source-mappings/wiki/agent-docs/by_resource/).

## Overview

Qobrix is the legacy CRM Sharp SIR uses today for Cyprus brokers. The Sharp Matrix Platform replicates and extends its capabilities through purpose-built apps (`matrix-pipeline` CRM, `matrix-atlas-mls`, `matrix-comms`, `matrix-client-connect`, etc.), all sharing the RESO DD canonical data layer. The Qobrix API documentation serves as a reference for what the platform must support during and after the migration. The API is RESTful (JSON), uses UUID identifiers, and supports search expressions, pagination, and resource expansion.

## Migration Mapping to RESO

| Qobrix Entity | RESO Resource (canonical) | Migration Notes |
|---------------|--------------------------|-----------------|
| Property | Property | Direct mapping for most fields; see [property-field-mapping.md](property-field-mapping.md) |
| Contact | Contacts | first_name→ContactFirstName, last_name→ContactLastName, etc. |
| Agent / User | Member | Agent profiles map to Member resource |
| Groups | Teams | Team structures |
| Opportunity | HistoryTransactional | Deal/pipeline data; RESO doesn't have a direct "Opportunity" equivalent |
| Property Viewing | ShowingAppointment | Viewing records; add `outlook_event_id` for Outlook calendar sync |
| Task | — | No direct RESO equivalent; platform extension needed |
| Contract | `Property` close fields + `ContactListings` + `Property.ListingAgreement` | Hybrid decomposition per [ADR-029](../architecture/decisions/ADR-029.md): `cos`/`tenancy_agreement` → `PurchaseContractDate`/`CloseDate`/`ClosePrice` + parties → `ContactListings`, commission block → app-private `commission_estimate`; `listing_for_sale`/`listing_for_rent` (mandates) → `ListingAgreement` + `ListingContractDate`; `property_management` + PDFs → ADR-025 `document` |
| Offer | — | No direct RESO equivalent; platform extension needed |
| Media | Media | Photo/video/document records |
| Project | — | Development projects; platform extension needed |
| Email Messages | `opportunity_emails` | Email metadata snapshots linked to opportunities; full emails remain in Exchange Online via Graph API. See [o365-exchange-integration.md](../platform/o365-exchange-integration.md) |
| Meetings | `broker_meetings` | Meeting records synced to Outlook calendar; types: seller_meeting, team_meeting, contract_signing, other |
| Calls | `broker_meetings` (type=follow_up_call) | Phone call records stored as broker_meetings with type `follow_up_call`; Outlook calendar events for scheduled calls |

## Authentication

- API key-based: `X-Api-User` + `X-Api-Key` headers
- OAuth 2.0: Authorization code flow with access/refresh tokens
- Session-based: Login endpoint returns session token

## Core Entities

### Properties (Listings)

The central entity. Each property represents a real estate listing.

| Key Fields | Description |
|-----------|-------------|
| id | UUID |
| property_type | Type classification |
| property_subtype | Detailed subtype |
| status | Listing status |
| sale_rent | For sale or for rent |
| list_selling_price_amount | Listing price |
| bedrooms | Number of bedrooms |
| bathrooms | Number of bathrooms |
| internal_area | Internal area in sq.m. |
| covered_verandas | Covered verandas area |
| plot_area | Plot/land area |
| city | City/location |
| country | Country |
| description | Property description |
| coordinates | Lat/long |

**Associations**: Agents, Media, Features, Projects, Recommendations, Viewings, Offers

### Contacts (Clients)

Buyers, sellers, leads, and other persons.

| Key Fields | Description |
|-----------|-------------|
| id | UUID |
| first_name | First name |
| last_name | Last name |
| email | Email address |
| phone | Phone number |
| source | Lead source |
| status | Contact status |
| assigned_to | Assigned broker (User ID) |

**Associations**: Opportunities, Properties, Tasks, Calls, Meetings, Emails, Lists

### Opportunities (Deals)

Tracks buyer-side deals through the pipeline. In Qobrix UI this resource is often
labelled **Lead**; `Contract.opportunity_id` carries the same title. There is **no
enum** on `Opportunity.status` (`maxLength: 35`) — values are tenant **Workflow
Stages** (`GET /workflow-stages`).

**MSA surface partition** ([ADR-044](../architecture/decisions/ADR-044.md)): the
same Qobrix Opportunity is split across MSA **Leads** (pre-qualification:
`new`, `in_process`, `enquiry`, `asleep`, `not_interested`) and **Pipeline**
(sales: `potential`, `appointment`, `appt_follow_up`, `closed_won`,
`closed_lost`). Contracts do not change the surface; they override the pipeline
column (`reserved` → contracting, `agreed` → payment / Pending per ADR-029).

| Key Fields | Description |
|-----------|-------------|
| id | UUID |
| contact_id | Related contact |
| amount | Deal value |
| status | Tenant workflow stage (not a fixed enum) |
| probability | Close probability % |
| expected_close_date | Expected closing date |
| assigned_to | Responsible broker |
| custom_enquiry_stage_type | Disqualification reason when stage is Not Interested (`Agent \| Double \| Invalid Request \| Not Reached \| Referral \| Trash`) — **not** a stage itself |

### Property Viewings (Showings)

Records of property showings/appointments.

| Key Fields | Description |
|-----------|-------------|
| id | UUID |
| property_id | Viewed property |
| contact_id | Viewing client |
| date | Viewing date |
| feedback | Client feedback |
| result | Viewing outcome |

### Tasks (Follow-ups & Actions)

All follow-up tasks, reminders, and action items.

| Key Fields | Description |
|-----------|-------------|
| id | UUID |
| subject | Task title |
| description | Task details |
| due_date | Due date |
| status | Open/Completed/Overdue |
| assigned_to | Responsible user |
| related_to | Related entity (contact, property, opportunity) |

### Contracts (Agreements)

Listing agreements, purchase contracts. One overloaded entity (`contract_type`: `cos`, `tenancy_agreement`, `listing_for_sale`, `listing_for_rent`, `property_management`).

**Status-model caveat** ([ADR-029](../architecture/decisions/ADR-029.md)): `contract_status` terminates at `agreed` (`reserved | cancelled | agreed`) — Qobrix has no settlement state and operationally treated "agreed" as "deal closed". Canonically, **`agreed` maps to the `Pending` edge** (`PurchaseContractDate`), NOT to `Closed`; settlement (final payment + possession) is the `Closed` edge. Conveyance (`title_deed_status`) stays a project-flavour tracker. Cancellation maps deterministically: `date_of_contract IS NULL` → no canonical event; otherwise → `Back On Market`.

### Offers

Purchase offers on properties.

### Projects

Development projects containing multiple properties.

## Supporting Entities

| Entity | Purpose |
|--------|---------|
| **Agents** | Broker profiles and assignments |
| **Users** | System users with roles |
| **Groups** | User groups / teams |
| **Roles** | RBAC role definitions |
| **Workflows** | Automated workflow definitions |
| **Workflow Stages** | Pipeline stage definitions |
| **Action Plans** | Step-by-step action plan templates |
| **Campaigns** | Marketing campaign records |
| **Calls** | Phone call logs → migrates to `broker_meetings` (type=follow_up_call) with Outlook sync |
| **Meetings** | Meeting records → migrates to `broker_meetings` with Outlook calendar sync |
| **Email Messages** | Email correspondence → migrates to `opportunity_emails` (snapshots); live access via Exchange Online / Graph API |
| **SMS Messages** | SMS correspondence |
| **Media** | Photos, videos, documents |
| **Lists** | Custom lists (e.g., Curated Lists) |
| **Saved Searches** | Stored search criteria |
| **Feeds** | Property syndication feeds |
| **Portals** | External portal integrations |
| **Dashboards** | Dashboard configurations |
| **Widgets** | Dashboard widget definitions |

## API Patterns

### Search Expression Syntax
```
list_selling_price_amount <= 200000 and type in ["house", "apartment"] and status == "available"
```

Special variables: `CURRENT_USER`, `THIS_WEEK`, `TODAY`

### Pagination
```json
{
  "data": [...],
  "pagination": {
    "page_count": 4,
    "current_page": 1,
    "has_next_page": true,
    "count": 38,
    "limit": 10
  }
}
```

### Resource Expansion
```
GET /api/v2/properties/{id}?include[]=Agents&include[]=Media
```

### Partial Responses
```
GET /api/v2/contacts?field[]=first_name&field[]=last_name
```

## Capabilities to Replicate in Sharp Matrix

Qobrix provides capabilities that the Sharp Matrix Platform must match or exceed:

| Qobrix Capability | Sharp Matrix Target App | Canonical mapping |
|---|---|---|
| Property CRUD + search | matrix-pipeline (Listing Module integration) | Canonical RESO `Property` + `Property.StandardStatus`; AI-powered search via `listings-search` EF |
| Contact management | matrix-pipeline (FR-CON cluster), Client Portal | Canonical RESO `Contacts` with `ContactType` graduation (Lead → Prospect → Ready-to-Buy → Buyer/Seller); split across agent-facing matrix-pipeline and client self-service Client Portal |
| Deal pipeline (Opportunities) | matrix-pipeline (FR-FNL + FR-TM clusters) | Canonical 5-stage funnel projection over `(Contacts × SavedSearch)` (Qualification → Matching → Viewing → Contracting → Payment) + canonical `TransactionManagement` for offers/closing |
| Task management | matrix-pipeline (FR-ACT cluster) | Canonical RESO `Activity` with reminders and follow-up scheduling |
| Property viewings | matrix-pipeline (FR-SHOW cluster), Client Portal | Canonical 5-resource Showing chain (`ShowingAvailability` → `ShowingRequest` → `ShowingAppointment` → `Showing` → `LockOrBox`) |
| Media management | matrix-pipeline (Listing Module integration), Marketing App | Canonical RESO `Media` (photos / video / virtual tours) |
| Campaigns & marketing | Marketing App | Syndication, email campaigns, SMM (separate app) |
| Email correspondence | matrix-pipeline (broker role, O365 integration cluster) | `ms-graph-proxy` EF (email-messages / email-attach); attach to canonical `Activity` / `TransactionManagement` rows. Replaces Qobrix internal email module. |
| Meeting scheduling | matrix-pipeline (broker role, O365 integration cluster) | Outlook calendar sync via `ms-graph-proxy` (calendar-events / calendar-sync) → canonical `ShowingAppointment` / `Activity` rows; replaces Qobrix Meetings/Calls. |
| Dashboards & reporting | matrix-pipeline (manager role, FR-REP cluster) + BI Dashboard | Manager-role view over canonical state + Commission Engine ERP-lite forecast; BI Dashboard for leadership KPIs |
| Workflow automation | All apps | Platform-level workflow engine |
| API integrations (feeds, portals) | Integration Layer | API Gateway with RESO-compliant endpoints |

> **Consolidation note**: capabilities previously mapped to separate "Broker App" / "Manager App" rows are consolidated into matrix-pipeline 2.0. See [`product-specs/matrix-pipeline/`](../product-specs/matrix-pipeline/INDEX.md) for the canonical product spec.

## Full API Resource List

See [qobrix-api-summary.md](../references/qobrix-api-summary.md) for the complete endpoint catalog with 83 resource groups and 149 schemas. Use this as a reference when designing Sharp Matrix API endpoints.
