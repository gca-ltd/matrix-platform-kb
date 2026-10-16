# Dash/Anywhere.com — Practical Data Model

> Source: Dash (Anywhere.com) API — the SIR global listing platform
> ETL: `/home/bitnami/mls_2_0/scripts/load_dash_bronze.py` and `notebooks/01_dash_silver_*.py`
>
> **For Lovable**: This is the practical field reference for CDL-Connected apps.
> Use these field names in your Supabase tables. The RESO column shows the
> interoperability name used for syndication and the RESO Web API.

> **Field-by-field mapping to RESO DD lives in [`source-mappings/wiki/agent-docs/by_source/dash.md`](source-mappings/wiki/agent-docs/by_source/dash.md).**
> That page is auto-generated from `raw/dash/*.docx` + the curated `mapping_curated.csv`
> and is gate-validated against canonical RESO every regen. This page (the one
> you are reading) is narrative orientation about Dash itself — what it is, why
> we use it, the lifecycle. For Property-by-Property field correspondences see
> the by_source page above; for the cross-source view of one RESO resource
> see [`source-mappings/wiki/agent-docs/by_resource/`](source-mappings/wiki/agent-docs/by_resource/).

## Status: Primary bidirectional channel (SIR affiliate contract)

**Sharp Matrix** is the technology platform (CRM + FM + HR + MLS modules) powering **Sharp SIR**, a Sotheby's International Realty affiliate under the **Anywhere Brands / Anywhere.com** network. Sharp SIR currently operates in Cyprus, Hungary, and Kazakhstan (more markets planned). That makes Dash the **primary, bidirectional data channel** for the CDL — distinct from any generic syndication target:

| Direction | What flows | Source-of-record | When |
|---|---|---|---|
| **Outbound (CDL → Dash)** | Internally-sourced listings (`source_id = matrix-internal`, `lifecycle_state = Active`, `is_sir_branded = true`), our marketing copy, our media, our agent roster, our office hierarchy | Sharp Matrix | Every state transition that reaches `Active` and every subsequent edit (locked-fields-aware) |
| **Inbound (Dash → CDL)** | Sister-SIR-office listings (cross-brokerage referrals, global SIR network), brand-supplied marketing assets, brand-required field values | Other SIR offices via Anywhere | On Dash-network refresh (Phase-2.5 `dash-import` EF) |

The CDL `mls_sources` table classifies sources by `kind`:
- `internal` — `matrix-internal` (`matrix-pipeline` CRM, Atlas, future broker apps); target state for all Sharp SIR markets.
- `legacy-internal` — `qobrix` (Cyprus legacy CRM, currently exposed as `mls.sharpsir.group` RESO Web API; **being decommissioned once Atlas runs CY listing creation**). Marked `is_sunsetting = true`. HU + KZ Sharp SIR offices author directly in Dash today, so those markets are covered by the `dash` brand-network source rather than a separate legacy seed.
- **`brand-network`** — **Anywhere Dash** (this document); **bidirectional**; SIR-affiliate contract surface.
- `external` — third-party feeds we ingest from organizations outside Sharp SIR (real estate **developers** with new-build inventory, **partner brokerages** with referrals / co-broke listings, future industry MLS exchanges). Inbound only; onward syndication restricted by per-partner terms-of-use.

**Contract surface (Phase-1 deliverable, shipped Apr 2026)**: 7 `v_dash_*` views project RESO-keyed CDL tables to Dash naming. Storage stays RESO snake_case; views give Dash callers Dash-shaped names without a destructive schema rename. All views are `with (security_invoker = true)` so RLS evaluates as the caller.

| View | Backed by | Filter | Grants |
|---|---|---|---|
| `v_dash_properties` | `properties_published` | `is_visible AND NOT is_deleted AND lifecycle_state='Active'` | anon, authenticated |
| `v_dash_members` | `members` | `NOT is_deleted` | anon, authenticated |
| `v_dash_offices` | `offices` | `NOT is_deleted` | anon, authenticated |
| `v_dash_teams` | `teams` | `NOT is_deleted` | anon, authenticated |
| `v_dash_property_media` | `property_media JOIN properties` | `NOT properties.is_deleted` | anon, authenticated |
| `v_dash_open_houses` | `open_houses` | `NOT is_deleted` | anon, authenticated |
| `v_dash_contacts` | `contacts` | `NOT is_deleted` | **service_role only** (PII) |

