# Sharp Matrix ITSM — 1st Line Support Knowledge Base

> **App name:** ITSM (IT Service & Asset Management)
> **URL:** [https://intranet.sharpsir.group/itsm/](https://intranet.sharpsir.group/itsm/)
> **Service levels (15 October 2026):** [Уровни обслуживания](https://iris.sharpsir.group/doc/urovni-obsluzhivaniya-h4SRzyzRl2) for everyone, and [Регламент работы поддержки](https://iris.sharpsir.group/doc/reglament-raboty-podderzhki-lUvvLbow5Y) for L1, L2 and L3, both under [Поддержка Sharp Matrix](https://iris.sharpsir.group/doc/podderzhka-sharp-matrix-Nsx2hoeyg6) in the CDTO Office collection. Quote these pages for response and resolution times. A Teams message or a phone call is not a ticket.
> **Purpose:** Submit and track IT service requests, manage IT assets, software licenses, vendors, projects, and budgets.
> **Users:** All internal users (ticket submitters), IT Staff, IT Admins

---

## What Is ITSM?

ITSM is the IT service and asset management app for Sharp Sotheby's International Realty. It provides a service desk where you can submit and track IT requests (like "my laptop is broken" or "I need new software"). It also includes a list of all company IT equipment (called CMDB), and tools for managing vendors, projects, budgets, and IT documentation. All employees can submit requests; IT staff handle everything else.

---

## How to Access ITSM

1. Open your browser and go to [https://intranet.sharpsir.group/itsm/](https://intranet.sharpsir.group/itsm/).
2. You will be redirected to the Sharp Matrix SSO login page.
3. Sign in with your company email and password, or use "Sign in with Microsoft".
4. After login you land on the **Home Dashboard**.

If you cannot log in, your account may not have access to ITSM. Contact your Admin or IT department.

---

## User Roles and What They Can Do

| Role | Home Page | What They Can Do |
|------|-----------|-----------------|
| **Employee (any role)** | Home Dashboard | Submit IT service requests, view own request status, receive notifications |
| **IT Staff** | Home Dashboard | All employee capabilities plus: manage service desk queue, assign tickets, manage assets, vendors, projects, software assets, budgets |
| **IT Admin** | Home Dashboard | Full access: all IT staff capabilities plus settings, permissions, equipment list configuration, employee directory sync, integrations |

---

## Main Features

### Home Dashboard

The home page shows:
- **Service desk statistics** — open tickets, response time targets, recent activity
- **Quick actions** — create a new ticket, view your requests
- **KPI widgets** — asset counts, project status, budget summaries

### My Requests (For All Users)

This is where you submit and track your own IT requests.

1. Click **Service Catalog** in the sidebar and pick the matching item. If none matches, choose **Free-form request** (`/itsm/servicedesk/new`).
2. Fill in the form:
   - **Title** (minimum 5 characters) — describe the issue briefly
   - **Description** (minimum 10 characters) — explain the problem or request in detail
   - **Priority** — Low, Medium, High, or Urgent
   - **Service Type** — Service Request or Change Request (the only two types)
   - **Related Asset** — you must select at least one IT asset related to the request
3. Click **Submit Ticket**.
4. Your request appears in **My Requests** with its current status.

### Service Desk Queue (IT Staff)

The service desk queue shows all submitted tickets.

1. Click **SD Queue** in the sidebar.
2. Browse or filter tickets by priority, status, service type, or assignee.
3. Click a ticket to view details, add comments, change status, or reassign.
4. **Assign** a ticket to an IT staff member (L1, L2, or L3 support level).
5. **Escalate** a ticket to a higher support level if needed.
6. **Resolve** a ticket when the issue is fixed.

### Service Desk Analytics (IT Staff)

1. Click **SD Analytics** in the sidebar.
2. View charts and metrics: ticket volumes, resolution times, whether response targets are being met, breakdown by type and priority.

### IT Assets (CMDB — the list of all company IT equipment and software)

Manage all IT hardware and infrastructure.

1. Click **Assets** in the sidebar.
2. Browse, search, or filter the asset list by domain, status, or classification.
3. Click **New Asset** to register a new item (computer, server, network device, etc.).
4. Click any asset to view details including:
   - **Bill of Materials** — components and parts
   - **Linked vendors** — suppliers and service providers
   - **Related tickets** — service desk tickets for this asset
5. Export the asset list for reporting.

### Software Assets & Licenses

Track software purchases, license seats, and allocations.

1. Click **Software Assets** in the sidebar.
2. View all software licenses with seat counts (purchased vs. allocated).
3. Click **New Software Asset** to register a new license.
4. **Allocate** seats to users, devices, or offices.
5. Monitor expiring licenses via sidebar badge notifications.

### Vendors

Manage IT vendors and service providers.

1. Click **Vendors** in the sidebar.
2. Add, edit, or view vendor details including contact information and risk rating.
3. Link vendors to assets and projects.

### Projects

Track IT projects and their resource allocations.

1. Click **Projects** in the sidebar.
2. Create and manage IT projects with timelines and budgets.
3. Link assets and vendors to projects.

### Budget

Manage IT department budgets.

1. Click **Budget** in the sidebar.
2. View budget categories and spending.
3. Add new budget categories and track expenditures.

### Analytics

View IT department analytics and reports.

1. Click **Analytics** in the sidebar.
2. Browse dashboards with KPIs across assets, tickets, projects, and budget.

### IT Architecture

View IT architecture documentation and diagrams.

1. Click **IT Architecture** in the sidebar.
2. Browse architecture documentation and visual diagrams.

### Documentation

Access IT documentation and reference materials.

1. Click **Documentation** in the sidebar.
2. Browse available documentation topics.

### Settings (IT Admin)

Admins can configure:

- **General** — app-wide settings (theme, language)
- **Permissions** — role-based page and action access for each user role
- **Data Model** — data model configuration
- **Data Layer** — data source configuration
- **MLS** — MLS integration settings
- **AI Providers** — AI and speech recognition settings (set up by Admin for AI-powered form filling)
- **Agency Hub URL** — return URL for the Back to Agency Hub link
- **Microsoft 365** — Microsoft 365 integration (connect/disconnect)
- **AD Sync** — sync employee information from the company Microsoft directory
- **CMDB** — equipment list: classification tree and categories
- **Classifications** — asset classification management
- **Webhooks** — set up automatic import of IT issues from external monitoring systems (Admin only)

---

## Zoe Can Help You Submit IT Requests

You don't need to figure out ITSM alone. Zoe (the AI assistant) can help you create a well-structured IT request:

### How It Works
1. **Tell Zoe your problem.** For example: "My laptop screen is flickering" or "I need access to Matrix FM."
2. **Zoe suggests the right request type:**
   - Something that used to work is broken? → **Service Request**
   - Access, a data fix, equipment, a license, or a how-to? → **Service Request**
   - New or different behaviour? → **Change Request**
   - Broken again? → a new **Service Request** that quotes the earlier ticket number
3. **Zoe suggests a priority:**
   - Total outage for many users → **Urgent**
   - Can't do your job, no workaround → **High**
   - Inconvenient but can work around it → **Medium**
   - Minor or cosmetic → **Low**
4. **Zoe reminds you what to include:** app name, error message, screenshot, and which asset is affected.
5. **Zoe directs you to ITSM:** Go to Service Catalog, pick the matching item or **Free-form request**, fill in the form, and submit.

### Common Requests Zoe Can Help You Draft

| Your situation | Service Type | Priority | Example title |
|---------------|-------------|----------|---------------|
| App shows blank page | Service Request | High | "Meeting Hub loads blank page after login" |
| Need a new laptop | Service Request | Medium | "Request new laptop for new hire Maria P." |
| Software license needed | Service Request | Medium | "Need Adobe Acrobat Pro license for contracts" |
| Email not working | Service Request | High | "Outlook emails not syncing in Matrix Pipeline" |
| Printer broken | Service Request | Medium | "Office printer on 3rd floor not printing" |
| Request VPN access | Service Request | Low | "VPN access for remote work" |
| Same app crash again | Service Request | Medium | "Client Connect crashes during bulk export again (see SR000xxx)" |
| New report column needed | Change Request | Low | "Add a 'Source' column to the leads export" |

---

## Use Cases: When Do I Use ITSM?

### For All Employees

**Use Case 1: "An app is not working"**
You open Meeting Hub and see a blank page or an error message.
1. Try refreshing the page. If that does not help, press Ctrl+Shift+Delete, select "Cached images and files", and click Clear.
2. If the problem persists, ask Zoe for help.
3. If Zoe can't fix it, go to ITSM → Service Catalog → Free-form request.
4. Title: "Meeting Hub shows blank page after login"
5. Description: Explain what you see, what browser you use, and attach a screenshot.
6. Service Type: Service Request. Priority: High (if you can't work).
7. Related Asset: Select your laptop or the relevant system.

**Use Case 2: "I need new equipment or software"**
You need a new monitor or a software license.
1. Go to ITSM → Service Catalog and pick the equipment or software item.
2. Title: "Request second monitor for desk 4B"
3. Service Type: Service Request. Priority: Low or Medium.
4. Description: Explain why you need it and any specifications.

**Use Case 3: "I can't access an app or page"**
You see "Access Denied" or "Page Not Available."
1. First, check with your Admin — it may be a permissions issue.
2. If it's a technical error (not permissions), submit an ITSM request.
3. Service Type: Service Request. Include the exact URL and error message.

### For IT Staff

**Use Case 4: "Managing the ticket queue"**
1. Start your day by opening SD Queue and sorting by priority (Urgent first).
2. Assign unassigned tickets to team members based on expertise.
3. Update ticket status as you work: Open → In Progress → Resolved → Closed.
4. Use comments to document your troubleshooting steps — this helps if the ticket is escalated.

**Use Case 5: "Tracking software license compliance"**
1. Go to Software Assets to see all licenses.
2. Check "Purchased" vs "Allocated" seat counts.
3. Set up alerts for expiring licenses (check the sidebar badge).
4. When an employee leaves, deallocate their seats promptly.

---

## Best Practices for IT Requests

### For Requesters (All Employees)
- **Be specific in your title** — "Email not working" is too vague. Try "Outlook not syncing in Matrix Pipeline since Monday."
- **Always include**: what you were doing, what happened, what you expected, and a screenshot.
- **Select the right service type** — ITSM has two types. A service request covers something that used to work and is now broken, plus access, a data fix, or a how-to within what already exists. A change request is new or different behaviour. Support sets the final type.
- **Choose priority honestly** — Urgent is for outages affecting many people. Don't mark a cosmetic issue as Urgent.
- **Select a related asset** — this is required. If unsure, describe the device in your description and IT will fix the link.
- **Check before submitting** — search My Requests to see if you already have an open ticket for the same issue.

### For IT Staff
- **Reply to an Urgent ticket within 30 minutes** — a public reply in the ticket, even if you cannot fix it yet. Assigning the ticket is not a reply.
- **Document everything in comments** — future tickets for the same asset will benefit from your notes.
- **Link tickets to assets** — this builds a history for each asset that helps with replacement decisions.
- **Use the analytics dashboard** — track response times and identify recurring problems that need deeper investigation.

---

## Service Request Types

| Type | When to Use |
|------|-------------|
| **Service Request** | Something that used to work is broken, even when the fix needs code (e.g., "A report that opened yesterday now shows an error"). Also access, a data correction, or a how-to within what already exists (e.g., "I need a new laptop") |
| **Change Request** | New or different behaviour. Assessed within 2 business days; accepted changes ship in the weekly Thursday release (e.g., "Export this report to a file") |

If the same thing breaks again, raise a new service request and quote the earlier ticket number. Support links them and records the cause in the active ticket.

## Ticket Priorities and Response Times

Business hours are 09:00–18:00, Monday to Friday, local office time, excluding holidays. A ticket raised outside those hours starts at 09:00 on the next business day. The clock pauses while support waits for the user. Support sets the final priority from impact and urgency. These targets match the [service levels](https://iris.sharpsir.group/doc/urovni-obsluzhivaniya-h4SRzyzRl2) published on 15 October 2026.

| Priority | Reply | Fix or workaround | When |
|----------|-------|-------------------|------|
| **Urgent (P1)** | 30 minutes | 4 business hours | Many people cannot work |
| **High (P2)** | 1 business hour | 1 business day | A team cannot work, and there is no workaround |
| **Medium (P3)** | 4 business hours | 3 business days | A workaround exists, or one person is blocked |
| **Low (P4)** | 1 business day | 5 business days | It can wait |

A change request is not on this timer. Reply within 1 business day. Decide (accept, reject, or schedule) within 2 business days. Accepted changes ship in the weekly Thursday release.

## Ticket Statuses

| Status | Meaning |
|--------|---------|
| **Open** | New. Only at 1st line, and only before the first reply to the user |
| **In Progress** | Someone is working on it. A fix that exists only on staging stays here |
| **Pending** | Waiting for the user, a vendor, or an approval. The clock is paused |
| **Resolved** | The fix is live in production, or the question has been answered. The user gets a short note of what was done |
| **Closed** | The user confirmed, or 3 business days passed with no reply. A reply reopens it |

---

## Languages

ITSM supports two interface languages:
- **English**
- **Russian**

To switch language, click the language toggle (globe icon) in the sidebar footer.

---

## Frequently Asked Questions

### General

**Q: What is ITSM?**
A: It is the Sharp Matrix app for managing IT service requests, assets, software licenses, vendors, projects, and budgets. All employees can submit IT requests through it.

**Q: Who can see my service request?**
A: IT staff can see all service requests. Other employees can only see their own requests.

**Q: How do I know the status of my request?**
A: Go to My Requests in the sidebar. Your request shows its current status (Open, In Progress, Pending, Resolved, Closed).

**Q: How long will it take to resolve my request?**
A: It depends on priority, in business hours (09:00–18:00, Monday to Friday, local office time). Urgent: a reply within 30 minutes and a fix or workaround within 4 business hours. High: a reply within 1 business hour and a fix within 1 business day. Medium: a reply within 4 business hours and a fix within 3 business days. Low: a reply within 1 business day and a fix within 5 business days. A change is decided within 2 business days and, if accepted, ships in the weekly Thursday release. Full wording: [Уровни обслуживания](https://iris.sharpsir.group/doc/urovni-obsluzhivaniya-h4SRzyzRl2).

### Submitting Requests

**Q: Why do I need to select a related asset?**
A: Every service request must be linked to at least one IT asset so the IT team knows which equipment or system is affected.

**Q: I don't know which asset to select. What should I do?**
A: Ask your manager or IT department which asset is related to your issue. If unsure, describe the equipment in your request description and IT staff will link the correct asset.

**Q: Can I update my request after submitting?**
A: You can add comments to your request. For major changes, contact IT staff directly.

**Q: Can I cancel a request?**
A: Contact IT staff to close or cancel a request.

### Assets and Licenses

**Q: How do I check if a software license is available?**
A: Go to Software Assets in the sidebar and check the available seats column for the software you need.

**Q: Who manages the asset inventory?**
A: IT staff and IT Admins manage the asset inventory. Contact IT if you notice missing or incorrect asset information.

**Q: Can I see assets assigned to me?**
A: IT staff can search and filter assets. Your assigned devices should be visible in your related tickets and software allocations.

### Notifications

**Q: How will I know when my ticket is updated?**
A: You receive in-app notifications when your request status changes or when IT staff adds a comment. Check the notification badge in the sidebar.

**Q: I'm not getting notifications. What should I do?**
A: Refresh the page. If notifications still don't appear, contact your Admin.

---

## Troubleshooting

### Login and Access

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Cannot log in** | Wrong credentials or no account | Check email/password. Contact Admin if you don't have an account. |
| **"Page Not Available" on a page** | Your role doesn't have permission | Contact your Admin to check your role and ITSM permissions. |
| **Session expired unexpectedly** | Your login session timed out | Log in again. This is normal after periods of inactivity. |

### Service Desk

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Cannot create a ticket** | Missing required fields or no asset selected | Fill in all required fields (title ≥5 chars, description ≥10 chars) and select at least one related asset. |
| **Ticket not appearing in My Requests** | Page not refreshed | Refresh the page. If the ticket still doesn't appear, try logging out and back in. |
| **Cannot add a comment** | Ticket may be closed or you lack permission | Check the ticket status. Contact IT if you believe this is an error. |
| **Badge shows "breached" next to a ticket** | The response time target was not met for this ticket | This is informational. IT staff are aware and working on it. |

### Assets

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Cannot find an asset** | Asset not registered or different name | Try different search terms. Contact IT staff to verify the asset exists in the system. |
| **Asset details are incorrect** | Data entry error | Report to IT staff to update the asset record. |
| **Software allocation fails with "Not enough seats"** | All license seats are in use | Contact IT to purchase additional seats or deallocate unused ones. |

### General

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Page loads slowly** | Large dataset or network issue | Wait a moment and refresh. If persistent, check your internet connection. |
| **Data not updating in real time** | Page needs to be refreshed | Refresh the page. If that does not help, press Ctrl+Shift+Delete, select "Cached images and files", and click Clear. |
| **Error message after clicking Save** | Validation error or server issue | Check all required fields are filled correctly. If the error persists, note the exact error message and report to IT. |

---

## Known Issues and Workarounds

| Issue | Workaround | Status |
|-------|-----------|--------|
| Documentation page links are placeholders | Documentation content is being developed. Use this KB article for support guidance. | Known |
| Software Assets sidebar badge may not display count | Does not affect functionality — navigate to the Software Assets page directly. | Known |
| Some settings tabs may show template-default values | Admin should verify and update settings after deployment. | Configuration |

---

## When to Escalate — Incident Reporting

If you cannot resolve the issue using the troubleshooting steps above, submit an incident to the 2nd Line Support team.

Report the issue using the standard incident template — see [How to Report an Incident](incident-reporting.md). Mention **ITSM** as the app name and include the **ticket ID** if relevant.

---

## Quick Reference Card

| Task | Where to Go |
|------|-------------|
| Submit an IT request | Sidebar → Service Catalog → catalog item, or Free-form request |
| View my requests | Sidebar → My Requests |
| View all tickets (IT staff) | Sidebar → SD Queue |
| View ticket analytics | Sidebar → SD Analytics |
| Manage IT assets | Sidebar → Assets |
| Register a new asset | Sidebar → Assets → New Asset |
| Manage software licenses | Sidebar → Software Assets |
| Manage vendors | Sidebar → Vendors |
| Manage IT projects | Sidebar → Projects |
| View budget | Sidebar → Budget |
| View analytics | Sidebar → Analytics |
| View IT architecture | Sidebar → IT Architecture |
| View documentation | Sidebar → Documentation |
| Configure settings (admin) | Sidebar → Settings |
| Switch language | Sidebar footer → Globe icon |
| Switch theme (light/dark) | Sidebar footer → Theme toggle |
| Return to Agency Hub | Sidebar footer → Back to Agency Hub |
