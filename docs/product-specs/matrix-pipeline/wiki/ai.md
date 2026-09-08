---
title: AI Broker Co-Pilot — features + implementation plan
status: stable
source: raw/context-v2.md §9.13, §9.14
last_updated: 2026-05-26
tags: [ai]
---

# AI Broker Co-Pilot — features + implementation plan

> AI is used as a Broker Co-Pilot — an intelligent helper that reduces admin load, speeds up reactions, helps brokers understand clients, match properties, prepare communications, run follow-ups, and move deals to closing. **Not** an autonomous broker. Human-in-the-loop for everything client-facing; canonical-RESO-only data (no AI-only fields); luxury tone-of-voice; explainable recommendations.

## TOC

- [#overview](#overview)
- [#principles](#principles)
- [#daily-priorities](#daily-priorities) — FR-AI-DSA
- [#briefing](#briefing) — FR-AI-BRF
- [#lead-qualification](#lead-qualification) — FR-AI-LQ
- [#property-matching](#property-matching) — FR-AI-PM
- [#proposal](#proposal) — FR-AI-PROP
- [#communication-drafting](#communication-drafting) — FR-AI-COM
- [#viewing-assistant](#viewing-assistant) — FR-AI-VIEW
- [#negotiation-support](#negotiation-support) — FR-AI-NEG
- [#deal-margin-coach](#deal-margin-coach) — FR-AI-MAR
- [#relationship-intelligence](#relationship-intelligence) — FR-AI-RI
- [#market-intelligence](#market-intelligence) — FR-AI-MKT
- [#knowledge-assistant](#knowledge-assistant) — FR-AI-KB
- [#data-capture](#data-capture) — FR-AI-DATA
- [#client-concierge](#client-concierge) — FR-AI-CONC
- [#governance](#governance) — FR-AI-GOV
- [#forbidden-scenarios](#forbidden-scenarios)
- [#mvp-recommended](#mvp-recommended)
- [#roadmap](#roadmap)
- [#implementation-plan](#implementation-plan)

## Overview {#overview}

For a luxury real-estate agency, AI must **augment** human expertise and the premium personal-service level — not create a sense of mass automation. The client buys not only the property but also trust, confidentiality, status, expertise, and the quality of being supported through the deal. The AI Copilot lives **across all entities** (Contacts, SavedSearch, Prospecting, ContactListings, Showing chain, TransactionManagement) — see [wiki/entities.md](entities.md) — and reads / writes exclusively canonical RESO fields plus app-private `Activity` / `HistoryTransactional` rows.

Source: raw/context-v2.md §9.13.

## Principles {#principles}

| Principle | Description |
|---|---|
| Human-in-the-loop | AI proposes; the broker decides. Client-facing messages, offers, legally significant texts, and sensitive communications cannot leave the system without broker confirmation. |
| Broker-first | AI helps the broker sell — not create extra admin work. |
| Explainable recommendations | Every ranking / suggestion explains *why*. |
| Trusted data only | AI only uses verified data: CRM + Listing Module + approved market sources + internal documents. |
| No hallucinated property facts | AI never invents property attributes, prices, legal statuses, views, distances, infrastructure, yields. |
| Privacy by design | VIP / private clients, sensitive notes, NDA-locked properties, off-market opportunities — processed strictly under access rights and privacy rules. |
| Luxury tone of voice | Premium, calm, precise, no aggressive sales pressure. |
| Compliance-aware | Personal-data restrictions, advertising claims, fair-housing / anti-discrimination, AI transparency, local requirements. |
| Action-oriented | Help the broker do the next thing: prepare the call, send the shortlist, schedule the showing, create the follow-up. |

Source: raw/context-v2.md §9.13.1.

## AI Daily Priorities (FR-AI-DSA) {#daily-priorities}

Helps the broker start the day with the right priorities.

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-DSA-01 | Form an AI-powered daily agenda at `(Contacts × SavedSearch)` level + linked `TransactionManagement` rows: which funnels need attention today (per [wiki/overview.md#pipeline](overview.md#pipeline)), which `Activity` follow-ups are overdue, which `ContactListings.ListingSentTimestamp` got no reaction | High |
| FR-AI-DSA-02 | Rank funnels by urgency, forecast-commission potential, stage (Contracting / Payment > Matching), `ContactListings` engagement signals, and Stale-Funnel risk | High |
| FR-AI-DSA-03 | Explain the ranking with a canonical-resource link (new Lead, ContactListings opened, no-response offer, Stale Funnel, `Property.StandardStatus` transition) | High |
| FR-AI-DSA-04 | Suggest a next best action per funnel: create `Activity`, update `Prospecting`, escalate to `ShowingRequest`, create `TransactionManagement` | High |
| FR-AI-DSA-05 | Broker may accept, edit, or reject any AI recommendation | High |
| FR-AI-DSA-06 | Learn from outcomes: did the contact reply, was a showing booked, was a TM created, did the funnel advance | Medium/High |

Source: raw/context-v2.md §9.13.2.

## AI Contact & Funnel Briefing (FR-AI-BRF) {#briefing}

Two-level briefing before a call / meeting / showing / negotiation: **Contact-level** (personal preferences from `Contacts`, lifestyle, family, overall relationship history) + **Funnel-level** (commercial parameters from a specific `SavedSearch` + related `Prospecting` / `ContactListings` / `ShowingAppointment` / `TransactionManagement`).

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-BRF-01 | Generate a Contact briefing from `Contacts`: personal data, lifestyle, family, privacy, `PreferredCommunicationMethod`, decision-maker role, related `Contacts ↔ Contacts`, full relationship history, list of all SavedSearches | High |
| FR-AI-BRF-02 | Generate a Funnel briefing for a specific `SavedSearch`: purpose, budget, locations, type, timeline, decision criteria, stage + sub-status, properties in play (`ContactListings`), last communications, open questions, next step | High |
| FR-AI-BRF-03 | If the contact has multiple active SavedSearches, the briefing MUST explicitly mark which funnel `(Contacts, SavedSearch)` the call/meeting is about | High |
| FR-AI-BRF-04 | Funnel briefing includes: current stage + sub-status, risks, closing probability, pending `Activity`, open `TransactionManagement`, legal/financial blocker signals (`Property.StandardStatus`, webhook signals) | High |
| FR-AI-BRF-05 | Highlight missing information separately for `Contacts` (personal) and `SavedSearch.SearchQuery` (commercial) | High |
| FR-AI-BRF-06 | Suggest discovery questions based on `Contacts.ContactType` + `SavedSearchType` (relocation, family office, corporate buyer, investor, …) | Medium/High |
| FR-AI-BRF-07 | One-click meeting preparation note | Medium/High |

Source: raw/context-v2.md §9.13.3.

## AI Contact Funnel Qualification & Routing (FR-AI-LQ) {#lead-qualification}

Quickly qualify new inbound inquiries (Lead-state `Contacts`) and split the extracted data between `Contacts` (personal) and `SavedSearch.SearchQuery` (commercial).

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-LQ-01 | Analyze the inbound inquiry (which creates `Contacts` with `ContactType = Lead`) and extract: for `Contacts` — `PreferredCommunicationMethod`, language, lifestyle hints, family signals; for the future `SavedSearch.SearchQuery` — budget, target location, property type, timeline, purpose | High |
| FR-AI-LQ-02 | Assign an AI Lead Score to the Lead-state contact based on extracted budget, urgency, data completeness, `Contacts.LeadSource`, ICP fit, and predicted conversion-to-active-`SavedSearch+Prospecting` probability | Medium/High |
| FR-AI-LQ-03 | Suggest broker routing (set `Contacts.OwnerMemberKey`) based on language, specialization, location, load, similar-client history — applied after broker / sales-manager confirmation | Medium/High |
| FR-AI-LQ-04 | Surface VIP / high-potential Lead-state contacts for accelerated reaction (VIP/private flag, family-office signals on `Contacts`) | High |
| FR-AI-LQ-05 | Draft a first message to the client; never send under broker identity without broker confirmation | High |
| FR-AI-LQ-06 | Record AI confidence; route low-confidence Lead-state contacts to manual review | High |
| FR-AI-LQ-07 | On graduation (Lead → Prospect → Ready to Buy) propose creating `SavedSearch` + `Prospecting` with a pre-filled `SearchQuery`; broker confirms. On dedupe, propose re-using existing `Contacts`. | High |

Source: raw/context-v2.md §9.13.4.

**MSA precursor (deterministic, advisory).** Before the AI Lead Score lands in
matrix-pipeline, MSA ships a rule-based triage score on the unclaimed Leads
inbox (status `new` only): propensity weights calibrated on 643 closings
(2026-09-08), urgency multiplier, value tilt, hover breakdown, and a Triage
mode that ranks the live pool client-side. It never writes to the CRM, is not
labelled MQL/SQL, and does not replace qualification. Model card:
`matrix-sales-automation` → `docs/qobrix/lead-triage-scoring.md`. When FR-AI-LQ-02
ships, beat this baseline on the same calibration set.

## AI Property Matching Assistant (FR-AI-PM) {#property-matching}

Matching always runs in the context of a specific `SavedSearch` and combines `SearchQuery` parameters with personal `Contacts` preferences.

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-PM-01 | Recommend properties from Listing Module based on `SavedSearch.SearchQuery` parameters + personal preferences (lifestyle, family, privacy) from the related `Contacts`. Always in the context of a specific `SavedSearch`. | High |
| FR-AI-PM-02 | Natural-language search → valid RESO OData filter on `SavedSearch.SearchQuery` ("quiet villa near the sea with privacy, 4+ bedrooms, near good school" → correct filter) | Medium/High |
| FR-AI-PM-03 | Explain why a specific property fits, in the context of `SavedSearch` + `Contacts` lifestyle/family | High |
| FR-AI-PM-04 | Show trade-offs, not just matches: price above budget, farther from school, smaller plot but better view or privacy | High |
| FR-AI-PM-05 | Propose alternatives if the chosen property's `Property.StandardStatus` becomes Active Under Contract / Pending / Closed / Withdrawn | High |
| FR-AI-PM-06 | Honor negative preferences via `ContactListings.ContactListingPreference = Discard` + related `ContactListingNotes` reasons | High |
| FR-AI-PM-07 | Compare properties on the criteria that matter for the specific `SavedSearch` | Medium/High |
| FR-AI-PM-08 | Never recommend private / off-market properties without checking access rights, NDA, privacy level | High |
| FR-AI-PM-09 | If a `Contacts` has multiple active SavedSearches, never mix criteria across funnels | High |

Source: raw/context-v2.md §9.13.5.

## AI Proposal & Presentation Assistant (FR-AI-PROP) {#proposal}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-PROP-01 | Help create a personalized shortlist for a specific `SavedSearch` based on chosen listings + `SearchQuery` + personal preferences from related `Contacts`; persisted as `ContactListings` rows with `ListingSentTimestamp` | High |
| FR-AI-PROP-02 | Generate a personal intro in luxury tone-of-voice for embedding into `Prospecting.Greeting` / `Body` | Medium/High |
| FR-AI-PROP-03 | Per-property explain its relevance for this specific funnel (`SavedSearch`) | High |
| FR-AI-PROP-04 | Support different versions for decision-making-unit participants (client / spouse / family-office rep / lawyer / investment advisor) via `Contacts ↔ Contacts` | Medium |
| FR-AI-PROP-05 | Help adapt shortlist by channel: email, WhatsApp, PDF, client portal | Medium/High |
| FR-AI-PROP-06 | Ensure AI-generated text contains no unverified property facts | High |
| FR-AI-PROP-07 | Persist the sent shortlist version via `Prospecting` history + `ContactListings.ListingSentTimestamp` + `HistoryTransactional` rows | High |

Source: raw/context-v2.md §9.13.6.

## AI Communication & Follow-up Assistant (FR-AI-COM) {#communication-drafting}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-COM-01 | Draft messages for email / WhatsApp / call scripts in the context of `Contacts` + a specific funnel (`SavedSearch` + linked `ContactListings` / `TransactionManagement`) | High |
| FR-AI-COM-02 | Prepare follow-ups after call / meeting / showing / shortlist send / negotiation | High |
| FR-AI-COM-03 | Offer tone variants: formal / warm / concise / luxury / investor-focused / relocation-focused | Medium |
| FR-AI-COM-04 | Auto-summarize a communication and propose a next step | High |
| FR-AI-COM-05 | Help re-engage cold / warm clients with personal-reason hooks | Medium/High |
| FR-AI-COM-06 | Remind broker if the client didn't reply by deadline; propose a correct follow-up | High |
| FR-AI-COM-07 | Multilingual drafts respecting client language | Medium/High |
| FR-AI-COM-08 | Broker can edit AI-generated text before sending | High |
| FR-AI-COM-09 | Forbid auto-sending sensitive communications without broker confirmation | High |

Source: raw/context-v2.md §9.13.7.

## AI Viewing Assistant (FR-AI-VIEW) {#viewing-assistant}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-VIEW-01 | Pre-`ShowingAppointment` preparation note: `Contacts` profile, active `SavedSearch` parameters, target `Property`, selling points, possible objections, questions for the client | High |
| FR-AI-VIEW-02 | Suggest which property features to emphasize given `SavedSearch.SearchQuery` motives + `Contacts` lifestyle | High |
| FR-AI-VIEW-03 | After a `Showing` row, help record client feedback in `ContactListingNotes` in a structured form | High |
| FR-AI-VIEW-04 | Extract from broker notes: interest, objections, blockers, next step | Medium/High |
| FR-AI-VIEW-05 | Suggest a follow-up `Activity` and alternative properties within the current `SavedSearch` if rejected | High |
| FR-AI-VIEW-06 | Update `ContactListings.ContactListingPreference` (Favorite / Possibility / Discard) post-showing, after broker confirm | High |

Source: raw/context-v2.md §9.13.8.

## AI Negotiation & Offer Support (FR-AI-NEG) {#negotiation-support}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-NEG-01 | Prepare negotiation brief: buyer interests, seller position, offer history (`TransactionManagement` + `HistoryTransactional`), risks, possible concessions | Medium/High |
| FR-AI-NEG-02 | Suggest negotiation arguments grounded in `SavedSearch.SearchQuery`, `Property`, `Contacts` | Medium/High |
| FR-AI-NEG-03 | Draft offer letter or counter-offer message for a specific `TransactionManagement` row | Medium/High |
| FR-AI-NEG-04 | Surface commercial / legal questions that need Manager / Legal / Compliance review | High |
| FR-AI-NEG-05 | NEVER autonomously decide price / discount / commission / terms | High |
| FR-AI-NEG-06 | Persist AI-generated negotiation materials via `Document` references on `TransactionManagement` + `HistoryTransactional` recording the approver | Medium |

Source: raw/context-v2.md §9.13.9.

## AI Deal Margin Coach (FR-AI-MAR) {#deal-margin-coach}

Helps the sales broker understand the economics of a specific deal and decide "pursue / drop / escalate", working on top of the Commission Engine ([wiki/commission-engine.md](commission-engine.md)).

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-MAR-01 | Help the broker **understand deal P&L and commission structure**: summarize forecast GCI, attributed costs, net margin, forecast broker compensation for a specific `TransactionManagement`; explain in natural language which rule was applied and how the broker payout breaks down | Medium/High |
| FR-AI-MAR-02 | **Surface anomalies**: cost overrun vs forecast GCI, forecast-margin deviation from broker/office median, post-close variance forecast vs actual GCI from external Finance ERP reconciliation ([wiki/integration.md#finance-erp-commission](integration.md#finance-erp-commission)) — propose "pursue / drop / escalate / root cause analysis" | Medium |
| FR-AI-MAR-03 | **Never** autonomously change commission rules or cost rates (`CommissionRule`, `CostRateCard`, or their implementation equivalents); all rule changes only through admin UI with `managing_partner` / `compliance` / `finance_admin` rights | High |

Source: raw/context-v2.md §9.13.9a.

## AI Relationship Intelligence (FR-AI-RI) {#relationship-intelligence}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-RI-01 | Build a relationship map per `Contacts`: decision maker, spouse, assistant, lawyer, family office, investment advisor, influencer — via canonical `Contacts ↔ Contacts`. Reused across all SavedSearches of this Contact. | Medium/High |
| FR-AI-RI-02 | From communications, infer DMU roles (broker confirms); per-transaction roles stored on related `Contacts` rows of `TransactionManagement` (FR-FNL-09) | Medium |
| FR-AI-RI-03 | Suggest personal-contact occasions: closed-deal anniversary, relevant new property for one of the active SavedSearches, market changes, lifestyle events, referral opportunities | Medium/High |
| FR-AI-RI-04 | Long-term nurturing for `Contacts` without active `Prospecting+SavedSearch` and for funnels in Nurturing | Medium/High |
| FR-AI-RI-05 | Respect `Contacts` privacy preferences; don't use sensitive personal details unnecessarily | High |

Source: raw/context-v2.md §9.13.10.

## AI Market & Investment Intelligence (FR-AI-MKT) {#market-intelligence}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-MKT-01 | Help brokers prepare short market notes by location / segment / property type | Medium |
| FR-AI-MKT-02 | Compare properties on investment criteria (yield, appreciation, liquidity, exit horizon, rental demand) | Medium |
| FR-AI-MKT-03 | Cite sources for market insights when used | High |
| FR-AI-MKT-04 | Mark estimates / forecasts explicitly as estimates, not guaranteed results | High |
| FR-AI-MKT-05 | NEVER generate financial promises, yield guarantees, or legal statements without an approved source | High |

Source: raw/context-v2.md §9.13.11.

## AI Knowledge Assistant (FR-AI-KB) {#knowledge-assistant}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-KB-01 | Answer broker questions on internal rules, sales playbooks, processes, templates, properties, FAQs | Medium/High |
| FR-AI-KB-02 | Answers built only on approved internal sources / documents | High |
| FR-AI-KB-03 | Show the source / document the answer was built from | High |
| FR-AI-KB-04 | Distinguish approved knowledge vs AI-generated suggestions | High |
| FR-AI-KB-05 | Broker can submit feedback on answer quality | Medium |

Source: raw/context-v2.md §9.13.12.

## AI Data Capture & CRM Hygiene (FR-AI-DATA) {#data-capture}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-DATA-01 | Extract structured data from notes / emails / messages and **split** across canonical resources: `Contacts` → `PreferredCommunicationMethod`, lifestyle, family signals; `SavedSearch.SearchQuery` → budget, timeline, locations, purpose, decision criteria, objections; `TransactionManagement` → DMU members per transaction | High |
| FR-AI-DATA-02 | Propose updates to `Contacts` (personal) and `SavedSearch.SearchQuery` (commercial) — one-click broker confirmation before apply | High |
| FR-AI-DATA-03 | Auto-suggest next action `Activity` + follow-up date at funnel level | High |
| FR-AI-DATA-04 | Detect `Contacts` duplicates and propose merge with carry-over of all related `SavedSearch`, `ContactListings`, `ShowingAppointment`, `TransactionManagement` | Medium/High |
| FR-AI-DATA-05 | Highlight incomplete `Contacts` and `SavedSearch` cards separately | Medium/High |
| FR-AI-DATA-06 | Audit trail of AI-suggested / human-approved changes via `HistoryTransactional` rows, with the canonical resource clearly identified | High |

Source: raw/context-v2.md §9.13.13.

## AI Client Concierge / Website Assistant (FR-AI-CONC) {#client-concierge}

A premium client-facing concierge — not a mass chatbot.

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-CONC-01 | Answer basic client questions on properties, neighborhoods, the buying process, services — from approved data | Medium/High |
| FR-AI-CONC-02 | Qualify the client and capture future `Contacts` (personal: language, `PreferredCommunicationMethod`) + future `SavedSearch.SearchQuery` (commercial: budget, location, type, timeline, purpose) | Medium/High |
| FR-AI-CONC-03 | Surface relevant Listing-Module properties with access-rights + `Property.StandardStatus` filtering | Medium |
| FR-AI-CONC-04 | Hand off the qualified Lead-state contact to a broker with a short dialog summary + pre-filled `Contacts` + `SavedSearch` structure | High |
| FR-AI-CONC-05 | Disclose to the client they are talking to an AI Assistant when not obvious | High |
| FR-AI-CONC-06 | Never expose private / off-market properties, sensitive client data, internal notes | High |
| FR-AI-CONC-07 | Hand off to a human on complex questions, high budget, conflict, legal topics, low confidence | High |

Source: raw/context-v2.md §9.13.14.

## AI Governance, Risk & Compliance (FR-AI-GOV) {#governance}

| ID | Requirement | Priority |
|---|---|---|
| FR-AI-GOV-01 | Audit log of AI suggestions, user approvals, edits, final actions | High |
| FR-AI-GOV-02 | Role-based access to AI features | High |
| FR-AI-GOV-03 | Forbid using data the user has no access to, even if AI could technically find it | High |
| FR-AI-GOV-04 | Visually mark AI-generated content inside the system | High |
| FR-AI-GOV-05 | Human approval for client messages, offers, commercial terms, legal/financial statements | High |
| FR-AI-GOV-06 | Confidence score or warning on low-confidence answers | Medium/High |
| FR-AI-GOV-07 | Prevent generating unverified facts about properties, markets, yields, taxes, visas, legal terms, document statuses | High |
| FR-AI-GOV-08 | AI prompt library + approved templates for key scenarios | Medium/High |
| FR-AI-GOV-09 | Broker feedback loop on AI quality | Medium |
| FR-AI-GOV-10 | Data-retention settings for AI logs and generated content | Medium/High |
| FR-AI-GOV-11 | AI-generated / AI-altered images of properties must be clearly marked and must not distort the actual state | High |
| FR-AI-GOV-12 | Local-compliance rules including GDPR, AI transparency obligations, local advertising rules | High |

Source: raw/context-v2.md §9.13.15.

## Forbidden / restricted AI scenarios {#forbidden-scenarios}

| Scenario | Rule |
|---|---|
| Auto-send to VIP / private clients | Only after broker confirmation |
| Auto-decide commercial terms (price, discount, commission, conditions) | Forbidden — human required |
| Generating legal advice | Only as preparation of questions for legal/compliance, never as legal advice |
| Yield / appreciation guarantees | Forbidden without an approved source + disclaimers |
| Disclosing off-market / private properties | Only with access rights, NDA, and business approval |
| AI-generated / altered property images | Must be marked, must not distort actual state |
| Using sensitive personal data for personalization | Only when allowed, necessary, and matching privacy preferences |
| Fully autonomous AI broker | Out of MVP; only as a constrained concierge with human escalation |

Source: raw/context-v2.md §9.13.16.

## Recommended AI MVP {#mvp-recommended}

Six fast-value, low-compliance-risk features:

| MVP feature | Value |
|---|---|
| AI Contact & Funnel Briefing | Fast broker prep for calls / meetings / showings at `(Contacts × SavedSearch)` granularity |
| AI Follow-up Drafts | Save time + raise follow-up quality |
| AI Property Matching Explanation | Help the broker present better, in context of `SavedSearch.SearchQuery` + `Contacts` lifestyle |
| AI Data Capture from Notes | Less manual entry + better CRM quality; routing into `Contacts` / `SavedSearch.SearchQuery` / `ContactListings` |
| AI Daily Priorities | Focus broker on `(Contacts × SavedSearch)` pairs that need action |
| AI Knowledge Assistant | Fast access to internal standards / processes / playbooks |

Source: raw/context-v2.md §9.13.17.

## AI Roadmap {#roadmap}

| Phase | Features |
|---|---|
| Phase 1 | Contact + Funnel briefing, follow-up drafts, data extraction (split into `Contacts` / `SavedSearch.SearchQuery` / `ContactListings`), daily priorities (ranking pairs `(Contacts × SavedSearch)`), property-match explanations |
| Phase 2 | Contact funnel scoring (Lead-state ranking), routing to `Member`, advanced property matching via `SavedSearch.SearchQuery`, proposal builder via `Prospecting`, viewing assistant on the Showing chain, relationship intelligence via `Contacts ↔ Contacts` |
| Phase 3 | AI concierge on website / client portal, multilingual communication assistant, market intelligence, negotiation support via `TransactionManagement`, automated nurturing journeys via `Prospecting` |
| Phase 4 | Agentic workflows with approvals: schedule `ShowingAppointment`, prepare proposal via `Prospecting`, create follow-up sequences, update `Contacts` / `SavedSearch` / `ContactListings`, route approvals, log outcomes via `HistoryTransactional` |

Source: raw/context-v2.md §9.13.18.

## AI implementation plan {#implementation-plan}

### Product hypothesis

The AI Broker Co-Pilot must help the broker do six things faster and better:

1. Understand who to work with today.
2. Restore client / deal context quickly.
3. Find relevant properties and explain their value.
4. Prepare a strong personal message or follow-up.
5. Record the result of a communication without manual entry.
6. Never miss the next step.

The formula: **AI doesn't sell instead of the broker. AI helps the broker be more prepared, precise, fast, and personal.**

### MVP — mandatory composition

| Priority | Feature | What it does | Why in MVP |
|---|---|---|---|
| P0 | AI Contact Briefing | Summarize `Contacts` (personal preferences, lifestyle, `Contacts ↔ Contacts` links) before a call/meeting | Fast personal context |
| P0 | AI Funnel Briefing | Summarize a specific `(Contacts × SavedSearch)` pair (budget/purpose from `SearchQuery`, stage per [wiki/overview.md#pipeline](overview.md#pipeline), risks, next step) | Moves the funnel without extra reporting |
| P0 | AI Follow-up Draft | Draft a follow-up after call, `ShowingAppointment`, `Showing`, `ContactListings` send, or `TransactionManagement` transition | Save time + follow-up discipline |
| P0 | AI Data Capture from Notes | Extract: `Contacts` — `PreferredCommunicationMethod` / lifestyle; `SavedSearch.SearchQuery` — budget, locations, timeline, objections; `ContactListings` — preference and feedback; next step as `Activity` | Less manual entry |
| P0 | AI Daily Priorities | Show which `(Contacts × SavedSearch)` pairs and `TransactionManagement` rows need action today and why | Daily working tool |
| P1 | AI Property Match Explanation | Explain why a property fits a specific `SavedSearch` (+ `Contacts` lifestyle) | Better property presentation |
| P1 | AI Discovery Questions | Qualification questions by `Contacts.ContactType` + `SavedSearchType` | Better discovery quality |
| P1 | AI Knowledge Assistant | Internal playbooks / processes / templates / FAQ | Faster ramp + standardization |
| P2 | AI Proposal Builder | Personalized property shortlist under `SavedSearch`, emits `ContactListings` rows + `Prospecting` send | Needs mature Listing-Module integration |
| P2 | AI Contact Funnel Scoring & Routing | Score Lead-state contacts and route to `Member`; propose `Contacts` + `SavedSearch` structure for qualification | Needs historical data + routing rules |
| P3 | AI Concierge | Client-facing AI on website / portal; prepares future `Contacts` + `SavedSearch` | Needs strong governance, escalation, quality control |

### Architecture — recommended logic

| Component | Purpose |
|---|---|
| CRM Data Layer | Contacts, deals, activities, showings, offers, history |
| Listing Data Layer | Properties, statuses, prices, privacy level, public + internal links |
| Knowledge Base | Playbooks, templates, processes, FAQ, approved market notes |
| AI Orchestration Layer | Manages prompt templates, retrieval, access rights, logging, business rules |
| Retrieval Layer | Finds relevant data for a given AI query |
| AI Output Layer | Generates briefing, draft, summary, recommendation, structured update |
| Human Approval Layer | Lets the broker confirm, edit, or reject an AI proposal |
| Audit & Governance Layer | Logs AI output, edits, approvals, errors, confidence, sources |

**Architectural rule**: AI MUST NEVER directly modify client / deal / property master data. AI **proposes** changes; the broker (or a user with the right role) applies them.

### Human Approval Matrix

| AI output | Broker approval | Approver |
|---|---|---|
| Contact briefing | No, internal use | Broker |
| Funnel briefing | No, internal use | Broker |
| Suggested next action | Yes, before creating a task or sending a message | Broker |
| Follow-up draft | Yes, always before sending to client | Broker |
| WhatsApp draft | Yes, always | Broker |
| Property recommendation | Yes, before sending | Broker |
| CRM field update | Yes, before applying | Broker / Manager |
| Contact funnel score (Lead-state) | No for the score, Yes for routing rules | Broker Manager / Sales Manager |
| Offer letter / negotiation message (`TransactionManagement`) | Yes | Broker + Manager/Legal if needed |
| Market note | Yes if going to client | Broker / Marketing / Legal |
| Legal / tax / visa text | Yes, mandatory Legal/Compliance | Legal / Compliance |
| AI Concierge response | Human escalation for high-value, legal, conflict, low-confidence | Broker / Concierge / Manager |

### AI MVP governance checklist

Before MVP launch:

- AI use-case register (list, owners, risks).
- Data-access rules (AI uses only data the current user can see).
- Prompt library with versions + owners.
- Human approval flow for client messages and CRM updates.
- Audit log of AI suggestions / edits / approvals / final actions.
- Source grounding for knowledge answers + market notes.
- AI disclosure to clients where appropriate.
- Data-retention policy for AI logs and generated content.
- Sensitive-data handling (VIP / private / NDA) under access rights.
- Hallucination prevention on property / market / yield / tax / legal facts.
- Escalation rules for human takeover.
- Quality feedback from brokers.

### Success metrics

- Time to first response on new Lead-state contacts.
- Follow-up completion rate.
- CRM data completeness (per `Contacts` / `SavedSearch` / `ContactListings`).
- Time spent on admin (manual entry reduction).
- Briefing-before-meeting usage rate.
- Property-shortlist acceptance rate.
- Viewing-to-offer conversion.
- Deal-stage progression speed.
- Broker adoption rate.
- AI suggestion acceptance rate.
- AI edit rate (how much brokers rewrite).
- Client response rate.
- Compliance incidents (privacy violations, factual errors).

### Phase plan

| Phase | Goal | Scope |
|---|---|---|
| Phase 0 | Foundation — data, security, prompt library, approval matrix, audit log, AI disclosure rules | (prep) |
| Phase 1 | Broker Productivity MVP | Daily Priorities, Contact Briefing, Funnel Briefing, Follow-up Drafts, Data Capture, next-action suggestion, basic feedback loop |
| Phase 2 | Property & Proposal Intelligence | Match Explanation, NL property search, comparison, personalized proposal intro, AI-assisted shortlist, Viewing Assistant |
| Phase 3 | Sales Intelligence & Relationship Intelligence | Lead scoring, contact routing, relationship map, nurturing suggestions, objection handling, negotiation brief for `TransactionManagement`, full Knowledge Assistant |
| Phase 4 | Client-facing Concierge | AI Concierge on website / portal, lead qualification through AI Assistant, summary handoff to broker, escalation, response-quality monitoring, client transparency |

### What NOT to build in v1

- Fully autonomous AI broker.
- Auto-send messages to VIP clients without confirmation.
- Auto-change price / commission / commercial terms.
- AI valuation as official valuation.
- Investment promises / yield guarantees.
- Legal, tax, visa advice on behalf of the agency.
- AI-generated property images without labeling and factual control.
- Recommending private / off-market properties without access + NDA checks.
- Complex AI Concierge before internal broker tools are reliable.
- Agentic workflows without audit log, approval, rollback.

Source: raw/context-v2.md §9.14.
