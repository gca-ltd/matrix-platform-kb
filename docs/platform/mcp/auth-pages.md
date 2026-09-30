# MCP browser pages

Every consent, success, and error page a Matrix MCP server or authorization server shows is the same card as the intranet SSO sign-in page. Copy comes from [mcp-strings.json](mcp-strings.json). Layout comes from one module. A new server gets identical pages by following this file and rendering through the shell.

## Page types

Three, and no others.

| Type | When | Body | Actions |
|---|---|---|---|
| Consent | Before any upstream login, with or without a credential form | The centred consent notice, then the form fields | Allow (`btn-primary`), then Deny (`btn-outline`) |
| Result | Connected, already connected | One `<p class="message">` | Close tab |
| Problem | Expired, used, cancelled, wrong account, sign-in failed, a failed security check | One `<p class="message">` | Close tab |

No other buttons, and no link back into an app.

## Anatomy

Top to bottom: the Sharp SIR logo and the gold divider, the title, the body, the actions, the footer.

| Piece | Rule |
|---|---|
| Canvas | Light, `hsl(220 20% 98%)`. White card, navy border, gold divider. |
| Logo | Sharp SIR wordmark, navy fill on the light card. No product logo. |
| Type | Cormorant Garamond for the title, Nunito Sans for the body. |
| Title | `mcpServer.consent.title` ("Sign in to {server}" / "Вход в {server}" / "Bejelentkezés: {server}"), or the client landing title for that state. |
| Marker | The card element has `data-matrix-auth-page="1"`. A probe fails when the marker is missing. |
| Consent notice | `consentNoticeHtml({ clientLine, clientName, server, returnLine, warning })`. The shell centres it. The client name is bold. A loopback redirect adds an amber warning. The page does not style this block, and it does not add a second intro line that repeats who is asking. |
| Message line | A result or problem page puts its one sentence in `<p class="message">`. The shell centres it. |
| Close tab | `close: { label, blocked }` from `mcp.page.close` and `mcp.page.closeBlocked`. The button calls `window.close()`. When the browser refuses, the button is replaced by the "close it yourself" line. |
| Footer | `© {year} Sharp Sotheby's International Realty`. The year is in `<span data-year>`. A committed page passes a fixed `year` and lets the browser set the current year. |
| Languages | `lang` is `en`, `ru`, or `hu`. A server reads `Accept-Language`: any `ru`, then any `hu`, otherwise `en`. A client page walks `navigator.languages` with the same rule. `<html lang>` matches. |

`body` is HTML the caller has already escaped. `actions` are `{ label, url, method, variant }` rendered as forms. A page that posts one form with both buttons (the Qobrix credential form) puts those buttons in `body` and leaves `actions` empty. The button classes are the same.

## Copy

Every string comes from `mcp-strings.json`, in EN, RU, and HU. Only product names stay untranslated (Qobrix CRM, Sharp Matrix, Digital Employees).

Each page says one thing once. The notice names the client and the account. The title names the server. Nothing repeats either.

A form error is one `.alert-err` line in the page language (`mcpServer.qobrix.needCredentials`, `needOtp`, `loginFailed`). Upstream error text is logged on the server and never shown.

## States

| State | Page | Title key | Message key | HTTP |
|---|---|---|---|---|
| Consent | Consent | `mcpServer.consent.title` | the notice | 200 |
| Connected | Result | `mcp.callback.connectedTitle` | `mcp.callback.connectedDetail` | 200 |
| Already connected | Result | `mcp.callback.alreadyConnectedTitle` | `mcp.callback.alreadyConnectedDetail` | 200 |
| Expired link | Problem | `mcpServer.consent.title` or `mcp.callback.expiredTitle` | `mcpServer.result.expired` or `mcp.callback.expiredDetail` | 400 |
| Used link | Problem | `mcp.callback.usedTitle` | `mcp.callback.usedDetail` | 400 |
| Cancelled | Problem | `mcp.callback.cancelledTitle` | `mcp.callback.cancelledDetail` | 200 |
| Wrong account | Problem | `mcp.callback.wrongAccountTitle` | `mcp.callback.wrongAccountDetail` | 200 |
| Sign-in failed | Problem | `mcpServer.consent.title` or `mcp.callback.failedTitle` | `mcpServer.result.error` or `mcp.callback.failedDetail` | 403 or 200 |
| Bad security check | Problem | `mcpServer.consent.title` | `mcpServer.result.error` | 403 |
| Unknown session | Problem | `mcpServer.consent.title` | `mcpServer.result.expired` | 400 |

A server that renders its own problem page uses the `mcpServer.*` keys. The client's landing page uses the `mcp.callback.*` keys.

## No plain text

Every browser-facing response renders on the card, including an unknown, expired, or used session, a failed security check, and a server error. JSON is only for API routes (`/token`, `/register`, `/health`, `/introspect`).

## Styling lives in the shell

Pages add no CSS for `.notice`, `.message`, `.btn`, or `.alert`. The only CSS a page may add is for its own form fields (inputs, the password toggle, the terms disclosure). A new shared block is added to the shell first, then copied out.

## Assets

`tools/mcp-conformance/auth-page.mjs` exports `renderAuthPage({ lang, title, body, year, actions, close })` and `consentNoticeHtml(...)`.

Each server copies `auth-page.mjs`, `sharp-sir-logo.svg`, and `first-party-clients.json` into its own `tools/mcp-conformance/` and loads them at runtime. A client that renders a landing page also copies `mcp-strings.json`. The copies stay byte-identical to this repo. `node tools/mcp-conformance/check-auth-pages.mjs <repo>` fails when they differ, when `src/` sends a plain-text browser body, or when a page restyles a shared block.

`first-party-clients.json` lists `{ redirect_uri, name }` for Matrix clients. When the consent `redirect_uri` matches an entry exactly, the notice says the person returns to that name (`mcpServer.consent.returnToClient`). Any other client shows the redirect host. A loopback redirect still shows the loopback warning. Every client sees the notice.

The Qobrix credential form uses `mcpServer.qobrix.*` for its field labels.

An MCP client's landing page is part of the same sign-in flow and uses this shell. It is a static page, not a route inside the signed-in app, so it does not start an application login.

## MUST

Every browser page in an MCP sign-in flow uses this shell (AS-11). That includes consent, result, problem, and the client's landing page.
