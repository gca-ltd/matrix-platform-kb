# Atlas MLS: how a broker asks for a new record

This is the process Sharp SIR uses today, moved from email into Atlas MLS. It is Sharp SIR's own flow, not a RESO state machine.

A broker does not create a developer or a project. The broker sends what they know. The MLS Coordinator enters it.

## What a broker can request

- **New developer.** Whatever the broker knows about the company.
- **New developer contact.** For a developer that exists, or one already requested.
- **New developer project, with an ownership claim.** The broker asks for the project and claims it. When the coordinator approves, the broker becomes the project owner (`developments.x_owner_sso_user_id`). That owner is copied onto the project's units, and it is what routes the project's leads to that broker.
- **Any other MLS object** (a unit, a listing, and so on). The broker sends the details they have.

In every case the coordinator types the record. The broker's submission is the input.

## Two pages

A page does not change what it shows based on who opened it.

- **Requests** is in the Broker View. The broker submits a request and follows their own.
- **Request queue** is in the MLS Coordinator View, next to Project setup. The coordinator sees every request and processes it.

Until those pages are built, both say what is coming, and the broker sends the request to the MLS Coordinator the way they do today.

## Who owns a project

The claim, once approved, is the way a broker becomes a project's owner.

Two older fields still set an owner, and they stay so that records already in the system keep theirs. Nothing new is built on them.

- **Key holder** (`key_holder_details`) is a Qobrix workaround. A listing that carries one still belongs to the broker that name matches.
- **A broker's name inside the project name** is the same kind of workaround. It is still read. Nothing new writes it.

When a listing has more than one of these, the proposed order (to confirm) is: the legacy key holder, then the claimed project owner, then the name inside the project name.

Approving a claim has to set the owner even when the project name has no broker in it. The two triggers that copy an owner down today only do so when that name is present, so they clear a claimed owner. That change is part of building the queue, not part of the sidebar.
