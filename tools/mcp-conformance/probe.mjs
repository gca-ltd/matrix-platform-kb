#!/usr/bin/env node
/**
 * Read-only Matrix MCP profile probe.
 * Usage: node probe.mjs <mcp-url> [--token <bearer>] [--register <as-metadata-url>] [--app-base <url>] [--consent-url <url>]
 *
 * Dynamic registration is attempted only to confirm a foreign redirect is
 * rejected. A successful registration is reported as a failure of the check.
 */
const url = process.argv[2];
const tokenFlag = process.argv.indexOf("--token");
const token = tokenFlag >= 0 ? process.argv[tokenFlag + 1] : "";
const appBaseFlag = process.argv.indexOf("--app-base");
const appBase = appBaseFlag >= 0 ? process.argv[appBaseFlag + 1] : "";
const consentFlag = process.argv.indexOf("--consent-url");
const consentOverride = consentFlag >= 0 ? process.argv[consentFlag + 1] : "";
if (!url || url.startsWith("--")) {
  console.error("usage: node probe.mjs <mcp-url> [--token <bearer>]");
  process.exit(2);
}

const results = [];
function record(name, ok, detail, skipped = false) {
  results.push({ name, ok, skipped, detail });
  const label = skipped ? "SKIP" : ok ? "PASS" : "FAIL";
  console.log(`${label}  ${name}${detail ? " — " + detail : ""}`);
}

const ACCEPT = "application/json, text/event-stream";

async function post(target, body, headers = {}) {
  const res = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json", accept: ACCEPT, ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { res, text };
}

function wwwAuth(res) {
  return res.headers.get("www-authenticate") || "";
}

const initBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "matrix-mcp-probe", version: "0" },
  },
};

const authHeaders = token ? { authorization: `Bearer ${token}` } : {};

const init = await post(url, initBody, authHeaders);
const challenge = wwwAuth(init.res);
if (!token) {
  const hasMeta = /resource_metadata="([^"]+)"/.test(challenge);
  const hasScope = /(?:^|[,\s])scope="/.test(challenge) || /scope=/.test(challenge);
  record("401 challenge", init.res.status === 401 && hasMeta && hasScope, `status ${init.res.status} ${challenge.slice(0, 180)}`);
} else {
  record("initialize with token", init.res.status === 200, `status ${init.res.status} ${init.text.slice(0, 160)}`);
}

const session = init.res.headers.get("mcp-session-id");
if (init.res.status === 200 && session) {
  const follow = await post(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, {
    ...authHeaders,
    "mcp-session-id": session,
    "mcp-protocol-version": "2025-11-25",
  });
  record("session follow-up", follow.res.status === 200, `status ${follow.res.status}`);
  const unknown = await post(url, { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }, {
    ...authHeaders,
    "mcp-session-id": "00000000-0000-4000-8000-000000000000",
    "mcp-protocol-version": "2025-11-25",
  });
  record("unknown session", unknown.res.status === 404, `status ${unknown.res.status}`);
} else if (init.res.status === 200 && !session) {
  record("stateless (no session id)", true, "server did not issue MCP-Session-Id");
} else {
  record("session follow-up", true, "needs a bearer token", true);
}

const get = await fetch(url, { headers: { accept: "text/event-stream", ...authHeaders } });
const getType = get.headers.get("content-type") || "";
record("GET sse or 405", get.status === 405 || getType.includes("text/event-stream"), `status ${get.status} ${getType}`);

const origin = await post(url, initBody, { ...authHeaders, origin: "https://evil.example" });
record("bad origin", origin.res.status === 403, `status ${origin.res.status}`);

if (token || init.res.status === 200) {
  const badVer = await post(url, { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }, {
    ...authHeaders,
    "mcp-protocol-version": "1999-01-01",
    ...(session ? { "mcp-session-id": session } : {}),
  });
  record("bad protocol version", badVer.res.status === 400, `status ${badVer.res.status}`);
} else {
  record("bad protocol version", true, "needs a successful initialize", true);
}

let prmUrl = "";
const metaMatch = /resource_metadata="([^"]+)"/.exec(challenge);
if (metaMatch) prmUrl = metaMatch[1];
else {
  const u = new URL(url);
  prmUrl = `${u.origin}/.well-known/oauth-protected-resource${u.pathname}`;
}
let asMetaUrl = "";
try {
  const prmRes = await fetch(prmUrl);
  const prm = await prmRes.json();
  const ok = prmRes.ok && typeof prm.resource === "string" && Array.isArray(prm.authorization_servers) && Array.isArray(prm.scopes_supported);
  record("protected resource metadata", ok, prmUrl);
  asMetaUrl = prm.authorization_servers?.[0];
} catch (err) {
  record("protected resource metadata", false, String(err.message || err));
}

