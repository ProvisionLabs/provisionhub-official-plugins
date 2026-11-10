# Official NestJS plugin

`official-nestjs` source version `1.2.0` (unreleased) implements ProvisionHub's
`provisionhub.dev/plugin/v1alpha1` contract for the built-in backend technology
`nestjs`. It is discovered from `--plugins <this-repository>/plugins` without
recompiling ProvisionHub. It requires core compatibility 0.2.0 and adds optional
declarative configuration; no executable hooks exist. Published 1.1.0 remains
unchanged in the registry.

The plugin declares ten files under `backend/`: `package.json`, `tsconfig.json`,
`tsconfig.build.json`, `nest-cli.json`, `.gitignore`, `README.md`, and
`src/{main,app.module,app.controller,app.service}.ts`.
The `{{componentName}}` variable is substituted into the package name,
generated README, and greeting. Legacy manifests render it as the project name;
named components render their own names. `src/main.ts` also renders the port.
Other declared copy files remain byte-for-byte copies.

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `greeting` | string, 1–120 Unicode characters | `Hello` | Prefix returned by GET `/` before ` from <component-name>!` |
| `port` | integer, 1–65535 | `3000` | Fallback HTTP listening port when `PORT` is unset |

For example, add `--set api.greeting=Welcome --set api.port=4001` for a component
named `api`. Another NestJS component keeps independent values. Greeting text
is rendered as a complete JSON string literal in TypeScript, preserving quotes
and control characters safely. The port is a validated integer literal.
Omitting configuration preserves the current greeting and port behavior.
The schema supplies TUI labels/descriptions and uses the shared core resolver;
see the [configuration contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/plugin-configuration.md).

The application uses NestJS `12.3.2`, TypeScript `6.0.3`, native ESM, and Node.js
24.15+. Nest packages share an exact version. `reflect-metadata` and `rxjs` are
runtime peers; Node types and TypeScript are the only development dependencies.
Build uses `tsc`, with no global CLI dependency. `nest-cli.json` is provided for
optional tooling, not used by the npm scripts. Version compatibility follows
the [NestJS migration guide](https://docs.nestjs.com/migration-guide).

After generation, run `npm install`, `npm run build`, and `npm run start` from
the generated component directory (`backend/` for legacy manifests). GET `/`
returns `Hello from <component-name>!`. `HOST` defaults to
`127.0.0.1` and `PORT` to `3000`; both can be overridden through the process
environment. No secrets or automatic environment-file loading are included.

No template lockfile is supplied: the project name varies and transitive npm
dependencies are resolved during installation. Commit the application's npm
lockfile after installation and use `npm ci` for subsequent repeatable installs.
Pinned direct versions alone do not freeze transitive dependency resolution.

NestJS and Next.js can be generated together when both official plugins are
available. Adding a technology without its own generator leaves the complete
plan non-executable. Existing
files are never overwritten; choose a fresh destination to generate again.
No dependency installation, shell commands, authentication, database setup,
Docker, cloud provisioning, or plugin installation occurs during generation.

See the [repository usage and test commands](../../README.md),
[validation results](VALIDATION.md), and the core
[plugin contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/architecture/plugins.md).
