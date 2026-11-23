# Chapter 4: Business Processes — Index

> Canonical, RESO-aligned business process state machines. Vendor-neutral.
>
> Project-flavour CRM behaviour (Sharp-SIR luxury sales playbook, BRD-derived) lives in
> [`../product-specs/matrix-pipeline/`](../product-specs/matrix-pipeline/INDEX.md), not here.
> The CRM is the only application that materialises these processes as broker UI today.

## Documents

| Document | What It Contains |
|----------|-----------------|
| [mls-broker-requests.md](mls-broker-requests.md) | Sharp SIR operational flow: a broker requests a developer, contact, project (and claims to own it) or another object, and the MLS Coordinator enters it. Not a RESO state machine. |
| [canonical-processes/USAGE.md](canonical-processes/USAGE.md) | **Start here for canonical state-machine semantics.** Task-oriented entry points: state lookup, step implementation, cross-resource impact analysis. |
| [canonical-processes/README.md](canonical-processes/README.md) | Methodology, 2-script phase-gated pipeline (Author → Validate → Emit), boundaries with `reso-dd-kb/` and product-specs. |
| [canonical-processes/AGENTS.md](canonical-processes/AGENTS.md) | Local rules: phase boundaries, citation contract, mermaid contract, 5 hard-fail gates. |
| [canonical-processes/wiki/agent-docs/_index.md](canonical-processes/wiki/agent-docs/_index.md) | Generated catalogue: 10 processes, per-resource and per-lookup coverage matrices, roll-up totals (709 RESO citations). |
| [canonical-processes/wiki/agent-docs/state_machines.md](canonical-processes/wiki/agent-docs/state_machines.md) | Generated consolidated mermaid index: every `stateDiagram-v2` block from the 10 process docs in one page. |
| [canonical-processes/processes/](canonical-processes/processes/) | The 10 hand-written process docs: Listing, Showing, OpenHouse, Lead-Contact, Transaction, Member/Office/Team onboarding, Caravan, Media. |

## Boundary with `product-specs/matrix-pipeline/`

This chapter is **vendor-neutral and platform-agnostic** — every state and transition is anchored in RESO DD 2.0 with machine-validated citations. It describes WHAT can happen.

`product-specs/matrix-pipeline/` is the **Sharp-SIR luxury CRM product spec** — it picks which states the CRM materialises, which transitions get a UI affordance, and how state changes emit `HistoryTransactional` events. It describes HOW the CRM uses these processes.

When the CRM needs a stage that cannot be expressed in canonical RESO terms (e.g. the `Referral` entity, the internal Commission Engine), that escape hatch is documented in `matrix-pipeline/wiki/architecture.md#escape-hatch` and never as a fork of the canonical process here.

When the CRM needs a Sharp-SIR-specific field name, that field lives in [`source-mappings/`](../data-models/source-mappings/USAGE.md) as an `x_*` extension, not as a fork of the canonical resource.
