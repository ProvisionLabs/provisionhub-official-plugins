# ProvisionHub official plugins

Declarative local generators for [ProvisionHub](https://github.com/ProvisionLabs/provisionhub).
The `plugins/` directory is supplied to the existing plugin loader; no plugin
code is executed and ProvisionHub does not need recompilation when templates
change.

| Plugin | Technology | Version | Output |
| --- | --- | --- | --- |
| [NestJS](plugins/nestjs/README.md) | NestJS 12.3.2, TypeScript 6.0.3 | 1.0.0 | `backend/` |
| [Next.js](plugins/nextjs/README.md) | Next.js 16.4.3, React 19.3.1, Tailwind CSS 4.3.3 | 1.0.0 | `frontend/` |
| `keycloak-go/` | Experimental gRPC authentication plugin | — | Not a declarative generator |

## Generate a project

Build or install ProvisionHub from the sibling repository. These commands
assume `provisionhub` is on `PATH` and run from this repository root. Supply an
absolute `--plugins` path when running elsewhere.

```sh
provisionhub project init --name sample-web --path ../sample-web --backend nestjs --frontend nextjs
provisionhub project plan --file ../sample-web/provisionhub.yaml --plugins ./plugins
provisionhub project apply --file ../sample-web/provisionhub.yaml --plugins ./plugins
```

The equivalent manifest is:

```yaml
apiVersion: provisionhub.dev/v1alpha1
kind: Project
metadata:
  name: sample-web
spec:
  backend:
    technology: nestjs
  frontend:
    technology: nextjs
```

Review the plan before typing `yes` to apply. For noninteractive automation,
`--yes` is explicit approval. Planning is read only. Apply creates declared
files and refuses overwrites; it does not install dependencies or run commands.
The current manifest requires a backend, so a frontend-only manifest is invalid.

```text
sample-web/
├── provisionhub.yaml
├── backend/
│   ├── package.json
│   └── src/
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    ├── .gitignore
    ├── README.md
    └── src/app/
        ├── layout.tsx
        ├── page.tsx
        └── globals.css
```

Install and run each application separately. Both require npm; NestJS requires
Node.js 24.15+, which also meets Next.js's Node.js 20.9+ minimum.

```sh
cd ../sample-web/frontend
npm install
npm run dev
npm run build
npm run start
```

From `../sample-web/backend`, run `npm install`, `npm run build`, and
`npm run start`. Each app defaults to port 3000, so set a different `PORT`
when running them concurrently. There is no API connection between them.

For the TUI, set `PROVISIONHUB_PLUGINS` to this repository's absolute
`plugins` directory. A portable ProvisionHub executable also discovers an
adjacent `plugins` directory when this variable is unset. Select NestJS and
Next.js. On Review, `p` optionally previews the read-only plan; Enter returns
to Review. The **Generate Project** action then creates the manifest and both
applications with one Enter. If a selected technology has no generator, Review
shows **Save Manifest Only** instead. If generation fails after the manifest is
saved, the result screen offers `p` to review and `g` then `y` to retry.

## Validation

Build ProvisionHub first with `go build -o <absolute-executable> ./cmd/provisionhub`.
The plugin repository needs no installed packages. The integration tests use
temporary destinations, call the real CLI, and only then explicitly run npm in
the generated applications. They need npm registry access. On PowerShell:

```powershell
$env:PROVISIONHUB_BIN = (Resolve-Path ../provisionhub/provisionhub.exe).Path
node --test tests/nestjs.test.mjs tests/nextjs.test.mjs
```

On Linux or macOS:

```sh
PROVISIONHUB_BIN="$(cd ../provisionhub && pwd)/provisionhub" node --test tests/nestjs.test.mjs tests/nextjs.test.mjs
```

The tests verify discovery, deterministic plans, approval refusal, naming,
output paths, conflict and traversal rejection, builds, and HTTP responses.
No network access is needed by the core Go test suite.

## Limits

Direct npm versions are pinned; generated projects receive a lockfile only
after `npm install`. Commit that lockfile for repeatable installs. No database,
authentication, Docker, cloud deployment, backend/frontend integration, or
remote plugin installation is generated. The executor's multi-file publication
is not transactional if a process crashes or the filesystem changes concurrently.