The Phase-1 v_dash_properties is intentionally a minimal slice — full Dash field coverage (`propertyDetails.*`, `days_on_market`, `list_price_usd`, denormalised `office.*`) is deferred to the Phase-2.5 `dash-export` EF, which assembles the wire-format Dash payload by reading exclusively through these views. The Phase-2.5 `dash-import` EF normalises incoming Dash records into the underlying RESO-keyed tables. See [data-distribution-and-stewardship.md](../architecture/data-distribution-and-stewardship.md) and the `cdl-mls-sync-full-reso` plan.

Storage uses the `x_*` platform-extension prefix (per [platform-extensions.md](platform-extensions.md)); the views alias them to bare Dash names — `properties.x_is_sir_branded` → `is_sir_branded`, `properties.x_sir_office_id` → `sir_office_id`, `members.x_sir_designation` → `designation`.

**SIR brand markers** carried alongside RESO fields:
- `properties.is_sir_branded boolean` — listing displays SIR branding on outbound feeds.
- `properties.sir_office_id text` — the SIR office identifier (distinct from the general `office_key`).
- `members.sir_designation text` — e.g. `'SIR Associate'`, `'SIR Senior Global Advisor'`.

Other SIR-required fields stay in `marketing_metadata jsonb` until the Dash API contract is fully audited.

## Why Dash Is the Core Data Model

RESO DD 2.0 is an industry interoperability standard — useful for data exchange but abstract. Dash/Anywhere.com is the actual platform Sharp SIR brokers use daily. Its fields are concrete, well-structured, and map directly to real brokerage workflows.

| Aspect | Dash/Anywhere.com | RESO DD 2.0 |
|--------|-------------------|-------------|
| Origin | SIR global platform (production) | Industry standards body (specification) |
| Fields | 50+ concrete fields with codes | 1000+ fields, most unused |
| Features | 30+ grouped categories with codes | Flat field lists |
| Media | Dimensions, resolution URLs, tags | Basic URL + category |
| Role | **Practical core** for app development | **Interop standard** for syndication |

## Core Property Fields

### Identifiers

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `listingGuid` | string | `id` | `ListingKey` | Unique listing identifier |
| `listingId` | string | `ref` | `ListingId` | Human-readable listing reference |
| `statusCode` | string | `status` | `StandardStatus` | AC, AV, PS, CL, WD |
| `statusDescription` | string | `status_description` | — | Full status text |

**Status mapping**: `AC` → Active, `AV` → Available (on-market, same bucket as Active), `PS` → Pending, `CL` → Closed, `WD` → Withdrawn. A Hungary listings export (`HSIR_Listings_Dash_backend_export`, October 2026) used `AC` and `AV` for live listings. MLS treats `AV` as active (`AC`) when it checks syndication readiness. The full wire shape of that export is recorded in `matrix-mls` `docs/dash/export-contract.md`; this page stays the CDL view model.

### Pricing

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `listPrice` | number | `list_price` | `ListPrice` | Listing price in local currency |
| `listPriceInUSD` | number | `list_price_usd` | — | Price converted to USD |
| `currencyCode` | string | `currency_code` | — | ISO currency code (EUR, USD, HUF, KZT) |
| `currencyName` | string | `currency_name` | — | Currency display name |

### Property Details

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `propertyDetails.typeDescription` | string | `property_type` | `PropertyType` | Apartment, House, Land, etc. |
| `propertyDetails.typeCode` | string | `property_type_code` | — | Type code for lookups |
| `propertyDetails.subtypeDescription` | string | `property_subtype` | `PropertySubType` | Penthouse, Villa, Duplex, etc. |
| `propertyDetails.subtypeCode` | string | `property_subtype_code` | — | Subtype code for lookups |
| `propertyDetails.propertyName` | string | `name` | — | Property marketing name |
| `propertyDetails.styleCode` | string | `style_code` | — | Architectural style code |
| `propertyDetails.styleDescription` | string | `style_description` | — | Architectural style text |
| `propertyDetails.noOfBedrooms` | number | `bedrooms` | `BedroomsTotal` | Total bedrooms |
| `propertyDetails.fullBath` | number | `bathrooms` | `BathroomsTotalInteger` | Full bathrooms |
| `propertyDetails.halfBath` | number | `half_bath` | `BathroomsHalf` | Half bathrooms |
| `propertyDetails.livingArea` | number | `living_area` | `LivingArea` | Interior living area |
| `propertyDetails.livingAreaUnitCode` | string | `living_area_unit` | `LivingAreaUnits` | SF or SM |
| `propertyDetails.buildingArea` | number | `building_area` | — | Total building area |
| `propertyDetails.buildingAreaUnitCode` | string | `building_area_unit` | — | SF or SM |
| `propertyDetails.lotSize` | number | `lot_size` | `LotSizeSquareFeet` | Land/lot area |
| `propertyDetails.lotSizeUnitCode` | string | `lot_size_unit` | `LotSizeUnits` | SF, SM, or AC |
| `propertyDetails.yearBuilt` | number | `year_built` | `YearBuilt` | Year of construction |

