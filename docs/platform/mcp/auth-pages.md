# MCP browser pages

Every consent, success, and error page a Matrix MCP server or authorization server shows is the same card as the intranet SSO sign-in page. Copy comes from [mcp-strings.json](mcp-strings.json). Layout comes from one module.

## Shell

`tools/mcp-conformance/auth-page.mjs` exports `renderAuthPage({ lang, title, body, actions })`.

| Piece | Rule |
|---|---|
| Canvas | Light, `hsl(220 20% 98%)`. White card, navy border, gold divider. |
| Logo | Sharp SIR wordmark, navy fill on the light card. |
| Type | Cormorant Garamond for the title, Nunito Sans for the body. |
| Marker | The card element has `data-matrix-auth-page="1"`. A probe fails when the marker is missing. |
| Buttons | Allow / Authorize is `btn-primary`. Deny is `btn-outline`. |
| Languages | `lang` is `en`, `ru`, or `hu`, taken from `Accept-Language`. Consent sentences are the `mcpServer.consent.*` keys. |
| Footer | `© {year} Sharp Sotheby's International Realty`. |

`body` is HTML the caller has already escaped. `actions` are `{ label, url, method, variant }` rendered as forms. A page that posts one form with both buttons (the Qobrix credential form) puts those buttons in `body` and leaves `actions` empty. The button classes are the same.

Each server copies `auth-page.mjs` and `sharp-sir-logo.svg` into its own `tools/mcp-conformance/` and loads them at runtime. The copies stay identical to this repo. A server does not ship a second card design.

Qobrix field labels on the credential form (endpoint, username, password, one-time code) stay English. The consent sentences and the connected and error pages follow `Accept-Language`.

## MUST

Every browser page an MCP server or authorization server shows uses this shell.