if (asMetaUrl) {
  const issuer = new URL(asMetaUrl);
  const candidates = [
    `${issuer.origin}/.well-known/oauth-authorization-server${issuer.pathname}`,
    asMetaUrl.replace(/\/$/, "") + "/.well-known/oauth-authorization-server",
  ];
  let as = null;
  let used = "";
  for (const candidate of candidates) {
    const res = await fetch(candidate);
    if (!res.ok) continue;
    as = await res.json();
    used = candidate;
    break;
  }
  const s256 = Array.isArray(as?.code_challenge_methods_supported) && as.code_challenge_methods_supported.includes("S256");
  const cimd = as?.client_id_metadata_document_supported === true;
  record("authorization server metadata", Boolean(as) && s256 && cimd, used || "not found");
  if (as?.registration_endpoint) {
    const reg = await fetch(as.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_name: "matrix-mcp-probe",
        redirect_uris: ["https://evil.example/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    });
    const body = await reg.json().catch(() => ({}));
    record("foreign redirect rejected", reg.status === 400 && body.error === "invalid_redirect_uri", `${reg.status} ${body.error || ""}`);
  }
}

if (token && init.res.status === 200) {
  const list = await post(url, { jsonrpc: "2.0", id: 5, method: "tools/list", params: {} }, {
    ...authHeaders,
    "mcp-protocol-version": "2025-11-25",
    ...(session ? { "mcp-session-id": session } : {}),
  });
  let tools = [];
  try {
    const parsed = JSON.parse(list.text.replace(/^data:\s*/m, "").split("\n")[0].startsWith("{") ? list.text : (list.text.match(/\{[\s\S]*\}/) || ["{}"])[0]);
    tools = parsed.result?.tools || parsed.tools || [];
  } catch { tools = []; }
  const missing = tools.filter((t) => !t.title || !t.annotations || typeof t.annotations.readOnlyHint !== "boolean");
  record("tool annotations", tools.length > 0 && missing.length === 0, `${tools.length} tools, ${missing.length} missing title/readOnlyHint`);
  const bytes = Buffer.byteLength(list.text);
  record("tools/list size", bytes <= 60_000, `${bytes} bytes (SHOULD <= 60000)`);
  const headings = ["Purpose and data boundaries", "Workflows", "Data model and IDs", "Query language", "Pagination and payload defaults", "Output caps and refine protocol", "Identity", "Known quirks"];
  let instructions = "";
  try {
    const initJson = JSON.parse(init.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    instructions = initJson.result?.instructions || "";
  } catch { instructions = ""; }
  const missingHeads = headings.filter((h) => !instructions.includes(h));
  record("instructions headings", missingHeads.length === 0 && instructions.length > 0 && instructions.length <= 16000, missingHeads.join(", ") || `${instructions.length} chars`);
}

const consentUrl = consentOverride
  ? new URL(consentOverride)
  : new URL("consent", url.endsWith("/") ? url : `${url}/`);
if (!consentOverride) consentUrl.searchParams.set("e", "invalid");
try {
  const consent = await fetch(consentUrl);
  const html = await consent.text();
  if (!consentOverride && consent.status === 404) {
    record("auth page shell", true, "404 — pass --consent-url when consent is on another host", true);
  } else {
    record(
      "auth page shell",
      html.includes('data-matrix-auth-page="1"'),
      `${consent.status} ${consentUrl.pathname}`,
    );
  }
} catch (err) {
  record("auth page shell", false, err.message);
}

if (appBase) {
  const landing = new URL("oauth/mcp-callback", appBase.endsWith("/") ? appBase : `${appBase}/`);
  try {
    const head = await fetch(landing, { method: "HEAD" });
    record("sign-in landing", head.status === 200, `${head.status} ${landing.pathname}`);
  } catch (err) {
    record("sign-in landing", false, err.message);
  }
} else {
  record("sign-in landing", true, "pass --app-base to check the landing URL", true);
}

const failed = results.filter((r) => !r.skipped && !r.ok).length;
const skipped = results.filter((r) => r.skipped).length;
const passed = results.filter((r) => !r.skipped && r.ok).length;
console.log(`\n${passed} passed, ${skipped} skipped, ${failed} failed`);
process.exit(failed ? 1 : 0);
