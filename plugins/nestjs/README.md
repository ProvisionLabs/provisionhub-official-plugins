# Official NestJS plugin

`official-nestjs` version `1.1.0` implements ProvisionHub's existing
`provisionhub.dev/plugin/v1alpha1` contract for the built-in backend technology
`nestjs`. It is discovered from `--plugins <this-repository>/plugins` without
recompiling ProvisionHub. No executable plugin hooks or new schema fields exist.

The plugin declares ten files under `backend/`: `package.json`, `tsconfig.json`,
`tsconfig.build.json`, `nest-cli.json`, `.gitignore`, `README.md`, and
`src/{main,app.module,app.controller,app.service}.ts`.
The `{{componentName}}` variable is substituted into the package name,
generated README, and greeting. Legacy manifests render it as the project name;
named components render their own names. All other files are byte-for-byte copies.

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