### Location

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `propertyDetails.location.countryCode` | string | `country` | `Country` | ISO country code |
| `propertyDetails.location.countryName` | string | `country_name` | — | Full country name |
| `propertyDetails.location.stateProvinceCode` | string | `state` | `StateOrProvince` | State/province code |
| `propertyDetails.location.stateProvinceName` | string | `state_name` | — | State/province name |
| `propertyDetails.location.city` | string | `city` | `City` | City name |
| `propertyDetails.location.district` | string | `district` | — | District/neighborhood |
| `propertyDetails.location.postalCode` | string | `post_code` | `PostalCode` | Postal/ZIP code |
| `propertyDetails.location.addressLine1` | string | `street` | `UnparsedAddress` | Street address |
| `propertyDetails.location.latitude` | number | `latitude` | `Latitude` | GPS latitude |
| `propertyDetails.location.longitude` | number | `longitude` | `Longitude` | GPS longitude |

### Dates

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `listedDate` | string | `listed_date` | `ListingContractDate` | Date listing was created |
| `lastUpdateOn` | timestamp | `modified_ts` | `ModificationTimestamp` | Last modification timestamp |
| `daysOnMarket` | number | `days_on_market` | — | Days since listing went live |
| `additionalDetails.expiresOn` | string | `expiration_date` | — | Listing expiration date |

### Business Flags

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `isOffTheMarket` | boolean | `is_off_market` | — | Listing removed from market |
| `isForAuction` | boolean | `is_for_auction` | — | Auction listing |
| `isNewConstruction` | boolean | `is_new_construction` | — | New build property |
| `isCallToShow` | boolean | `is_call_to_show` | — | Showing requires phone call |
| `isPriceUponRequest` | boolean | `is_price_upon_request` | — | Price not disclosed |
| `isForeclosure` | boolean | `is_foreclosure` | — | Foreclosure/distressed sale |

### Agent & Office

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `primaryAgent.personGuid` | string | `agent_id` | `ListAgentKey` | Agent unique ID |
| `primaryAgent.firstName` | string | `agent_first_name` | — | Agent first name |
| `primaryAgent.lastName` | string | `agent_last_name` | — | Agent last name |
| `primaryAgent.primaryEmailAddress` | string | `agent_email` | — | Agent email |
| `primaryAgent.vanityEmailAddress` | string | `agent_vanity_email` | — | Agent branded email |
| `primaryAgent.defaultPhotoUrl` | string | `agent_photo_url` | — | Agent photo URL |
| `primaryAgent.company.companyGuid` | string | `company_id` | — | Company UUID |
| `primaryAgent.company.companyName` | string | `company_name` | — | Company name |
| `primaryAgent.primaryOffice.officeGuid` | string | `agent_office_id` | — | Agent's office UUID |
| `office.officeGuid` | string | `listing_office_id` | `ListOfficeKey` | Listing office UUID |
| `office.officeId` | string | `listing_office_code` | — | Listing office code |

### Remarks

Multi-language remark array:

```json
{
  "remark": "Luxury seafront apartment...",
  "remarkType": "PublicRemarks",
  "language": "en"
}
```

| Supabase Column | RESO Equivalent | Description |
|----------------|-----------------|-------------|
| `remarks_json` | — | Full remarks array (all languages) |
| `public_remarks` | `PublicRemarks` | First remark text extracted |

## Feature Groups (30+)

Features come as a structured array with `featureGroupDescription`, `featureCode`, and `featureDescription`. The ETL pipeline groups them into columns:

### RESO-Aligned Feature Groups

