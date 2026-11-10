# Official Next.js plugin

`official-nextjs` source version `1.3.0` (unreleased) uses ProvisionHub's
`provisionhub.dev/plugin/v1alpha1` contract for the built-in frontend ID
`nextjs`. Its `generate_frontend` capability declares ten files under
`frontend/`. ProvisionHub discovers it from this repository's `plugins`
directory without recompilation. Configuration and connections require core compatibility
0.3.0. Published 1.1.0 remains unchanged in the registry.

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `welcomeMessage` | string, 1–240 Unicode characters | `Welcome to your new Next.js application.` | Introductory text on the home page |
| `showCredits` | boolean | `true` | Controls visibility of the technology credit footer |

For example, add `--set admin.welcomeMessage=Administration --set admin.showCredits=false`
for a component named `admin`. Each repeated Next.js component has independent
values. The message renders as a JSON string literal inside a JSX expression;
credits render as a boolean expression in the generated application. Defaults
retain the current starter page behavior. The TUI gets labels/descriptions and
defaults from the schema. No new runtime dependencies are introduced. See the
[configuration contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/plugin-configuration.md).

The generated application uses Next.js `16.4.3`, React `19.3.1`, TypeScript
`6.0.3`, Tailwind CSS `4.3.3`, and ESLint `10.13.0`. It includes a strict
TypeScript configuration, App Router layout and home page, responsive Tailwind
styling, project README, and `.gitignore`. The package name, page, metadata,
and README use the validated `{{componentName}}` variable. Legacy manifests
render it as the project name; named components render their own names. Static
files are copied byte for byte. No executable hooks exist.

Use Node.js 20.9+ and npm. After generation, enter the generated component
directory (`frontend/` for legacy manifests) and run
`npm install`, `npm run dev`, `npm run build`, `npm run start`, or `npm run lint`.
The application serves the home page at <http://localhost:3000/>. Run the
NestJS backend separately if it is present; no API connection is configured.

Direct dependency versions are pinned. The plugin does not distribute a
lockfile because npm generates one with the final project name and resolved
transitive dependencies. Commit the generated lockfile and use `npm ci` for
repeatable installs. ProvisionHub itself never installs packages or runs
application commands.

The in-memory project specification can contain one or more named components
of supported categories. No project YAML or saved registration is created. Existing destination
files are never overwritten. Authentication, database connections, deployment,
and backend/frontend integration are outside this plugin.

See [repository usage and validation](../../README.md) and the core
[plugin contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/architecture/plugins.md).

The optional `server-api` consumer slot accepts capability type `http` with
protocol `http` and a validated integer port. It requires a connection-specific
`serverHost` (DNS hostname or IPv4/IPv6, without scheme/port/path/credentials).
For example, `--connect web:api:http --connection-set web:api:http.serverHost=127.0.0.1`
selects the named backend `api`. Its resolved component port determines the
endpoint. Each frontend can select a different target or share one provider.

A valid connection creates `.env.local` and `.env.example` containing private
`API_ORIGIN`, for `process.env.API_ORIGIN` in Next.js server code. Existing
environment values take precedence; restart after changing environment files.
Build-time/static rendering can consume environment too, so use dynamic server
execution when runtime reads are needed. No `NEXT_PUBLIC_*` value is inferred
or added. Browser addresses and cross-origin policy require separate choices.
No HTTP client or extra page is shipped. Without a connection, the original
ten-file output is unchanged. See [the runtime demonstration](../../docs/connections.md).
