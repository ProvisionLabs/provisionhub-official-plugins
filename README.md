# ProvisionHub official plugins

Official plugins for the local-first [ProvisionHub](https://github.com/ProvisionLabs/provisionhub)
developer provisioning tool.

| Plugin | Status |
| --- | --- |
| [NestJS](plugins/nestjs/README.md) | Declarative backend generator, plugin contract `v1alpha1` |
| `keycloak-go/` | Existing experimental gRPC authentication plugin; not a declarative generator |

## Generate a NestJS backend

Build or install ProvisionHub from the sibling repository. The examples below
assume `provisionhub` is on your PATH and you run from this repository's root.
Use an absolute plugin directory if running from elsewhere.

```sh
provisionhub project init --name sample-api --path ../sample-api --backend nestjs
provisionhub project plan --file ../sample-api/provisionhub.yaml --plugins ./plugins
provisionhub project apply --file ../sample-api/provisionhub.yaml --plugins ./plugins
```

Review the plan and type `yes` at the interactive prompt. For automation,
`--yes` explicitly approves generation after reviewing the plan. Files appear
under `../sample-api/backend/`. Generation never installs dependencies or runs
commands. Then, using Node.js 24.15 or newer and npm:

```sh
cd ../sample-api/backend
npm install
npm run build
npm run start
```

GET <http://127.0.0.1:3000/> returns `Hello from sample-api!`.
For the TUI, set `PROVISIONHUB_PLUGINS` to this repository's absolute `plugins`
directory before launching ProvisionHub. Select NestJS with no frontend or
database, save, press `p` to preview, `g` to generate, and `y` to confirm.

## Integration validation

Requires Node.js 24.15+, npm, network access to the npm registry, and an already
built ProvisionHub executable. No npm packages are needed in this repository.
The test generates exclusively in a fresh system temporary directory and
removes it afterward. It installs generated dependencies only as an explicit
integration step, builds the app, starts the compiled entry point, and checks
the HTTP response. It also checks deterministic plans, approval refusal,
conflicts, traversal, linked output parents where supported, and unsupported
frontend selections.

PowerShell, from this repository:

```powershell
$env:PROVISIONHUB_BIN = (Resolve-Path ../provisionhub/provisionhub.exe).Path
node --test tests/nestjs.test.mjs
```

Linux/macOS:

```sh
PROVISIONHUB_BIN="$(cd ../provisionhub && pwd)/provisionhub" node --test tests/nestjs.test.mjs
```

Build the executable first with `go build ./cmd/provisionhub` from the core
repository. Its Go requirement is defined in that repository's `go.mod`.
See [NestJS validation results](plugins/nestjs/VALIDATION.md) for the checks
performed for this version.