| Dash Feature Group | Supabase Column | RESO Equivalent |
|-------------------|----------------|-----------------|
| Cooling | `cooling_features` | `Cooling` |
| Heating Type | `heating_features` | `Heating` |
| Heating - Fuel Type | `heating_fuel` | — |
| Pool Description | `pool_features` | `PoolFeatures` |
| Fireplace Description | `fireplace_features` | `FireplaceFeatures` |
| Fireplace Count | `fireplaces_total` | — |
| Garage Description | `garage_features` | `ParkingFeatures` |
| Garage Count | `garage_spaces` | — |
| Flooring | `flooring` | `Flooring` |
| Views | `view` | `View` |
| Fencing | `fencing` | `Fencing` |
| Exterior Living Space | `patio_porch_features` | `PatioAndPorchFeatures` |
| Appliances | `appliances` | — |
| Amenities | `amenities` | `AssociationAmenities` |
| Body of Water | `waterfront_features` | `WaterfrontFeatures` |

### Dash-Specific Feature Groups

| Dash Feature Group | Supabase Column | Description |
|-------------------|----------------|-------------|
| Exterior | `exterior_features` | Exterior construction/materials |
| Exterior Description | `exterior_description` | Exterior narrative |
| Interior | `interior_features` | Interior finishes/materials |
| Kitchen Features | `kitchen_features` | Kitchen type and features |
| Bath Features | `bath_features` | Bathroom features |
| Basement | `basement` | Basement type |
| Roof | `roof` | Roof material/type |
| Water | `water_source` | Water supply source |
| Sewer | `sewer` | Sewer connection type |
| Electrical | `electric` | Electrical features |
| Lot Description | `lot_features` | Land/lot characteristics |
| Rooms | `room_type` | Room types in property |
| Road Type | `road_surface` | Road surface type |
| Age | `property_condition` | Property condition/age |
| Community Type | `community_features` | Community/HOA features |
| Lifestyles | `lifestyles` | Lifestyle tags (golf, beach, etc.) |
| Special Market | `special_market` | Special market flags |
| Area Amenities | `area_amenities` | Nearby amenities |
| Area Description | `area_description` | Area narrative |
| General | `general_features` | Uncategorized features |
| Pre-Wiring | `prewiring` | Pre-wiring for tech/media |
| Property Description | `property_description_features` | General property features |
| Location | `location_features` | Location-specific features |

Feature values are stored as comma-separated strings in Supabase. Use `string.split(',')` for dropdowns and multi-select filters.

## Media Fields

| Dash Field | Type | Supabase Column | RESO Equivalent | Description |
|-----------|------|----------------|-----------------|-------------|
| `mediaGuid` | string | `media_id` | `MediaKey` | Unique media ID |
| `sequenceNumber` | number | `display_order` | `Order` | Sort order |
| `category` | string | `dash_category` | — | Dash category tag |
| `isDefault` | boolean | `is_primary` | `Primary` | Primary/hero image flag |
| `url` | string | `media_url` | `MediaURL` | Full-size media URL |
| `caption` | string | `title` | `MediaCaption` | Media caption |
| `description` | string | `description` | `MediaDescription` | Media description |
| `formatCode` | string | `mime_type` | `MediaCategory` | IM=Image, VI=Video, DO=Document |
| `height` | number | `image_height` | `ImageHeight` | Image height in pixels |
| `width` | number | `image_width` | `ImageWidth` | Image width in pixels |
| `isLandscape` | boolean | `is_landscape` | — | Landscape orientation flag |
| `isDistributable` | boolean | `is_distributable` | — | Can be sent to portals |
| `resolutionUrls` | array | — | — | Multiple resolution variants |
| `mediaTags` | array | `media_tags_json` | — | Structured tags array |

## Data Sources by Market

| Market | Office Key | Source | Method |
|--------|-----------|--------|--------|
| Cyprus | `SHARPSIR-CY-001` | Qobrix API | REST API pull |
| Kazakhstan | `SHARPSIR-KZ-001` | Dash API | REST API pull (Okta OAuth) |
| Hungary | `SHARPSIR-HU-001` | Dash FILE | JSON file import |

## Cross-Reference

| For | See |
|-----|-----|
| How this data reaches Supabase | [etl-pipeline.md](etl-pipeline.md) |
| RESO interop field names | [`reso-dd-kb/wiki/agent-docs/resources/property.md`](reso-dd-kb/wiki/agent-docs/resources/property.md) (or any other resource) |
| Platform extension fields | [platform-extensions.md](platform-extensions.md) |
| How to build apps that use this data | [app-template.md](../platform/app-template.md) |
