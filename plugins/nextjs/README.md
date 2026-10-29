# Official Next.js plugin

`official-nextjs` version `1.0.0` uses ProvisionHub's existing
`provisionhub.dev/plugin/v1alpha1` contract for the built-in frontend ID
`nextjs`. Its `generate_frontend` capability declares ten files under
`frontend/`. ProvisionHub discovers it from this repository's `plugins`
directory without recompilation.

The generated application uses Next.js `16.4.3`, React `19.3.1`, TypeScript
`6.0.3`, Tailwind CSS `4.3.3`, and ESLint `10.13.0`. It includes a strict
TypeScript configuration, App Router layout and home page, responsive Tailwind
styling, project README, and `.gitignore`. The package name, page, metadata,
and README use the validated `{{projectName}}` manifest variable. Static files
are copied byte for byte. No other template variables or executable hooks exist.

Use Node.js 20.9+ and npm. After generation, enter `frontend/` and run
`npm install`, `npm run dev`, `npm run build`, `npm run start`, or `npm run lint`.
The application serves the home page at <http://localhost:3000/>. Run the
NestJS backend separately if it is present; no API connection is configured.

Direct dependency versions are pinned. The plugin does not distribute a
lockfile because npm generates one with the final project name and resolved
transitive dependencies. Commit the generated lockfile and use `npm ci` for
repeatable installs. ProvisionHub itself never installs packages or runs
application commands.

The current project manifest still requires a backend. Select `nestjs` and
`nextjs` together, with both official plugins available. Existing destination
files are never overwritten. Authentication, database connections, deployment,
and backend/frontend integration are outside this plugin.

See [repository usage and validation](../../README.md) and the core
[plugin contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/architecture/plugins.md).
