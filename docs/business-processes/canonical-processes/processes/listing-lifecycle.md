# Listing lifecycle (canonical, RESO DD 2.0)

The end-to-end state machine of a `Property` listing as it moves
from intake to closed (or terminal non-close), expressed entirely in
RESO DD 2.0 vocabulary.

> **Integration links** (other layers documenting this resource):
>
> - Source mapping (Dash / Qobrix / SIR -> RESO `Property`):
>   [`../../../data-models/source-mappings/wiki/agent-docs/by_resource/property.md`](../../../data-models/source-mappings/wiki/agent-docs/by_resource/property.md)
> - Sharp-SIR flavour pipeline: materialised by the CRM Listing
>   Module
>   ([`product-specs/matrix-pipeline/wiki/integration.md#listing-module`](../../../product-specs/matrix-pipeline/wiki/integration.md#listing-module))
>   and the FR-LST-* requirements
>   ([`product-specs/matrix-pipeline/wiki/requirements.md`](../../../product-specs/matrix-pipeline/wiki/requirements.md))
> - One-stop integrated view:
>   [`../../../integration/wiki/agent-docs/by_resource/property.md`](../../../integration/wiki/agent-docs/by_resource/property.md)

This is the canonical baseline. Project-specific flavours (e.g.
Sharp-SIR exclusive vs. open-listing nuances, agreement-signed
checkpoints, lead-doc emails) belong in
[`docs/business-processes/`](../../index.md);
they MUST map their stages onto the states defined here.

## Scope

In scope:

- The `StandardStatus` and `MlsStatus` state machines on a single
  `Property` record.
- The fields that MUST change at each transition.
- The `HistoryTransactional` rows the transition emits.
- Cross-references to the showing, open-house, lead-contact, media,
  and transaction lifecycles.

Out of scope:

- Pre-listing prospecting (lives in
  [`lead-contact-lifecycle.md`](lead-contact-lifecycle.md)).
- Closing-out money flow (lives in
  [`transaction-lifecycle.md`](transaction-lifecycle.md)).
- Showings/open houses while Active (separate state machines, listed
  as cross-references below).
- Matrix MLS seller-side **UI ownership** (opportunity vs inventory
  record vs deal, navigation lenses, projects as one mandate + unit
  grid): [ADR-064](../../../architecture/decisions/ADR-064.md). This
  document remains the RESO `Property` state machine only.

## Matrix MLS UI ownership (cross-reference)

| Where brokers edit | Owns |
|---|---|
| Seller opportunity workspace | Seller, mandate, qualification, CMA, confidential price, seller reports, opportunity tasks |
| Inventory record (listing / project) | Property facts, media, publication, showings, read-only offers, documents on file, unit grid (projects) |
| Deal (workspace Negotiation / Closing gates) | Buyer, offer, reservation, contract, closing checklist |

List/Grid/Map open the **record** when it exists; the **Board** opens the **workspace** at the matching gate. See ADR-064.

## Primary state machine: `Property.StandardStatus`

`StandardStatus` is the locked-with-enumerations field every IDX
consumer reads first. It is the canonical state of the listing.

```mermaid
stateDiagram-v2
    [*] --> Incomplete: intake started
    Incomplete --> ComingSoon: agreement signed,<br/>not yet marketable
    Incomplete --> Active: agreement signed,<br/>marketable now
    ComingSoon --> Active: OnMarketDate reached
    Active --> Hold: temporarily<br/>not showable
    Hold --> Active: hold released
    Active --> ActiveUnderContract: offer accepted,<br/>kick-out / backups OK
    Active --> Pending: offer accepted,<br/>no backups
    ActiveUnderContract --> Pending: contingencies cleared
    ActiveUnderContract --> Active: contract fell through
    Pending --> Closed: deed recorded /<br/>CloseDate set
    Pending --> Active: contract fell through
    Active --> Withdrawn: seller withdrew,<br/>contract still alive
    Active --> Canceled: contract canceled
    Active --> Expired: ListingContractDate +<br/>term elapsed
    Withdrawn --> Active: relisted under same contract
    Closed --> [*]
    Canceled --> [*]
    Expired --> [*]
    Withdrawn --> [*]: contract terminated
    note right of Incomplete
      StandardStatus = Incomplete
      means data entry not yet
      complete; record is NOT
      yet syndicated.
    end note
    note right of Active
      Default Active value per
      reso-dd-kb. IDX/OM payloads
      surface from Active onward.
    end note
```

Notes on the diagram:

- `Delete` is a tombstone state for hard-deleted records and is not
  drawn as a node here; it is reached only via system-level
  expungement, never through a normal business transition.
- `Active` has reflexive edits (price changes, photo changes) that
  do not change `StandardStatus` but DO emit `MlsStatus = Price
  Change` and `HistoryTransactional` rows; see "Reflexive Active
  edits" below.

### Transition table

Every row below corresponds to exactly one `HistoryTransactional`
write; the `MajorChangeType` value is the controlled label written
into the audit row's `ChangeType`.

| From | To | Trigger | Required field changes | `Property.MajorChangeType` |
|---|---|---|---|---|
| `[*]` | `Incomplete` | Listing record created, listing agreement not yet signed | `ListingId`, `ListingKey`, `ListAgentKey`, `ListOfficeKey`, `OriginalListPrice`, `ListPrice` set | (no `MajorChangeType` row yet) |
| `Incomplete` | `Coming Soon` | Listing agreement signed; `OnMarketDate` set in the future | `StandardStatus`, `MlsStatus`, `ListingContractDate`, `OnMarketDate`, `StatusChangeTimestamp` | `New Listing` |
| `Incomplete` | `Active` | Listing agreement signed; `OnMarketDate` is today | `StandardStatus`, `MlsStatus`, `ListingContractDate`, `OnMarketDate`, `StatusChangeTimestamp` | `New Listing` |
| `Coming Soon` | `Active` | `OnMarketDate` reached | `StandardStatus`, `MlsStatus`, `StatusChangeTimestamp` | `Active` |
| `Active` | `Hold` | Seller pauses showings | `StandardStatus`, `MlsStatus`, `StatusChangeTimestamp` | `Hold` |
| `Hold` | `Active` | Hold released | `StandardStatus`, `MlsStatus`, `StatusChangeTimestamp` | `Active` |
| `Active` | `Active Under Contract` | Offer accepted, listing still showable to backup buyers | `StandardStatus`, `MlsStatus`, `ContractStatusChangeDate`, `StatusChangeTimestamp` | `Active Under Contract` |
| `Active` / `Active Under Contract` | `Pending` | Contingencies cleared (or none) | `StandardStatus`, `MlsStatus`, `PurchaseContractDate`, `PendingTimestamp`, `ContractStatusChangeDate`, `StatusChangeTimestamp` | `Pending` |
| `Active Under Contract` / `Pending` | `Active` | Contract fell through; relist | `StandardStatus`, `MlsStatus`, `ContractStatusChangeDate`, `StatusChangeTimestamp` | `Back On Market` |
| `Pending` | `Closed` | Title transferred / deed recorded | `StandardStatus`, `MlsStatus`, `CloseDate`, `OffMarketDate`, `StatusChangeTimestamp` | `Closed` |
| `Active` | `Withdrawn` | Seller withdrew, contract still alive | `StandardStatus`, `MlsStatus`, `WithdrawnDate`, `OffMarketDate`, `StatusChangeTimestamp` | `Withdrawn` |
| `Active` | `Canceled` | Listing contract canceled | `StandardStatus`, `MlsStatus`, `CancellationDate`, `OffMarketDate`, `StatusChangeTimestamp` | `Canceled` |
| `Active` | `Expired` | `ListingContractDate + term` reached without close | `StandardStatus`, `MlsStatus`, `ExpirationDate`, `OffMarketDate`, `StatusChangeTimestamp` | `Expired` |

### Reflexive `Active` edits

These are edits that mutate the listing without changing
`StandardStatus`, but MUST still be persisted as a
`HistoryTransactional` row and reflected in `MlsStatus`:

| Trigger | Field changes | `MajorChangeType` |
|---|---|---|
| Price reduced or raised | `PreviousListPrice = old ListPrice`, `ListPrice`, `PriceChangeTimestamp`, `MajorChangeTimestamp` | `Price Change` |
| Media added/removed | `Media`, `ModificationTimestamp`; no `MajorChangeType` row required, but `HistoryTransactional` row emitted | n/a |
| Description / remarks edited | `ModificationTimestamp` | n/a |

## Secondary state: `Property.MlsStatus`

`MlsStatus` is an OPEN lookup (RESO publishes a suggested set but
MLSs may extend). The canonical baseline writes `MlsStatus` lockstep
with `StandardStatus` using the suggested values:

- `Active` while `StandardStatus = Active`
- `Coming Soon` while `StandardStatus = Coming Soon`
- `Pending` while `StandardStatus = Pending`
- `Active Under Contract` while `StandardStatus = Active Under Contract`
- `Hold` while `StandardStatus = Hold`
- `Closed` while `StandardStatus = Closed`
- `Withdrawn`, `Canceled`, `Expired` mirror their `StandardStatus`
  counterparts
- `Price Change` is written transiently on a price reflex; the next
  read should already see `Active`

Project-specific extensions (e.g. `Pending Continue To Show`,
`Pending Taking Backups`) are NOT canonical here; record them in the
project flavour under
[`docs/business-processes/`](../../index.md).

## Orthogonal state: `Property.DevelopmentStatus` (land / new-construction)

For new-construction, off-plan, and bare-land listings, RESO carries
a SECOND state machine on the same `Property` row, orthogonal to
`StandardStatus`. `DevelopmentStatus` is a multi-value open lookup
with 10 published values describing how built-out the parcel is.

```mermaid
stateDiagram-v2
    [*] --> Proposed: project announced,<br/>parcel not yet acquired
    Proposed --> RawLand: parcel acquired,<br/>untouched
    RawLand --> RoughGrade: clearing / grading complete
    RoughGrade --> SitePlanFiled: site plan submitted to authority
    SitePlanFiled --> SitePlanApproved: authority approved
    SitePlanApproved --> FinishedLots: subdivision lots ready
    SitePlanApproved --> UnderConstruction: vertical build started
    FinishedLots --> UnderConstruction: per-lot build started
    UnderConstruction --> Completed: certificate of occupancy
    Completed --> [*]
    [*] --> Other: bespoke / not-yet-classified
    [*] --> SeeRemarks: explanatory text in PublicRemarks
```

`DevelopmentStatus` lookup values:
`Proposed`, `Raw Land`, `Rough Grade`, `Site Plan Filed`,
`Site Plan Approved`, `Finished Lot(s)`, `Under Construction`,
`Completed`, `Other`, `See Remarks`.

Notes:

- `DevelopmentStatus` is multi-value: a single `Property` MAY carry
  more than one value (e.g. `Site Plan Approved`, `Finished Lot(s)`
  while phased subdivisions are in different sub-states).
- Applies primarily to the `LAND` property class but the field is
  open to other classes when relevant.
- `DevelopmentStatus` is independent from `StandardStatus`: a parcel
  can be `StandardStatus = Active` while `DevelopmentStatus = Raw
  Land` (selling pre-build) or `StandardStatus = Pending` while
  `DevelopmentStatus = Under Construction` (buyer locked in
  mid-build).
- Any `DevelopmentStatus` change emits a `HistoryTransactional` row
  with `FieldName = DevelopmentStatus`.

## Orthogonal state: `Property.DocumentStatus` (per-document workflow)

`DocumentStatus` is an open lookup with 16 published values tracking
the listing's paperwork state - signed agreements, disclosures,
inspections, contracts. The canonical baseline treats this as a
PER-DOCUMENT state machine: each document attached to the listing
(via `Media` with `MediaCategory = Document` or via project-specific
storage) carries its own `DocumentStatus`.

```mermaid
stateDiagram-v2
    [*] --> Required: agent / template marks doc required
    [*] --> Optional: doc is optional for this listing
    Required --> Missing: deadline passed,<br/>no document submitted
    Required --> Submitted: party submitted document
    Optional --> Submitted: party submitted document
    Missing --> Submitted: late submission
    Submitted --> Received: counterparty acknowledged receipt
    Received --> Delivered: routed to next signer / counterparty
    Delivered --> Accepted: counterparty accepted
    Delivered --> Countered: counterparty proposed changes
    Delivered --> Rejected: counterparty refused
    Countered --> Submitted: revised version submitted
    Accepted --> Signed: signature(s) captured
    Signed --> InEscrow: held by escrow / closing agent
    Signed --> Finalized: fully executed,<br/>no more edits
    InEscrow --> Finalized: escrow released
    Finalized --> Published: publicly visible
    Finalized --> Archived: deal closed,<br/>retention only
    Published --> Archived: deal closed,<br/>retention only
    Rejected --> [*]
    Archived --> [*]
    [*] --> Changed: revised version superseding<br/>a previously submitted doc
    Changed --> Submitted: revised version flows back in
    [*] --> Deleted: mistakenly added,<br/>removed
    Deleted --> [*]
```

`DocumentStatus` lookup values:
`Required`, `Optional`, `Missing`, `Submitted`, `Received`,
`Delivered`, `Accepted`, `Countered`, `Rejected`, `Signed`,
`In Escrow`, `Finalized`, `Published`, `Archived`, `Changed`,
`Deleted`.

Notes:

- `DocumentStatus` is single-value: each document carries exactly
  one current state.
- `DocumentStatus` is a **`Property` field** (corpus-verified:
  `Property.DocumentStatus`; RESO has **no** `Media.DocumentStatus`).
  RESO carries the document state inline on `Property`, then references
  the `Media` payload. When a listing has multiple documents, the
  canonical baseline aggregates the worst case to `Property.DocumentStatus`.
  Per-document state on individual `Media` rows is **not canonical** — if a
  project needs it, it requires a **registered** `x_doc_status` extension
  ([platform-extensions.md](../../../data-models/platform-extensions.md));
  it is spec-only today and SHOULD be avoided in favour of the single
  `Property.DocumentStatus` source.
- `DocumentStatus` is independent from `StandardStatus` and
  `DevelopmentStatus`: a listing in `StandardStatus = Active` may
  have `DocumentStatus = Missing` (listing-agreement still
  outstanding) and a listing in `StandardStatus = Pending` MUST
  have `DocumentStatus IN (Signed, In Escrow, Finalized)` for the
  pending status to be defensible.
- Any `DocumentStatus` change emits a `HistoryTransactional` row
  with `FieldName = DocumentStatus`.
- `Deleted` and `Changed` are bookkeeping states for revisions;
  they MUST NOT be used as terminal states for live listings.

## Decision points

| Decision | Inputs | Outputs |
|---|---|---|
| Coming Soon vs. Active at intake | `OnMarketDate` vs. today | `StandardStatus = Coming Soon` if future, else `Active` |
| Pending vs. Active Under Contract | `ListingAgreement` allows backups? contingencies remaining? | `Active Under Contract` if backups OK, else `Pending` |
| Withdrawn vs. Canceled vs. Expired | Did contract end? Did term expire? | `Canceled` if contract ended; `Withdrawn` if seller stepped back but contract alive; `Expired` if term elapsed |
| Closed vs. fell-through | Deed recorded? | `Closed` (set `CloseDate`) vs. `Back On Market` (set `MlsStatus = Active`) |

## Cross-resource interactions

- `Showing` / `ShowingRequest`: only valid while `StandardStatus IN
  (Active, Coming Soon, Active Under Contract)` and the listing-side
  `Showing.ShowingStatus = Accepting Requests` (corpus-verified:
  `ShowingStatus` is a **`Showing`** field — there is no
  `Property.ShowingStatus`; values `Accepting Requests` / `On Hold` /
  `No Showings` / `Restricted Showings`). See
  [`showing-lifecycle.md`](showing-lifecycle.md).
- Stage-side CY reservation (Offer Acceptance / deposit deadline) lives
  in the Sales Automation app until CDL gains `reserveListing` —
  see [`reservation-lifecycle.md`](reservation-lifecycle.md) and
  ADR-029's future refinement.
- `OpenHouse`: only valid while `StandardStatus = Active`. See
  [`open-house-lifecycle.md`](open-house-lifecycle.md).
- `ContactListings`: a contact's "favourite" survives status
  changes; expiring/closing the listing freezes it in their list.
  See [`lead-contact-lifecycle.md`](lead-contact-lifecycle.md).
- `Media`: media publication state is gated on
  `StandardStatus`; see [`media-lifecycle.md`](media-lifecycle.md).
- `HistoryTransactional`: every transition above writes one row with
  `ResourceName = Property`, `ResourceRecordKey = ListingKey`,
  `FieldName = StandardStatus`, `PreviousValue`, `NewValue`,
  `ChangedByMemberKey`. See
  [`transaction-lifecycle.md`](transaction-lifecycle.md).

## Identifier semantics

- `ListingKey` is the system-of-record opaque PK; never re-used,
  never edited.
- `ListingId` is the human-facing MLS number; may be re-used across
  relists in some jurisdictions but the canonical baseline says do
  NOT re-use.
- `ListAgentKey` / `ListOfficeKey` cite the listing-side `Member`
  and `Office`; co-listing uses `CoListAgentKey`. These are
  immutable while the listing is live; transferring to a new agent
  is modelled by writing a new `Property` record (and a
  `HistoryTransactional` row pointing back to the old key).

## Non-goals

- No opinion on commission terms. Listing-side buyer-broker
  compensation is canonical: `Property.BuyerBrokerageCompensation` +
  `Property.BuyerBrokerageCompensationType` (`CompensationType`: `%` /
  `$` / `Other` / `See Remarks`). The legacy `x_commission_pct` mirror
  in the [`source-mappings/`](../../../data-models/source-mappings/README.md)
  layer is a non-canonical extension and SHOULD migrate to those fields.
- No opinion on `ListingAgreement` enumerations beyond the controlled
  RESO list; project flavours pick which subset to allow.
- No opinion on photo-min counts or remark length; those are
  project-flavour rules.

<!-- reso-citations
Resource: Property
Resource: HistoryTransactional
Field: Property.ListingId
Field: Property.ListingKey
Field: Property.StandardStatus
Field: Property.MlsStatus
Field: Property.ListPrice
Field: Property.OriginalListPrice
Field: Property.PreviousListPrice
Field: Property.ListingContractDate
Field: Property.OnMarketDate
Field: Property.OffMarketDate
Field: Property.CloseDate
Field: Property.PendingTimestamp
Field: Property.PurchaseContractDate
Field: Property.ContractStatusChangeDate
Field: Property.StatusChangeTimestamp
Field: Property.WithdrawnDate
Field: Property.CancellationDate
Field: Property.ExpirationDate
Field: Property.MajorChangeType
Field: Property.MajorChangeTimestamp
Field: Property.PriceChangeTimestamp
Field: Property.ModificationTimestamp
Field: Property.ListAgentKey
Field: Property.ListOfficeKey
Field: Property.CoListAgentKey
Field: Property.ListingAgreement
Field: Property.Media
Field: HistoryTransactional.ResourceName
Field: HistoryTransactional.ResourceRecordKey
Field: HistoryTransactional.FieldName
Field: HistoryTransactional.PreviousValue
Field: HistoryTransactional.NewValue
Field: HistoryTransactional.ChangeType
Field: HistoryTransactional.ChangedByMemberKey
LookupValue: StandardStatus.Incomplete
LookupValue: StandardStatus.Coming Soon
LookupValue: StandardStatus.Active
LookupValue: StandardStatus.Active Under Contract
LookupValue: StandardStatus.Pending
LookupValue: StandardStatus.Closed
LookupValue: StandardStatus.Hold
LookupValue: StandardStatus.Withdrawn
LookupValue: StandardStatus.Canceled
LookupValue: StandardStatus.Expired
LookupValue: StandardStatus.Delete
LookupValue: ChangeType.New Listing
LookupValue: ChangeType.Active
LookupValue: ChangeType.Coming Soon
LookupValue: ChangeType.Pending
LookupValue: ChangeType.Active Under Contract
LookupValue: ChangeType.Closed
LookupValue: ChangeType.Hold
LookupValue: ChangeType.Withdrawn
LookupValue: ChangeType.Canceled
LookupValue: ChangeType.Expired
LookupValue: ChangeType.Back On Market
LookupValue: ChangeType.Price Change
Field: Property.DevelopmentStatus
Field: Property.DocumentStatus
LookupValue: DevelopmentStatus.Proposed
LookupValue: DevelopmentStatus.Raw Land
LookupValue: DevelopmentStatus.Rough Grade
LookupValue: DevelopmentStatus.Site Plan Filed
LookupValue: DevelopmentStatus.Site Plan Approved
LookupValue: DevelopmentStatus.Finished Lot(s)
LookupValue: DevelopmentStatus.Under Construction
LookupValue: DevelopmentStatus.Completed
LookupValue: DevelopmentStatus.Other
LookupValue: DevelopmentStatus.See Remarks
LookupValue: DocumentStatus.Required
LookupValue: DocumentStatus.Optional
LookupValue: DocumentStatus.Missing
LookupValue: DocumentStatus.Submitted
LookupValue: DocumentStatus.Received
LookupValue: DocumentStatus.Delivered
LookupValue: DocumentStatus.Accepted
LookupValue: DocumentStatus.Countered
LookupValue: DocumentStatus.Rejected
LookupValue: DocumentStatus.Signed
LookupValue: DocumentStatus.In Escrow
LookupValue: DocumentStatus.Finalized
LookupValue: DocumentStatus.Published
LookupValue: DocumentStatus.Archived
LookupValue: DocumentStatus.Changed
LookupValue: DocumentStatus.Deleted
-->
