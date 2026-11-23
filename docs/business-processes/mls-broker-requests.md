# Atlas MLS: how a broker asks for a new record

This is the process Sharp SIR uses today, moved from email into Atlas MLS. It is Sharp SIR's own flow, not a RESO state machine.

A broker does not create a developer or a project. The broker sends what they know. The MLS Coordinator enters it.

## What a broker can request

- **New developer.** Whatever the broker knows about the company.
- **New developer contact.** For a developer that exists, or one already requested.
- **New developer project, with an ownership claim.** The broker asks for the project and claims it. The claim is saved on the request. Setting the broker as `developments.x_owner_sso_user_id`, copying that owner onto the units, and routing the project's leads are not done yet.
- **Any other MLS object** (a unit, a listing, and so on). The broker sends the details they have.

In every case the coordinator types the record. The broker's submission is the input.

## Two pages

A page does not change what it shows based on who opened it.

- **Requests** is in the Broker View. On Add, Project, Developer and Developer contact stay visible. Without permission to create them, Send request stores what the broker has (files, notes, a developer name, and for a project the ownership claim) in `listing_requests`. It does not create the record. The page lists the broker's own requests and their status, and also takes a request for any other MLS object.
- **Request queue** is in the MLS Coordinator View, next to Project setup. The coordinator starts a request, creates the record with the existing developer, contact and project tools, marks it done, or declines it with a reason.

The queue's database rule is the caller's scope, not the page key. This database cannot read SSO page keys. A self-scope broker sees only their own rows. Any wider scope can read every request in the tenant through the API. The sidebar still shows the queue only to the coordinator.

## Who owns a project

The claim is stored on the request and shown to the coordinator as the owner to set. Approving a request does not yet write `developments.x_owner_sso_user_id`, and it does not route leads. That write, and the two triggers that today clear an owner when the project name has no broker in it, stay for a later change.

Two older fields still set an owner, and they stay so that records already in the system keep theirs. Nothing new is built on them.

- **Key holder** (`key_holder_details`) is a Qobrix workaround. A listing that carries one still belongs to the broker that name matches.
- **A broker's name inside the project name** is the same kind of workaround. It is still read. Nothing new writes it.

The proposed order (to confirm) is: the legacy key holder, then the claimed project owner, then the name inside the project name.
