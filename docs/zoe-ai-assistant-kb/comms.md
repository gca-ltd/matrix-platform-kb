# Sharp Matrix Comms — 1st Line Support Knowledge Base

> **App name:** Matrix Communications (Matrix Comms)
> **URL:** [https://intranet.sharpsir.group/comms/](https://intranet.sharpsir.group/comms/)
> **Purpose:** Send and receive WhatsApp messages with clients, manage conversations, run campaigns, and use AI-assisted replies.
> **Users:** Brokers, Marketing Managers, Sales staff, Admins.

---

## What Is Matrix Comms?

Matrix Communications is the WhatsApp messaging platform for Sharp Sotheby's International Realty. It gives you one shared inbox for all incoming and outgoing WhatsApp messages. The app includes AI-powered reply suggestions, conversation assignment to brokers, pre-approved message templates, and the ability to send bulk campaigns to multiple contacts.

---

## How to Access Matrix Comms

1. Open your browser and go to [https://intranet.sharpsir.group/comms/](https://intranet.sharpsir.group/comms/).
2. You will be redirected to the Sharp Matrix SSO login page.
3. Sign in with your company email and password, or use "Sign in with Microsoft".
4. After login you land on the **Chats** page (your inbox).

If you cannot log in, your account may not have been set up with access to Comms. Contact your Admin or IT department.

---

## User Roles and What They Can Do

| Role | Sidebar Pages | What They Can Do |
|------|--------------|-----------------|
| **Broker** | Chats, Contacts, Analytics, Settings (profile/notifications/quick replies) | View own + unassigned chats, send/receive messages, use quick replies, claim chats by answering |
| **Team lead** | Chats, Assignments, Contacts, Analytics, Settings | Same as broker + assign/reassign chats across the org |
| **Admin (org/global)** | All pages including Templates, Campaigns, Twilio, Permissions | Full access: channels, templates, campaigns, role matrix |

**Notes (2026-09 launch):**
- The **Templates** page is admin-only. Brokers still pick templates from inside a chat (required outside the 24-hour WhatsApp window).
- **Campaigns** are admin-only (server-enforced).
- **Twilio / Permissions** settings tabs are admin-only. The old Data Layer settings tab was removed (unused).
- **Voice calls are not supported** — Comms is WhatsApp messaging only. Clients cannot call the WhatsApp Business number through this app.

---

## Main Features

### Conversations (Chat Inbox)

The Chats page is your main workspace. It shows all WhatsApp conversations organized by status.

**Status tabs:**
- **All** — every conversation
- **Active** — currently open conversations (includes active, waiting, and new statuses)
- **Waiting** — conversations awaiting a response
- **Archived** — closed or archived conversations

**How contacts appear:** when a customer messages your WhatsApp number for the first time, Comms automatically creates a **Contact** and an unassigned conversation. Brokers see that chat in the shared unassigned pool; answering it **claims** the chat for them.

**How to use the inbox:**

1. Click a conversation on the left panel to open it.
2. Type your message in the text box at the bottom and press Enter or click Send.
3. You can also:
   - **Send a template** — click the template icon to choose a pre-approved WhatsApp template.
   - **Use a quick reply** — click the Zap (⚡) icon to open the Quick Replies popover and insert a saved reply.
   - **Attach media** — send images, video, documents, or voice notes.
   - **Add an internal note** — notes visible only to staff, not to the client.
   - **Set a reminder** — schedule a follow-up reminder for this conversation.
   - **Pin/unpin** — pin important conversations to the top.
   - **Archive** — move conversation to the Archived tab.

**24-hour window:** after 24 hours without a customer reply, free-form text and media are blocked. Use a pre-approved template to reopen the conversation.

### Assignments

Team leads and admins assign chats on the Assignments page. Brokers may only claim an unassigned chat for themselves (or by answering it). Reassigning someone else's chat requires elevated access.

### Starting a New Conversation

1. Click the **Start Conversation** button.
2. Enter the client's WhatsApp phone number (or select an existing contact).
3. The conversation is created and you can begin messaging.

**Note:** WhatsApp requires approved templates when you message someone for the first time or after 24 hours of no reply. The app blocks free-form send outside the window and opens the template picker.

### Templates

Templates are pre-approved message formats required by WhatsApp for outbound messaging.

**Viewing templates:**
1. Go to **Templates** in the sidebar.
2. Browse or search the template list.

**Creating a template:**
1. Go to Templates → click **New Template**.
2. Choose type: Simple (text only) or Content (with media/buttons).
3. Fill in the template name, body text, category (Marketing, Utility, Authentication), and language.
4. Submit for approval. Templates must be approved by WhatsApp/Twilio before they can be used.

**Template statuses:**
- **Pending** — submitted, awaiting approval
- **Approved** — ready to use
- **Rejected** — not approved (edit and resubmit)

### Assignments

Admins and managers can assign conversations to specific brokers:

1. Go to **Assignments** in the sidebar.
2. Filter by unassigned or assigned conversations.
3. Select one or more conversations.
4. Search for a broker by name and assign.
5. The assigned broker will see the conversation in their inbox.

### Campaigns

Run bulk WhatsApp campaigns to multiple contacts:

1. Go to **Campaigns** in the sidebar.
2. The page title is **Launch Campaign**.
3. Choose a template.
4. Fill in template variables.
5. Select contacts from your contact list or enter phone numbers manually.
6. Launch the campaign.
7. View delivery analytics (sent, delivered, read, replied).

### Contacts

Manage your WhatsApp contact list:

1. Go to **Contacts** in the sidebar.
2. Search, add, edit, or delete contacts.
3. View conversation history for any contact.
4. Merge duplicate contacts.

### Analytics

View messaging performance metrics:

1. Go to **Analytics** in the sidebar.
2. See charts for: messages sent/received, response times, conversation volumes, campaign performance.

### Quick Replies (Snippets)

Save frequently used responses:

1. Go to **Settings** → **Quick Replies**.
2. Add a new snippet with a title and body text.
3. Use quick replies in conversations by clicking the Zap (⚡) icon in the chat window.

### Settings

Settings tabs (accessible to all users; some sections admin-only):

- **General** — app-wide settings including theme and "Show Detailed Errors" toggle (helps admins see more information when something goes wrong)
- **Profile** — your display name and preferences
- **Notifications** — message and reminder notifications
- **Quick Replies** — manage saved quick reply messages
- **Twilio** — WhatsApp channel configuration (admin only)
- **Permissions** — role-based page and action access (admin only)
- **Data Layer** — data source configuration (admin only)

---

## Languages

Matrix Comms supports three interface languages:
- **English**
- **Russian**
- **Hungarian**

To switch language, click the language toggle in the sidebar footer or go to Settings.

WhatsApp message templates can be created in any language supported by WhatsApp.

---

## AI Features

### AI Integration

Matrix Comms uses an AI assistant for:

- **Autonomous first responses** — the AI can automatically reply to incoming messages when the bot is turned on for a conversation and the AI service has been set up by your Admin.
- **Customer quick-reply buttons (visitor NBPS)** — after a bot reply, the AI may attach up to three tap-to-send options on the customer's WhatsApp (e.g. property type). The broker thread shows those buttons on the bot message and labels the customer's tap as a choice.
- **Broker coach suggestions** — separate chips above the composer suggest what **you** could reply; they are **not** the same as the customer's WhatsApp buttons and are never sent to the customer automatically.
- **Voice notes and translation** — incoming WhatsApp voice notes are turned into text, and you can tap to translate a message into your preferred language.
- **Bot toggle** — each conversation has a bot on/off switch. When "on", the AI handles replies. When "off", only human agents reply.

> **Platform note (ops):** the AI backend is moving from the external HumaticAI service onto the in-platform Digital Employees Conversations API (SR000518). Brokers do not need to change how they use suggestions or translation.

> **Platform note (ops, 2026-09-04):** every Comms API route is served by the single
> `api` edge function (`/functions/v1/api/...`, handlers `api/handle-*.ts`). The fourteen
> earlier single-purpose functions (`templates`, `contacts`, `analytics`, `leads`, …) were
> undeployed because they still carried their original authorisation and let any
> token-holding broker bypass the gateway's permission rules. Only `twilio-webhook`,
> `twilio-worker`, `campaign-worker`, `reminders-cron` and `meta-template-sync` remain as
> separate entry points. Do not reintroduce a per-resource function.

### How to Use AI Suggestions

1. Open a conversation.
2. **Broker coach** chips (above the input) are draft replies for you — click to edit and send.
3. **Customer buttons** appear on green bot messages when the bot offered WhatsApp quick-replies; inbound taps show as "Customer chose …".
4. To disable AI for a conversation, toggle the bot switch off.

---

## Frequently Asked Questions

### General

**Q: What is Matrix Comms?**
A: It is the Sharp Matrix app for WhatsApp Business communication. It lets you chat with clients, run campaigns, and manage contacts through WhatsApp.

**Q: How is this different from regular WhatsApp?**
A: Matrix Communications connects to WhatsApp through a business messaging service. It lets multiple team members share one company WhatsApp number, use pre-approved templates, run campaigns, see analytics, and get AI-assisted replies — features not available in regular WhatsApp.

**Q: Can clients see which broker they are chatting with?**
A: No. All messages appear to come from the company WhatsApp Business number. The client sees one conversation with the company.

### Messaging

**Q: Do I need to use a template for the first message?**
A: WhatsApp Business policy generally requires that the first outbound message uses an approved template. The app allows you to start conversations, but Twilio/WhatsApp may reject non-template first messages. Use a template when initiating contact with a new number.

**Q: What is the 24-hour messaging window?**
A: After a client sends a message, you have 24 hours to reply with free-text messages. After 24 hours, you must use a template to re-engage the conversation.

**Q: My template was rejected. What do I do?**
A: Review WhatsApp's template guidelines (no spam, no prohibited content). Edit the template to comply and resubmit. Common rejection reasons: too promotional, unclear opt-out, or violating WhatsApp commerce policies.

**Q: Can I send images or documents?**
A: Yes. Use the attachment feature in the chat window to send images, PDFs, and other supported file types.

### Conversations

**Q: How do I know if a conversation is assigned to me?**
A: Conversations assigned to you appear in your inbox. You can also check the Assignments page.

**Q: Can I see conversations assigned to other brokers?**
A: Only if your role has broader visibility (Admin, or team/global scope). Brokers typically see only their own conversations.

**Q: What are internal notes?**
A: Notes visible only to staff, not to the client. Use them to share context with colleagues about a conversation.

**Q: What are reminders?**
A: You can set a reminder on a conversation to follow up at a specific date and time. You will receive a notification when the reminder is due.

### Campaigns

**Q: How many messages can I send in a campaign?**
A: This depends on your Twilio account limits and WhatsApp Business tier. Check with your Admin for current limits.

**Q: Can I track if clients opened my campaign messages?**
A: You can see delivery and read receipts in the campaign analytics, subject to WhatsApp's privacy settings.

---

## Troubleshooting

### Login and Access

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Cannot log in** | Wrong credentials or no account | Check email/password. Contact Admin if you don't have an account. |
| **"Access Denied" on a page** | Your role doesn't have permission | Contact your Admin to check your role and permissions. |
| **Session expired unexpectedly** | Your login session timed out | Log in again. This is normal after periods of inactivity. |

### Messaging

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Message not delivered** | Client's WhatsApp is inactive, or number is wrong | Verify the phone number. Check delivery status in the conversation. |
| **"Template required" error** | 24-hour window has expired | Send a template message to re-engage the conversation. |
| **Template variables not filling** | Mismatch between template and provided variables | Check that all required variables are filled correctly. |
| **Media fails to send** | File too large or unsupported format | WhatsApp supports images (JPEG, PNG), PDFs, and documents up to 16 MB. Reduce file size and try again. |
| **Messages appear delayed** | Network or Twilio processing delay | Wait a few minutes. If persistent, check the connection status in the header — it shows "Reconnecting…" (amber) or "Offline" (red) when disconnected. |

### Real-Time Updates

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Conversations not updating in real time** | Live connection lost | Check the connection indicator in the top bar. If it shows "Reconnecting…" or "Offline", the app will check for new messages every few seconds automatically. Refresh the page to restore the live connection. |
| **New message notifications not appearing** | Browser notifications disabled or connection issue | Enable browser notifications in your browser settings. Refresh the page. |

### AI and Bot

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **AI suggestions not appearing** | Bot is disabled for this conversation, or the AI service is down | Check the bot toggle. If it's on and suggestions still don't appear, try refreshing. Report to Admin if persistent. |
| **AI gave an incorrect reply** | AI misunderstood the context | Toggle the bot off for this conversation and reply manually. Report the incorrect reply to your Admin for AI training feedback. |

### Campaigns

| Problem | Possible Cause | What to Do |
|---------|---------------|------------|
| **Campaign not sending** | Template not approved, or contact list is empty | Verify the template is approved. Check that contacts have valid phone numbers. |
| **Low delivery rate** | Invalid numbers or clients opted out | Review your contact list for invalid numbers. Check opt-out status. |

---

## Known Issues and Workarounds

| Issue | Workaround | Status |
|-------|-----------|--------|
| Country flag images may not load for some phone number prefixes | Does not affect functionality — the flag is a visual indicator only | Cosmetic |
| When the live connection drops, new messages appear with up to 5-second delay | The app automatically checks for new messages every few seconds. Refresh the page to restore instant updates. | By design |
| Role settings may appear empty on first load | Refresh the page. If the issue persists, the Admin should verify role settings in Settings → Permissions. | Known |
| Error details may not show unless "Show Detailed Errors" is enabled | Ask your Admin to turn on detailed errors in Settings → General. This helps with troubleshooting. | Configuration |

---

## When to Escalate — Incident Reporting

If you cannot resolve the issue using the troubleshooting steps above, submit an incident to the 2nd Line Support team.

Report the issue using the standard incident template — see [How to Report an Incident](incident-reporting.md). Mention **Matrix Comms** as the app name and include the **conversation or campaign ID** if relevant.

---

## Quick Reference Card

| Task | Where to Go |
|------|-------------|
| View conversations | Sidebar → Chats |
| Start a new conversation | Chats → New Conversation button |
| Send a template message | Chat window → Template icon |
| Use a quick reply | Chat window → Zap (⚡) icon |
| Assign conversations | Sidebar → Assignments |
| Manage templates | Sidebar → Templates |
| Run a campaign | Sidebar → Campaigns |
| View contacts | Sidebar → Contacts |
| View analytics | Sidebar → Analytics |
| Manage settings | Sidebar → Settings |
| Switch language | Sidebar footer → Language toggle |
| Switch theme (light/dark) | Sidebar footer → Theme toggle |
| Return to Agency Hub | Sidebar footer → Back to Agency Hub |
