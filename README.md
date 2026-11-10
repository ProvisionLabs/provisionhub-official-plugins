# ProvisionHub official plugins

Declarative generators for [ProvisionHub](https://github.com/ProvisionLabs/provisionhub).
Plugins contain YAML and source templates. Generation executes no plugin scripts,
installs no dependencies, and creates no ProvisionHub project metadata.

| Source plugin | Version | Configurable options |
| --- | --- | --- |
| [NestJS](plugins/nestjs/README.md) | 1.2.0 (unreleased) | Greeting prefix and default HTTP port |
| [Next.js](plugins/nextjs/README.md) | 1.2.0 (unreleased) | Welcome message and technology credits |

Configured source plugins require core compatibility 0.2.0. The public
[registry](registry.json) continues to advertise the immutable, published 1.1.0
packages, which have no configuration fields. Those still work with the new
core. Use `--plugins ./plugins` for the new source versions. Publishing 1.2.0
and adding its registry entries is a separate release step; see
[distribution](docs/distribution.md). The experimental `keycloak-go/` module is
excluded from declarative distribution.

## Generate and configure

Build ProvisionHub from the sibling repository. From this repository, preview:

```sh
provisionhub project plan --name commerce --path ../commerce --plugins ./plugins --component api:backend:nestjs --component billing:backend:nestjs --component web:frontend:nextjs --component admin:frontend:nextjs --set api.greeting=Welcome --set api.port=4001 --set admin.welcomeMessage=Administration --set admin.showCredits=false
```

Repeat the flags with `project apply` to review and approve generation. An
interactive terminal requires literal `yes`; `--yes` gives explicit approval in
automation. `project plan --output json` includes resolved configuration for
each component. Generation creates `api/`, `billing/`, `web/`, and `admin/` as
ordinary applications. It writes no project YAML, plugin lock, SQLite project
registration, or application package lockfile. Existing files are never overwritten.

Settings belong to the named component. In this example `billing` retains
`Hello` and port `3000`, while `web` retains its original welcome and credits.
Defaults preserve existing behavior when no `--set` flags are supplied.
Booleans are exactly `true`/`false`; integers are signed decimal values; strings
are literal text. Quote a whole `--set 'api.greeting=Good morning'` value when
it contains spaces. Unknown keys/components, duplicate settings, incompatible
types, and constraint violations are errors. No framework settings are in Go.

In the Bubble Tea TUI, set `PROVISIONHUB_PLUGINS` to the absolute `plugins`
directory, then choose Create Project. Add a component, choose category and
technology, enter its name, and configure the dynamic fields. Labels,
descriptions, and defaults come from the plugin. Left/Right/Space selects a
boolean or enum; text inputs collect strings and integers. Enter advances and
saves the last field; Esc returns to the name with the draft intact. Editing a
component restores its settings. Review shows configuration summaries; `p`
opens the full read-only plan, and Enter on Review approves generation.

Install the published packages with `plugin install official/nestjs@1.1.0`
and `plugin install official/nextjs@1.1.0`. They persist in application data and
generate offline. Home → Plugins provides managed installation, removal, and
explicit version selection. See the core [Plugin Manager guide](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/plugin-registry.md).

## Plugin authoring and planning

The optional flat `configuration.properties` mapping supports string, boolean,
integer, and string enum fields, defaults, required values, labels, descriptions,
string lengths, and integer ranges. Each configured option in these examples
changes generated source. The core rejects malformed schemas and does not
silently coerce incompatible values. It resolves defaults and validates template
references before contributing generation operations. Planning renders bytes in
memory for validation and hashing without filesystem writes or command execution.

Templates retain `{{projectName}}` and `{{componentName}}`, with
`{{component.name}}` also available. Configuration strings use complete JSON
literals (`{{config.greeting|json}}`) or HTML text escaping
(`{{config.title|html}}`). Boolean and integer references such as
`{{config.showCredits}}` and `{{config.port}}` produce literals. Missing or
unsupported references fail; there are no arbitrary expressions or scripts.
See the authoritative [configuration schema and authoring guide](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/plugin-configuration.md)
and [plugin manifest specification](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/architecture/plugins.md).

## Validation

Build the sibling core with `go build -o <absolute-executable> ./cmd/provisionhub`.
The offline generation tests need only that executable and Node:

```powershell
$env:PROVISIONHUB_BIN = (Resolve-Path ../provisionhub/provisionhub.exe).Path
node --test tests/configuration.test.mjs
```

On Linux/macOS, set `PROVISIONHUB_BIN` to the absolute executable path using
your shell. Tests use temporary directories and local plugins. They verify
four configured components, deterministic plans/files, defaults, isolation,
typed errors, approval, no metadata/persistence, no-overwrite, symlinks, and
path safety. CI also tests reproducible packages and managed offline generation
using a pinned compatible core. No npm registry access is required by these checks.

Explicit runtime checks install dependencies, build all four applications,
lint Next.js, and check default HTTP responses. They require compatible Node/npm
and npm registry access:

```sh
node --test --test-concurrency=1 tests/nestjs.test.mjs tests/nextjs.test.mjs tests/components.test.mjs
```

NestJS needs Node 24.15+, which also meets the existing Next.js requirement.
Run `npm install`, `npm run build`, and `npm run start` in each generated
component when ready. Assign distinct ports for concurrent applications.
ProvisionHub never runs these commands. npm creates application lockfiles during
installation; commit those for repeatable installs. Framework dependencies are
unchanged by this milestone. Authentication, database wiring, connections,
deployment, package manager selection, and conditional file generation remain
outside these examples.
