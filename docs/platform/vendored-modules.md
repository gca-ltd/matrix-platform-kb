# Porting a Digital Employees feature into another Matrix app

Digital Employees owns a feature. A host app vendors a byte-identical copy and talks to the Digital Employees backend with the signed-in person's Matrix SSO token. The first port is the Playground into Matrix Sales Automation ([ADR-061](../architecture/decisions/ADR-061.md)).

## Ownership

Digital Employees keeps the source at `src/features/<module>`. The host keeps the copy at `src/vendor/<module>`. The host does not iframe the page and does not keep a one-time fork. A change is made in Digital Employees, then copied. A hand-edit of the copy is a defect: the next copy overwrites it, and the hash check fails until then.

## Tooling

- The host's `scripts/sync-<module>.mjs` copies the feature and writes `manifest.json`: the Digital Employees commit, `MODULE_VERSION`, and a sha256 of every file. Sales Automation runs this as `npm run sync:de-playground`. The source checkout is the sibling `matrix-digital-employees`, or `DE_PLAYGROUND_SRC`.
- `scripts/check_<module>_vendor.mjs` runs inside the host's guardrails and refuses a copy whose hashes do not match the manifest.
- Digital Employees `import-allowlist.test.ts` refuses an import that leaves the module, including a dynamic `import('@/...')`. A module that imports the host cannot be copied.

`MODULE_VERSION` in the module's `version.ts` moves when the host adapter would break.

## Adapter

One file in the host calls `configureDeClient`. It passes the Digital Employees project URL, the publishable key, the host's SSO access token, and a refresh. The host's auth context calls `publishDeIdentity` with the tenant, scope, and permissions whenever those change. Feature flags are decided by the host. Sales Automation shows training only for scopes `global`, `org_admin`, and `system_admin`.

## Host wiring

- A route and a sidebar entry. In Sales Automation the page is `/playground` and the item sits in its own Digital Workforce group, labelled Playground.
- A page key on the host's roles, added by an SSO migration in `matrix-platform-foundation`. Sales Automation's key is `playground`, and every role has it by default. An administrator removes it in Role Configuration.
- Wording in the host's i18n corpus: keys in `en.json`, an `APP_I18N_VERSION` bump, and a migration into `app_ui_strings`. When `main` has already used that version, take the next one and place the migration after the migrations already on `main`.
- The dependencies the module imports, the host's Vite and Tailwind settings, and any copied static assets (the Playground copies its voice-activity files at install and build).

## Access

Gate the page on the host's page key. Do not also require the Digital Employees client in `allowed_apps`. That claim is the union of every role the person holds, and it does not change when they switch role, so it cannot control one role. That check blocked Broker while Role Configuration showed the page as granted.

## Bringing it to Sales Automation staging and production

Build on the `cdto` branch. `main` moves on its own, so a pull request is not a cherry-pick: merge `main` into a branch that already contains the port, resolve the overlap, and open a pull request into `main`. The repository accepts a merge commit only. Merging deploys `/msa-staging-main/`. After that check, fast-forward `cdto` to `main` so the two staging sites match. Production `/msa/` is a later `main` → `prod` pull request, opened when the staging check is accepted.

## Still open

The Digital Employees edge functions accept any valid Matrix SSO JWT. A server-side check that training and employee-config apply require an admin scope is a follow-up. Until then the host UI is the only gate.
