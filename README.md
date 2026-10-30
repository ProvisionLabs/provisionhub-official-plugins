# ProvisionHub official plugins

Declarative local generators for [ProvisionHub](https://github.com/ProvisionLabs/provisionhub).
The `plugins/` directory is supplied to the existing plugin loader; no plugin
code is executed and ProvisionHub does not need recompilation when templates
change.

| Plugin | Technology | Version | Output |
| --- | --- | --- | --- |
| [NestJS](plugins/nestjs/README.md) | NestJS 12.3.2, TypeScript 6.0.3 | 1.1.0 | `<component-name>/` (`backend/` for legacy manifests) |
| [Next.js](plugins/nextjs/README.md) | Next.js 16.4.3, React 19.3.1, Tailwind CSS 4.3.3 | 1.1.0 | `<component-name>/` (`frontend/` for legacy manifests) |
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
The legacy manifest requires a backend. A named-component manifest requires at
least one component and can contain multiple instances of the same technology.

For a multi-component project, save this manifest as `source.yaml`, then run:

```sh
provisionhub project init --from ./source.yaml --path ../multi-service-demo
provisionhub project plan --file ../multi-service-demo/provisionhub.yaml --plugins ./plugins
provisionhub project apply --file ../multi-service-demo/provisionhub.yaml --plugins ./plugins
```

```yaml
apiVersion: provisionhub.dev/v1alpha1
kind: Project
metadata:
  name: multi-service-demo
spec:
  components:
    - name: api
      type: backend
      technology: nestjs
    - name: billing
      type: backend
      technology: nestjs
    - name: web
      type: frontend
      technology: nextjs
    - name: admin
      type: frontend
      technology: nextjs
  connections:
    - from: web
      to: api
      type: http
```

This generates `api/`, `billing/`, `web/`, and `admin/` beside the manifest.
The connection is declaration only; no HTTP client or network configuration is
generated. Each package and starter page uses its component name. Reordering
the component list does not change plan identities or output paths.

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
adjacent `plugins` directory when this variable is unset. Create Project opens
the named-component list directly after project information. Add, edit, or
remove components before Review. On Review, `p` optionally previews the read-only plan; Enter returns
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
node --test tests/nestjs.test.mjs tests/nextjs.test.mjs tests/components.test.mjs
```

On Linux or macOS:

```sh
PROVISIONHUB_BIN="$(cd ../provisionhub && pwd)/provisionhub" node --test tests/nestjs.test.mjs tests/nextjs.test.mjs tests/components.test.mjs
```

The tests verify discovery, deterministic plans, approval refusal, naming,
output paths, conflict and traversal rejection, four-component builds, and HTTP responses.
No network access is needed by the core Go test suite.

## Limits

Direct npm versions are pinned; generated projects receive a lockfile only
after `npm install`. Commit that lockfile for repeatable installs. No database,
authentication, Docker, cloud deployment, backend/frontend integration, or
remote plugin installation is generated. The executor's multi-file publication
is not transactional if a process crashes or the filesystem changes concurrently.
